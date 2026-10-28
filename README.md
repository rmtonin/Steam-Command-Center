# Stream Command Center

A compact OBS dock for monitoring Twitch, YouTube, and the current OBS output from one 600 × 400 panel.

## Features

- Combined viewer count with a short session graph
- Twitch and YouTube viewer histories
- Twitch follower and YouTube subscriber totals
- Live/offline status lights
- OBS CPU, memory, rendering lag, encoding lag, output state, and session time
- Manual selection of the nearest public upcoming YouTube event
- Browser-local channel and OBS settings
- Server-side API credentials
- Docker and Portainer deployment

## Requirements

- Docker Engine with Docker Compose, or Portainer
- OBS Studio 28 or newer
- OBS WebSocket enabled
- Twitch developer credentials for Twitch data
- A YouTube Data API v3 key for YouTube data

Either platform can be left unconfigured.

## Repository contents

```text
public/
  app.js
  index.html
  styles.css
.env.example
.gitignore
compose.yml
Dockerfile
package.json
README.md
server.js
```

## Deploy from GitHub with Portainer

1. Fork this repository, or copy it to a GitHub repository of your own.
2. Open the target Docker environment in Portainer.
3. Go to **Stacks** and select **Add stack**.
4. Give the stack a name such as `stream-command-center`.
5. Select **Git repository**.
6. Enter the repository URL.
7. Set the repository reference to `refs/heads/main` if the deployment branch is `main`.
8. Set the Compose path to `compose.yml`.
9. Enable repository authentication if the repository is private.
10. Add the environment variables shown below.
11. Select **Deploy the stack**.

Portainer variables:

```text
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
YOUTUBE_API_KEY=
```

Open the dashboard at:

```text
http://YOUR-SERVER-IP:6767/
```

Portainer documents Git-backed stacks and environment variables here: [Portainer stack documentation](https://docs.portainer.io/user/docker/stacks/add).

## Deploy with Docker Compose

```bash
git clone YOUR_REPOSITORY_URL
cd stream-command-center
cp .env.example .env
```

Add the API credentials to `.env`, then run:

```bash
docker compose up -d --build
```

Useful commands:

```bash
docker compose logs -f
docker compose down
docker compose up -d --build
```

## Configure OBS

1. In OBS, open **Tools > WebSocket Server Settings**.
2. Enable the WebSocket server.
3. Keep authentication enabled.
4. Use port `4455`, unless another port is required locally.
5. Set or copy the WebSocket password.
6. Open **View > Docks > Custom Browser Docks**.
7. Add the dashboard URL, for example `http://192.168.1.50:6767/`.
8. Open the dashboard settings.
9. Use `ws://127.0.0.1:4455` when the page runs inside OBS.
10. Enter the password and save.

If the dashboard is opened on another computer or tablet, replace `127.0.0.1` with the streaming computer's LAN address.

Do not expose OBS WebSocket port `4455` to the public internet.

## Twitch credentials

1. Sign in to the [Twitch Developer Console](https://dev.twitch.tv/console).
2. Enable two-factor authentication on the Twitch account if it is not already enabled.
3. Register a new application.
4. Choose a unique application name.
5. Enter an HTTPS redirect URI accepted by the Twitch console. This application uses the client-credentials flow, so the redirect is not used by the running dashboard.
6. Create the application and open **Manage**.
7. Copy the Client ID.
8. Select **New Secret** and copy the Client Secret.
9. Store both values in Portainer or `.env`.

Twitch's registration instructions are available in the [Twitch application registration guide](https://dev.twitch.tv/docs/authentication/register-app/).

Never commit the Client Secret to GitHub.

In the dashboard settings, enter only the Twitch login name:

```text
example_streamer
```

## YouTube API key

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project or select an existing project.
3. Open **APIs & Services > Library**.
4. Enable **YouTube Data API v3**.
5. Open **APIs & Services > Credentials**.
6. Select **Create credentials > API key**.
7. Copy the key.
8. Restrict the key to YouTube Data API v3.
9. Store the key in Portainer or `.env`.

Google describes this process in the [YouTube Data API getting-started guide](https://developers.google.com/youtube/data/getting-started) and [credentials guide](https://developers.google.com/youtube/registering_an_application).

In the dashboard settings, enter the YouTube channel ID. It normally starts with `UC`:

```text
UCxxxxxxxxxxxxxxxxxxxxxx
```

Press the circular refresh button on the YouTube card to select the nearest public upcoming event. The selected event is stored in the Docker volume. Private or unlisted events may not be returned by an API-key-only request.

## Updating

Push changes to the branch monitored by Portainer, then use the stack's pull-and-redeploy action. For a local Compose deployment:

```bash
git pull
docker compose up -d --build
```

## Settings storage

Twitch channel, YouTube channel ID, OBS URL, OBS password, and refresh interval are saved in the browser dock's local storage. API credentials remain inside the container environment.

## Troubleshooting

### OBS connected sessions shows the dashboard, but the badge is red

Reload the dock and save the OBS settings again. The badge turns green only after OBS sends the `Identified` response.

### OBS authentication failed

Check the password in **Tools > WebSocket Server Settings**. Close code `4009` means the password was rejected.

### Twitch or YouTube displays zero

Confirm the API credentials in Portainer, save the correct channel value in the dashboard, and redeploy after changing environment variables.

### The YouTube event button reports no event

Confirm the channel ID and API key. The event must be public and scheduled to appear in the current API-key search.

### Port 6767 is already used

Change the host side of the mapping in `compose.yml`:

```yaml
ports:
  - "6868:6767"
```

The dashboard will then be available on host port `6868`.

## Security

- Keep `.env` out of Git.
- Keep OBS WebSocket authentication enabled.
- Do not expose port `4455` publicly.
- Regenerate any API credential that is accidentally published.
