/**
 * Stream Command Center v0.7
 *
 * The YouTube event is selected manually from the dashboard. Pressing
 * "Find next YouTube event" searches the configured channel for public,
 * scheduled broadcasts and stores the nearest one in /data/selection.json.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 6767);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIRECTORY || path.join(ROOT, "data");
const SELECTION_FILE = path.join(DATA_DIR, "selection.json");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const twitchToken = { value: "", expiresAt: 0 };

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function sendText(response, status, value) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(value);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }

  return body;
}

function readSelection() {
  try {
    return JSON.parse(fs.readFileSync(SELECTION_FILE, "utf8"));
  } catch {
    return { videoId: "", title: "", scheduledStartTime: "" };
  }
}

function saveSelection(selection) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SELECTION_FILE, JSON.stringify(selection, null, 2));
}

async function getTwitchToken() {
  if (twitchToken.value && Date.now() < twitchToken.expiresAt - 60_000) {
    return twitchToken.value;
  }

  const query = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials"
  });
  const result = await fetchJson(`https://id.twitch.tv/oauth2/token?${query}`, {
    method: "POST"
  });

  twitchToken.value = result.access_token;
  twitchToken.expiresAt = Date.now() + result.expires_in * 1000;
  return twitchToken.value;
}

async function getTwitchMetrics(channel) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret || !channel) {
    return { configured: false, live: false };
  }

  const accessToken = await getTwitchToken();
  const headers = {
    "Client-Id": clientId,
    Authorization: `Bearer ${accessToken}`
  };
  const twitchGet = (url) => fetchJson(url, { headers });
  const user = await twitchGet(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`
  );
  const broadcasterId = user.data?.[0]?.id;

  if (!broadcasterId) throw new Error("Twitch channel not found");

  const [streamResult, followerResult] = await Promise.all([
    twitchGet(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`),
    twitchGet(
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

async function findNearestUpcomingYouTubeEvent(channelId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !channelId) {
    throw new Error("YouTube API key and channel ID are required");
  }

  const query = new URLSearchParams({
    part: "snippet",
    channelId,
    eventType: "upcoming",
    type: "video",
    order: "date",
    maxResults: "25",
    key: apiKey
  });
  const result = await fetchJson(
    `https://www.googleapis.com/youtube/v3/search?${query}`
  );
  const events = (result.items || [])
    .map((item) => ({
      videoId: item.id?.videoId || "",
      title: item.snippet?.title || "",
      scheduledStartTime: item.snippet?.publishedAt || ""
    }))
    .filter((item) => item.videoId)
    .sort((a, b) => new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime));

  if (!events.length) {
    throw new Error("No public upcoming YouTube event was found for this channel");
  }

  // Fetch the video resource because it has the authoritative scheduled start time.
  const detailsQuery = new URLSearchParams({
    part: "snippet,liveStreamingDetails",
    id: events[0].videoId,
    key: apiKey
  });
  const details = await fetchJson(
    `https://www.googleapis.com/youtube/v3/videos?${detailsQuery}`
  );
  const video = details.items?.[0];
  const selection = {
    videoId: video?.id || events[0].videoId,
    title: video?.snippet?.title || events[0].title,
    scheduledStartTime:
      video?.liveStreamingDetails?.scheduledStartTime || events[0].scheduledStartTime,
    selectedAt: new Date().toISOString()
  };

  saveSelection(selection);
  return selection;
}

async function getYouTubeMetrics(channelId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const selection = readSelection();

  if (!apiKey || !channelId) {
    return { configured: false, live: false };
  }

  const channelQuery = new URLSearchParams({
    part: "statistics",
    id: channelId,
    key: apiKey
  });
  const channelResult = await fetchJson(
    `https://www.googleapis.com/youtube/v3/channels?${channelQuery}`
  );
  const subscribers = Number(
    channelResult.items?.[0]?.statistics?.subscriberCount || 0
  );

  if (!selection.videoId) {
    return {
      configured: true,
      live: false,
      viewers: 0,
      subscribers,
      title: "Press Find next YouTube event",
      selectedEvent: null
    };
  }

  const videoQuery = new URLSearchParams({
    part: "snippet,liveStreamingDetails",
    id: selection.videoId,
    key: apiKey
  });
  const result = await fetchJson(
    `https://www.googleapis.com/youtube/v3/videos?${videoQuery}`
  );
  const video = result.items?.[0];
  const live = video?.liveStreamingDetails || {};

  return {
    configured: true,
    live: Boolean(live.actualStartTime && !live.actualEndTime),
    viewers: Number(live.concurrentViewers || 0),
    subscribers,
    title: video?.snippet?.title || selection.title,
    selectedEvent: {
      videoId: selection.videoId,
      scheduledStartTime: live.scheduledStartTime || selection.scheduledStartTime
    }
  };
}

function normalize(result, platform) {
  return result.status === "fulfilled"
    ? result.value
    : { configured: true, live: false, error: `${platform}: ${result.reason.message}` };
}

async function handlePlatforms(response, url) {
  const twitchChannel = url.searchParams.get("twitchChannel")?.trim() || "";
  const youtubeChannelId = url.searchParams.get("youtubeChannelId")?.trim() || "";
  const results = await Promise.allSettled([
    getTwitchMetrics(twitchChannel),
    getYouTubeMetrics(youtubeChannelId)
  ]);
  sendJson(response, 200, {
    twitch: normalize(results[0], "Twitch"),
    youtube: normalize(results[1], "YouTube")
  });
}

async function handleYouTubeSelection(response, url) {
  try {
    const youtubeChannelId = url.searchParams.get("youtubeChannelId")?.trim() || "";
    const selection = await findNearestUpcomingYouTubeEvent(youtubeChannelId);
    sendJson(response, 200, { ok: true, selection });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
}

function resolveStaticFile(requestUrl) {
  const parsed = new URL(requestUrl, "http://localhost");
  const pathname = decodeURIComponent(parsed.pathname);
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.resolve(PUBLIC_DIR, relative);
  return file.startsWith(`${PUBLIC_DIR}${path.sep}`) ? file : null;
}

function serveStatic(requestUrl, response) {
  const file = resolveStaticFile(requestUrl);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    sendText(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(file)] || "application/octet-stream"
  });
  const stream = fs.createReadStream(file);
  stream.on("error", (error) => response.destroy(error));
  stream.pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/api/platforms") {
      await handlePlatforms(response, url);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/youtube/select-upcoming") {
      await handleYouTubeSelection(response, url);
      return;
    }

    serveStatic(request.url, response);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: "Internal server error" });
    else response.destroy(error);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Stream Command Center v0.7 listening on port ${PORT}`);
});
