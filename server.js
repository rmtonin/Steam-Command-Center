/**
 * Stream Command Center HTTP server
 *
 * Responsibilities:
 * 1. Serve the static dashboard files from /public.
 * 2. Fetch Twitch and YouTube metrics without exposing API secrets to the browser.
 * 3. Listen on port 6767 by default.
 *
 * No external Node packages are required.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 6767);
const CURRENT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIRECTORY = path.join(CURRENT_DIRECTORY, "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

let twitchToken = {
  value: "",
  expiresAt: 0
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function getTwitchAccessToken() {
  const now = Date.now();

  if (twitchToken.value && now < twitchToken.expiresAt - 60_000) {
    return twitchToken.value;
  }

  const parameters = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials"
  });

  const data = await fetchJson(
    `https://id.twitch.tv/oauth2/token?${parameters}`,
    { method: "POST" }
  );

  twitchToken = {
    value: data.access_token,
    expiresAt: now + data.expires_in * 1000
  };

  return twitchToken.value;
}

async function fetchTwitchMetrics() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const channel = process.env.TWITCH_CHANNEL;

  if (!clientId || !clientSecret || !channel) {
    return { configured: false, live: false };
  }

  const accessToken = await getTwitchAccessToken();
  const headers = {
    "Client-Id": clientId,
    Authorization: `Bearer ${accessToken}`
  };

  const twitchApi = async (url) => fetchJson(url, { headers });

  const userResult = await twitchApi(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`
  );
  const broadcasterId = userResult.data?.[0]?.id;

  if (!broadcasterId) {
    throw new Error("Twitch channel was not found");
  }

  const [streamResult, followerResult] = await Promise.all([
    twitchApi(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`),
    twitchApi(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`
    )
  ]);

  const stream = streamResult.data?.[0];

  return {
    configured: true,
    live: Boolean(stream),
    viewers: stream?.viewer_count || 0,
    followers: followerResult.total || 0,
    title: stream?.title || ""
  };
}

async function fetchYouTubeMetrics() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const liveVideoId = process.env.YOUTUBE_LIVE_VIDEO_ID;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey || !liveVideoId) {
    return { configured: false, live: false };
  }

  const videoParameters = new URLSearchParams({
    part: "snippet,liveStreamingDetails",
    id: liveVideoId,
    key: apiKey
  });

  const videoResult = await fetchJson(
    `https://www.googleapis.com/youtube/v3/videos?${videoParameters}`
  );

  const video = videoResult.items?.[0];
  const liveDetails = video?.liveStreamingDetails || {};
  let subscribers = 0;

  if (channelId) {
    const channelParameters = new URLSearchParams({
      part: "statistics",
      id: channelId,
      key: apiKey
    });

    const channelResult = await fetchJson(
      `https://www.googleapis.com/youtube/v3/channels?${channelParameters}`
    );

    subscribers = Number(
      channelResult.items?.[0]?.statistics?.subscriberCount || 0
    );
  }

  return {
    configured: true,
    live: Boolean(liveDetails.actualStartTime && !liveDetails.actualEndTime),
    viewers: Number(liveDetails.concurrentViewers || 0),
    subscribers,
    title: video?.snippet?.title || ""
  };
}

async function handlePlatformApi(response) {
  const results = await Promise.allSettled([
    fetchTwitchMetrics(),
    fetchYouTubeMetrics()
  ]);

  const normalizeResult = (result, platformName) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      configured: true,
      live: false,
      error: `${platformName}: ${result.reason.message}`
    };
  };

  sendJson(response, 200, {
    twitch: normalizeResult(results[0], "Twitch"),
    youtube: normalizeResult(results[1], "YouTube")
  });
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(message);
}

function getStaticFilePath(requestUrl) {
  // Parse only the pathname. This makes both / and /?reset=1 serve index.html.
  const parsedUrl = new URL(requestUrl, "http://localhost");
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_DIRECTORY, relativePath);

  // Prevent requests such as /../../etc/passwd from escaping /public.
  if (!filePath.startsWith(`${PUBLIC_DIRECTORY}${path.sep}`)) {
    return null;
  }

  return filePath;
}

function serveStaticFile(requestUrl, response) {
  const filePath = getStaticFilePath(requestUrl);

  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(response, 404, "Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
  });

  const fileStream = fs.createReadStream(filePath);

  fileStream.on("error", (error) => {
    console.error("Static file error:", error);

    if (!response.headersSent) {
      sendText(response, 500, "Internal server error");
    } else {
      response.destroy(error);
    }
  });

  fileStream.pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const parsedUrl = new URL(request.url, "http://localhost");

    if (parsedUrl.pathname === "/api/platforms") {
      await handlePlatformApi(response);
      return;
    }

    serveStaticFile(request.url, response);
  } catch (error) {
    console.error("Request error:", error);

    if (!response.headersSent) {
      sendJson(response, 500, { error: "Internal server error" });
    } else {
      response.destroy(error);
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Stream Command Center is running on port ${PORT}`);
});
