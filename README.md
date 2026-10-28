# Stream Command Center v0.6

Docker-hosted OBS, Twitch, and YouTube dashboard on port **6767**.

## Changes in v0.6

- `TWITCH_CHANNEL` is no longer a Docker/Portainer variable.
- `YOUTUBE_CHANNEL_ID` is no longer a Docker/Portainer variable.
- Both channel values are now entered in the dashboard's **OBS settings** menu.
- Channel settings are stored in the browser dock's local storage together with the OBS connection settings.
- API credentials remain server-side in Portainer.

## GitHub upload

Upload the contents of this folder to the root of your GitHub repository. The repository root should contain `compose.yml`, `Dockerfile`, `server.js`, and the `public` folder.

Do not upload a real `.env` file.

## Portainer variables

Only these API credentials remain in Portainer:

```text
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
YOUTUBE_API_KEY=
```

Remove these old variables from the Portainer stack if they are still present:

```text
TWITCH_CHANNEL
YOUTUBE_CHANNEL_ID
YOUTUBE_LIVE_VIDEO_ID
```

## Redeploy from GitHub

1. Push v0.6 to the configured GitHub repository.
2. Open the stack in Portainer.
3. Pull the latest Git revision and redeploy/rebuild the stack.
4. Open `http://YOUR-SERVER-IP:6767/`.
5. Open **OBS settings** in the dashboard.
6. Enter your Twitch login name, YouTube channel ID, OBS WebSocket URL, and OBS password.
7. Select **Save and reconnect**.

## Channel value formats

Twitch channel login:

```text
example_streamer
```

Do not enter the full Twitch URL.

YouTube channel ID:

```text
UCxxxxxxxxxxxxxxxxxxxxxx
```

## YouTube event selection

After saving the YouTube channel ID, press **Find next YouTube event**. The selected event remains in the Docker volume across container restarts.

## Security

The channel names are not secrets and are stored locally in the browser. Twitch Client Secret and YouTube API Key remain server-side in Portainer and are never returned to the browser.
