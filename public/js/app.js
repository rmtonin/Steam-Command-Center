import { ObsClient } from "./obs-client.js";

const element = (id) => document.getElementById(id);
const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercentage = (part, total) =>
  total ? `${((part / total) * 100).toFixed(2)}%` : "0.00%";

const defaultSettings = {
  obsUrl: "ws://127.0.0.1:4455",
  obsPassword: "",
  refreshSeconds: 10
};

let settings = loadSettings();
let refreshTimer;

const obs = new ObsClient({
  onConnected: () => {
    setConnectionStatus(true, "OBS connected");
    clearError();
    refreshObsMetrics();
  },
  onDisconnected: (message) => {
    setConnectionStatus(false, "OBS disconnected");
    showError(message);
  },
  onError: showError,
  onStreamState: updateStreamState
});

function loadSettings() {
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem("stream-command-center-settings") || "{}")
    };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings() {
  localStorage.setItem(
    "stream-command-center-settings",
    JSON.stringify(settings)
  );
}

function clearSavedSettings() {
  localStorage.removeItem("stream-command-center-settings");
  settings = { ...defaultSettings };
  populateSettingsForm();
  obs.disconnect();
  connectToObs();
}

function connectToObs() {
  setConnectionStatus(false, "Connecting to OBS...");
  obs.connect(settings.obsUrl, settings.obsPassword);
}

async function refreshObsMetrics() {
  try {
    const [stats, stream] = await Promise.all([
      obs.request("GetStats"),
      obs.request("GetStreamStatus")
    ]);

    element("fps").textContent = Number(stats.activeFps || 0).toFixed(1);
    element("cpu").textContent = `${Number(stats.cpuUsage || 0).toFixed(1)}%`;
    element("memory").textContent = `${Number(stats.memoryUsage || 0).toFixed(0)} MB`;
    element("render-lag").textContent = formatPercentage(
      stats.renderSkippedFrames,
      stats.renderTotalFrames
    );
    element("encoding-lag").textContent = formatPercentage(
      stats.outputSkippedFrames,
      stats.outputTotalFrames
    );
    element("output-state").textContent = stream.outputActive
      ? "Active"
      : "Stopped";
    element("session-time").textContent = stream.outputTimecode || "00:00:00";
    updateStreamState(Boolean(stream.outputActive));
  } catch (error) {
    showError(error.message);
  }
}

async function refreshPlatformMetrics() {
  try {
    const response = await fetch("/api/platforms", { cache: "no-store" });
    const platforms = await response.json();

    updatePlatformCard("twitch", platforms.twitch);
    updatePlatformCard("youtube", platforms.youtube);

    element("total-viewers").textContent = formatNumber(
      Number(platforms.twitch.viewers || 0) +
      Number(platforms.youtube.viewers || 0)
    );
    element("last-updated").textContent =
      `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    showError(`Platform API: ${error.message}`);
  }
}

function updatePlatformCard(platform, data) {
  const prefix = platform === "twitch" ? "twitch" : "youtube";
  element(`${prefix}-state`).textContent = data.configured
    ? data.live ? "Live" : "Offline"
    : "Not configured";
  element(`${prefix}-viewers`).textContent = formatNumber(data.viewers);
  element(`${prefix}-title`).textContent = data.title || data.error || "";

  if (platform === "twitch") {
    element("twitch-followers").textContent = formatNumber(data.followers);
  } else {
    element("youtube-subscribers").textContent = formatNumber(data.subscribers);
  }
}

function updateStreamState(isLive) {
  element("live-state").textContent = isLive ? "● LIVE" : "○ STANDBY";
  element("live-state").classList.toggle("is-live", isLive);
}

function setConnectionStatus(connected, label) {
  element("obs-status").textContent = label;
  element("obs-status").classList.toggle("connected", connected);
}

function showError(message) {
  element("error-message").textContent = message;
  element("error-message").hidden = false;
}

function clearError() {
  element("error-message").hidden = true;
  element("error-message").textContent = "";
}

function populateSettingsForm() {
  element("obs-url").value = settings.obsUrl;
  element("obs-password").value = settings.obsPassword;
  element("refresh-seconds").value = settings.refreshSeconds;
}

function scheduleRefreshes() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    refreshObsMetrics();
    refreshPlatformMetrics();
  }, Math.max(5, settings.refreshSeconds) * 1000);
}

element("open-settings").addEventListener("click", () => {
  populateSettingsForm();
  element("settings-dialog").showModal();
});

element("close-settings").addEventListener("click", () => {
  element("settings-dialog").close();
});

element("clear-settings").addEventListener("click", clearSavedSettings);

element("settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  settings = {
    obsUrl: element("obs-url").value.trim(),
    obsPassword: element("obs-password").value,
    refreshSeconds: Number(element("refresh-seconds").value)
  };
  saveSettings();
  element("settings-dialog").close();
  connectToObs();
  scheduleRefreshes();
});

element("refresh-now").addEventListener("click", () => {
  refreshObsMetrics();
  refreshPlatformMetrics();
});

connectToObs();
refreshPlatformMetrics();
scheduleRefreshes();
