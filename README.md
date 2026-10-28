# Stream Command Center

Version 1.1 uses the OBS Studio brand icon from Font Awesome's free brands set instead of a hand-drawn approximation. The SVG is bundled locally at `public/obs-studio-logo.svg`, so the dashboard does not depend on an external asset server.

## Portainer deployment

Create a Git-backed stack using `compose.yml`, then add:

```text
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
YOUTUBE_API_KEY=
```

Deploy the stack and open `http://YOUR-SERVER-IP:6767/`. Use the dashboard settings to enter the Twitch login, YouTube channel ID, and OBS WebSocket details.

## OBS setup

Enable OBS WebSocket under **Tools > WebSocket Server Settings**. Keep authentication enabled. When the dashboard is used as an OBS custom browser dock, use:

```text
ws://127.0.0.1:4455
```

## Twitch credentials

Register an application in the Twitch Developer Console. Open **Manage**, copy the Client ID, and generate a Client Secret with **New Secret**. Store both in Portainer rather than GitHub.

## YouTube API key

Create a Google Cloud project, enable YouTube Data API v3, and create an API key under **APIs & Services > Credentials**. Restrict the key to YouTube Data API v3 and store it in Portainer.

Do not commit `.env` or secrets.
