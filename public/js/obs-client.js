/**
 * Minimal OBS WebSocket 5 client.
 * Handles authentication, requests, responses, and connection diagnostics.
 */

import { sha256Base64 } from "./sha256.js";

const CLOSE_MESSAGES = {
  4005: "OBS rejected the RPC version.",
  4006: "OBS rejected the event subscription setting.",
  4007: "OBS did not receive Identify in time.",
  4008: "OBS received invalid Identify data.",
  4009: "OBS authentication failed. Check the WebSocket password.",
  4010: "OBS rejected the requested RPC version."
};

export class ObsClient {
  constructor({ onConnected, onDisconnected, onError, onStreamState }) {
    this.socket = null;
    this.nextRequestId = 1;
    this.pendingRequests = new Map();
    this.password = "";
    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.onError = onError;
    this.onStreamState = onStreamState;
  }

  connect(url, password) {
    this.disconnect();
    this.password = password;
    this.socket = new WebSocket(url);

    this.socket.addEventListener("message", (event) => {
      this.handleMessage(JSON.parse(event.data));
    });

    this.socket.addEventListener("error", () => {
      this.onError("The browser could not open the OBS WebSocket connection.");
    });

    this.socket.addEventListener("close", (event) => {
      const message =
        CLOSE_MESSAGES[event.code] ||
        `OBS disconnected (code ${event.code}${event.reason ? `: ${event.reason}` : ""}).`;
      this.rejectPendingRequests(new Error(message));
      this.onDisconnected(message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  async handleMessage(message) {
    if (message.op === 0) {
      await this.identify(message.d);
      return;
    }

    if (message.op === 2) {
      this.onConnected();
      return;
    }

    if (message.op === 5 && message.d.eventType === "StreamStateChanged") {
      this.onStreamState(Boolean(message.d.eventData.outputActive));
      return;
    }

    if (message.op === 7) {
      this.handleRequestResponse(message.d);
    }
  }

  async identify(helloData) {
    const identifyData = {
      rpcVersion: 1,
      eventSubscriptions: 1
    };

    if (helloData.authentication) {
      const { salt, challenge } = helloData.authentication;
      const secret = sha256Base64(this.password + salt);
      identifyData.authentication = sha256Base64(secret + challenge);
    }

    this.send({ op: 1, d: identifyData });
  }

  request(requestType, requestData = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("OBS WebSocket is not connected."));
        return;
      }

      const requestId = String(this.nextRequestId++);
      this.pendingRequests.set(requestId, { resolve, reject });

      this.send({
        op: 6,
        d: { requestType, requestId, requestData }
      });

      window.setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`OBS request ${requestType} timed out.`));
        }
      }, 5000);
    });
  }

  handleRequestResponse(responseData) {
    const pending = this.pendingRequests.get(responseData.requestId);
    if (!pending) return;

    this.pendingRequests.delete(responseData.requestId);

    if (responseData.requestStatus.result) {
      pending.resolve(responseData.responseData);
    } else {
      pending.reject(
        new Error(responseData.requestStatus.comment || "OBS request failed.")
      );
    }
  }

  rejectPendingRequests(error) {
    for (const request of this.pendingRequests.values()) {
      request.reject(error);
    }
    this.pendingRequests.clear();
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }
}
