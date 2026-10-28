const $ = (id) => document.getElementById(id);
const formatNumber = (value) => Number(value || 0).toLocaleString();

let socket;
let requestSequence = 0;
let refreshTimer;
const pendingRequests = new Map();

let settings = {
  url: "ws://127.0.0.1:4455",
  password: "",
  poll: 10,
  twitchChannel: "",
  youtubeChannelId: "",
  ...JSON.parse(localStorage.getItem("scc") || "{}")
};

function showError(error) {
  $("error").textContent = error?.message || String(error);
  $("error").hidden = false;
}

function clearError() {
  $("error").textContent = "";
  $("error").hidden = true;
}

function setObsStatus(state, label) {
  $("obs-status").dataset.state = state;
  $("obs-status").textContent = label;
}

/*
 * OBS WebSocket uses SHA-256 during authentication. This implementation works
 * in an OBS browser dock loaded from a plain HTTP address. Web Crypto's
 * crypto.subtle is not consistently available outside a secure context.
 */
function rotateRight(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Base64(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const message = new Uint8Array(paddedLength);

  message.set(bytes);
  message[bytes.length] = 0x80;

  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  for (let offset = 0; offset < message.length; offset += 64) {
    const words = new Uint32Array(64);

    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }

    for (let index = 16; index < 64; index += 1) {
      const first =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const second =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);

      words[index] =
        (words[index - 16] + first + words[index - 7] + second) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let index = 0; index < 64; index += 1) {
      const sigmaOne =
        rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporaryOne =
        (h + sigmaOne + choice + constants[index] + words[index]) >>> 0;
      const sigmaZero =
        rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporaryTwo = (sigmaZero + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporaryOne) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporaryOne + temporaryTwo) >>> 0;
    }

    hash = [
      (hash[0] + a) >>> 0,
      (hash[1] + b) >>> 0,
      (hash[2] + c) >>> 0,
      (hash[3] + d) >>> 0,
      (hash[4] + e) >>> 0,
      (hash[5] + f) >>> 0,
      (hash[6] + g) >>> 0,
      (hash[7] + h) >>> 0
    ];
  }

  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  hash.forEach((value, index) => resultView.setUint32(index * 4, value, false));

  let binary = "";
  for (const byte of result) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function rejectPendingRequests(error) {
  for (const request of pendingRequests.values()) request.reject(error);
  pendingRequests.clear();
}

function connect() {
  const previousSocket = socket;
  if (previousSocket) previousSocket.close();

  const activeSocket = new WebSocket(settings.url);
  socket = activeSocket;
  setObsStatus("connecting", "OBS connecting");

  activeSocket.addEventListener("message", ({ data }) => {
    if (activeSocket !== socket) return;

    const message = JSON.parse(data);

    if (message.op === 0) {
      const identify = { rpcVersion: 1, eventSubscriptions: 1 };

      if (message.d.authentication) {
        const { salt, challenge } = message.d.authentication;
        const secret = sha256Base64(settings.password + salt);
        identify.authentication = sha256Base64(secret + challenge);
      }

      activeSocket.send(JSON.stringify({ op: 1, d: identify }));
      return;
    }

    if (message.op === 2) {
      setObsStatus("connected", "OBS connected");
      clearError();
      refreshObs();
      return;
    }

    if (message.op === 7) {
      const request = pendingRequests.get(message.d.requestId);
      if (!request) return;

      pendingRequests.delete(message.d.requestId);
      if (message.d.requestStatus.result) {
        request.resolve(message.d.responseData);
      } else {
        request.reject(
          new Error(message.d.requestStatus.comment || "OBS request failed")
        );
      }
    }
  });

  activeSocket.addEventListener("close", (event) => {
    if (activeSocket !== socket) return;

    const closeMessages = {
      4007: "OBS did not receive Identify in time.",
      4008: "OBS rejected the Identify message.",
      4009: "OBS authentication failed. Check the WebSocket password.",
      4010: "OBS rejected the RPC version."
    };

    const error = new Error(
      closeMessages[event.code] || `OBS disconnected (code ${event.code}).`
    );
    rejectPendingRequests(error);
    setObsStatus("disconnected", "OBS disconnected");
    showError(error);
  });

  activeSocket.addEventListener("error", () => {
    if (activeSocket !== socket) return;
    setObsStatus("disconnected", "OBS connection error");
    showError("Could not connect to OBS WebSocket.");
  });
}

function callObs(requestType) {
  return new Promise((resolve, reject) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      reject(new Error("OBS WebSocket is not connected."));
      return;
    }

    const requestId = String(++requestSequence);
    pendingRequests.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({
      op: 6,
      d: { requestType, requestId }
    }));

    window.setTimeout(() => {
      if (!pendingRequests.has(requestId)) return;
      pendingRequests.delete(requestId);
      reject(new Error(`OBS request ${requestType} timed out.`));
    }, 5000);
  });
}

async function refreshObs() {
  try {
    const [stats, stream] = await Promise.all([
      callObs("GetStats"),
      callObs("GetStreamStatus")
    ]);

    $("cpu").textContent = `${Number(stats.cpuUsage || 0).toFixed(1)}%`;
    $("memory").textContent = `${Number(stats.memoryUsage || 0).toFixed(0)} MB`;
    $("render").textContent = `${(
      stats.renderTotalFrames
        ? (stats.renderSkippedFrames / stats.renderTotalFrames) * 100
        : 0
    ).toFixed(2)}%`;
    $("encode").textContent = `${(
      stats.outputTotalFrames
        ? (stats.outputSkippedFrames / stats.outputTotalFrames) * 100
        : 0
    ).toFixed(2)}%`;
    $("output").textContent = stream.outputActive ? "Active" : "Stopped";
    $("time").textContent = stream.outputTimecode || "00:00:00";
  } catch (error) {
    showError(error);
  }
}

async function refreshPlatforms() {
  try {
    const query = new URLSearchParams({
      twitchChannel: settings.twitchChannel,
      youtubeChannelId: settings.youtubeChannelId
    });
    const data = await fetch(`/api/platforms?${query}`).then((response) =>
      response.json()
    );

    $("tw-viewers").textContent = formatNumber(data.twitch.viewers);
    $("tw-followers").textContent = formatNumber(data.twitch.followers);
    $("yt-viewers").textContent = formatNumber(data.youtube.viewers);
    $("yt-subs").textContent = formatNumber(data.youtube.subscribers);
    $("tw-light").classList.toggle("online", Boolean(data.twitch.live));
    $("yt-light").classList.toggle("online", Boolean(data.youtube.live));
    $("total").textContent = formatNumber(
      Number(data.twitch.viewers || 0) + Number(data.youtube.viewers || 0)
    );
  } catch (error) {
    showError(error);
  }
}

function scheduleRefresh() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) refreshObs();
    refreshPlatforms();
  }, Math.max(5, settings.poll) * 1000);
}

$("settings").onclick = () => {
  $("twitch-channel").value = settings.twitchChannel;
  $("youtube-channel-id").value = settings.youtubeChannelId;
  $("url").value = settings.url;
  $("password").value = settings.password;
  $("poll").value = settings.poll;
  $("modal").showModal();
};

$("close").onclick = () => $("modal").close();

$("clear").onclick = () => {
  localStorage.removeItem("scc");
  settings = {
    url: "ws://127.0.0.1:4455",
    password: "",
    poll: 10,
    twitchChannel: "",
    youtubeChannelId: ""
  };
  $("modal").close();
  connect();
  scheduleRefresh();
};

$("form").onsubmit = (event) => {
  event.preventDefault();
  settings = {
    twitchChannel: $("twitch-channel").value.trim(),
    youtubeChannelId: $("youtube-channel-id").value.trim(),
    url: $("url").value.trim(),
    password: $("password").value,
    poll: Number($("poll").value)
  };
  localStorage.setItem("scc", JSON.stringify(settings));
  $("modal").close();
  connect();
  refreshPlatforms();
  scheduleRefresh();
};

$("refresh").onclick = refreshObs;

$("find-youtube-event").onclick = async () => {
  const button = $("find-youtube-event");
  button.disabled = true;
  try {
    const query = new URLSearchParams({
      youtubeChannelId: settings.youtubeChannelId
    });
    const response = await fetch(`/api/youtube/select-upcoming?${query}`, {
      method: "POST"
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Event search failed");
    await refreshPlatforms();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
    button.textContent = "↻";
  }
};

connect();
refreshPlatforms();
scheduleRefresh();
