# Stream Command Center

Stream Command Center is a compact, self-hosted dashboard for monitoring a Twitch and YouTube livestream alongside OBS Studio statistics. The interface is designed for a 600 × 400 OBS custom browser dock, but it can also be opened from a normal browser on the local network.

## Current release

Current release: `1.0.2`

This patch removes duplicate follower/subscriber symbols and repairs the compact render/encode metric layout while preserving the existing dashboard design.

## Features

- Combined Twitch and YouTube viewer count
- Short viewer-history graphs
- Twitch live viewers and follower total
- YouTube live viewers and subscriber total
- Red and green platform status indicators
- OBS connection state
- OBS stream session time
- OBS CPU and memory usage
- Rendering and encoding lag
- OBS output status
- Manual selection of the nearest public upcoming YouTube broadcast
- Docker volume for retaining the selected YouTube event
- Browser-local storage for channel and OBS connection settings
- Server-side storage of Twitch and YouTube API credentials
- Docker Compose and Portainer deployment

## How it works

The Node.js server performs two jobs:

1. It serves the dashboard files from the `public` directory.
2. It makes the Twitch and YouTube API requests so that API secrets are not exposed to the browser.

The dashboard connects directly from the OBS browser dock to OBS WebSocket. The OBS password, Twitch channel login, YouTube channel ID, and refresh interval are saved in that browser's local storage.

The following secrets stay inside the container environment:

```text
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
YOUTUBE_API_KEY
```

## Requirements

- Docker Engine with Docker Compose, or Portainer connected to a Docker environment
- OBS Studio 28 or newer
- OBS WebSocket enabled
- A Twitch developer application for Twitch statistics
- A Google Cloud project with YouTube Data API v3 enabled for YouTube statistics

Twitch and YouTube can be configured independently. Leaving one platform unconfigured does not prevent OBS or the other platform from working.

## Repository structure

```text
.
├── public/
│   ├── app.js
│   ├── index.html
│   ├── obs-studio-logo.svg
│   └── styles.css
├── .env.example
├── .gitignore
├── compose.yml
├── Dockerfile
├── package.json
├── README.md
└── server.js
```

## Quick start with Portainer and GitHub

### 1. Put the project on GitHub

Create a repository and upload the contents of this project folder to the repository root. The repository root should contain `compose.yml`, `Dockerfile`, `server.js`, and the `public` folder.

Do not upload a real `.env` file. The supplied `.gitignore` already excludes it.

### 2. Create the Portainer stack

1. Open the Docker environment in Portainer.
2. Open **Stacks**.
3. Select **Add stack**.
4. Enter a stack name such as `stream-command-center`.
5. Select **Git repository**.
6. Enter the GitHub repository URL.
7. Set **Repository reference** to `refs/heads/main` if the deployment branch is named `main`.
8. Set **Compose path** to `compose.yml`.
9. If the repository is private, enable authentication and provide a GitHub credential with repository read access.
10. Add the API credentials under **Environment variables**.
11. Select **Deploy the stack**.

### 3. Add the Portainer variables

```text
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
```

Do not add these values to GitHub.

The following values are entered later through the dashboard settings:

```text
Twitch channel login
YouTube channel ID
OBS WebSocket URL
OBS WebSocket password
Refresh interval
```

### 4. Open the dashboard

```text
http://YOUR-SERVER-IP:6767/
```

Example:

```text
http://192.168.1.50:6767/
```

## Deploy with Docker Compose

### 1. Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
cd Steam-Command-Center
```

### 2. Create the environment file

```bash
cp .env.example .env
```

Edit `.env` and add:

```text
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
```

### 3. Build and start the container

```bash
docker compose up -d --build
```

### 4. Check the logs

```bash
docker compose logs -f
```

### 5. Stop the container

```bash
docker compose down
```

The named Docker volume is not removed by `docker compose down`. The volume stores the selected YouTube event.

To remove the container and the volume:

```bash
docker compose down -v
```

## Port configuration

The container listens on port `6767`, and `compose.yml` publishes the same port:

```yaml
ports:
  - "6767:6767"
```

If port `6767` is already in use on the Docker host, change only the host side:

```yaml
ports:
  - "6868:6767"
```

The dashboard would then be available at:

```text
http://YOUR-SERVER-IP:6868/
```

## OBS setup

OBS WebSocket is built into OBS Studio 28 and newer.

### Enable OBS WebSocket

1. Open OBS Studio.
2. Open **Tools > WebSocket Server Settings**.
3. Enable the WebSocket server.
4. Keep authentication enabled.
5. Use port `4455`, unless another local application requires a different port.
6. Set or copy the WebSocket password.

Do not forward OBS WebSocket port `4455` through the router.

### Add the dashboard as an OBS dock

1. Open **View > Docks > Custom Browser Docks**.
2. Enter a dock name such as `Stream Command Center`.
3. Enter the dashboard URL, for example:

```text
http://192.168.1.50:6767/
```

4. Add the dock.
5. Open the dashboard settings using the three-dot button.
6. Enter the OBS WebSocket URL:

```text
ws://127.0.0.1:4455
```

7. Enter the OBS WebSocket password.
8. Select **Save**.

When the dashboard is running inside OBS, `127.0.0.1` refers to the streaming computer. If the dashboard is opened on another computer, phone, or tablet, use the streaming computer's LAN address instead:

```text
ws://STREAMING-PC-IP:4455
```

Example:

```text
ws://192.168.1.100:4455
```

The streaming computer's firewall must allow the connection when another device is used.

## Twitch setup

### Create a Twitch developer application

1. Sign in to the Twitch Developer Console.
2. Make sure two-factor authentication is enabled on the Twitch account.
3. Open **Applications**.
4. Select **Register Your Application**.
5. Enter a unique application name.
6. Enter an HTTPS redirect URI accepted by the Twitch console.
7. Select an appropriate application category.
8. Create the application.
9. Open **Manage** for the new application.
10. Copy the **Client ID**.
11. Select **New Secret**.
12. Copy the generated **Client Secret** and store it securely.

This dashboard uses Twitch's client-credentials flow. The registered redirect URI is not used by the running dashboard, but Twitch still requires a redirect URI when the application is registered.

Add the credentials to Portainer or `.env`:

```text
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

Never put the Client Secret in `public/app.js`, `compose.yml`, or a public GitHub commit.

### Set the Twitch channel

Open the dashboard settings and enter only the Twitch login name:

```text
example_streamer
```

Do not enter the full Twitch URL and do not include `@`.

## YouTube setup

### Create a Google Cloud project

1. Sign in to Google Cloud Console.
2. Create a new project or select an existing project.
3. Open **APIs & Services > Library**.
4. Find **YouTube Data API v3**.
5. Enable the API.

### Create the API key

1. Open **APIs & Services > Credentials**.
2. Select **Create credentials > API key**.
3. Copy the generated key.
4. Open the key settings.
5. Restrict the key to **YouTube Data API v3**.
6. Save the restriction.

Add the key to Portainer or `.env`:

```text
YOUTUBE_API_KEY=your_api_key
```

Do not commit the key to GitHub.

### Find the YouTube channel ID

The dashboard expects the channel ID, not the channel handle or channel URL. A channel ID normally begins with `UC`:

```text
UCxxxxxxxxxxxxxxxxxxxxxx
```

Enter the channel ID in the dashboard settings and save.

### Select an upcoming YouTube event

The dashboard does not search for a YouTube event on every refresh. Use the circular refresh button on the YouTube card to search for the nearest public upcoming broadcast.

The selected event is saved in the Docker volume and remains selected when the container is recreated. Private or unlisted events may not be returned by the API-key-only search used by this build.

## Dashboard settings

Open the three-dot button and configure:

- Twitch channel login
- YouTube channel ID
- OBS WebSocket URL
- OBS WebSocket password
- Refresh interval in seconds

These settings are saved in the local storage of the browser or OBS dock. Clearing browser data, removing the dock, or selecting **Clear** in the settings can remove them.

API credentials are not stored in browser local storage.

## Updating from GitHub in Portainer

1. Push the updated files to the branch configured in Portainer.
2. Open the stack in Portainer.
3. Use the Git pull/redeploy or stack update action available in the installed Portainer version.
4. Rebuild or recreate the service when prompted.
5. Reload the OBS dock.

If OBS keeps showing an older cached interface, temporarily add a version query to the dock URL:

```text
http://YOUR-SERVER-IP:6767/?version=1.0
```

## Updating a Docker Compose installation

```bash
git pull
docker compose up -d --build
```

## Data and persistence

The Compose stack creates this named volume:

```text
stream-command-data
```

The volume is mounted at `/data` inside the container. It stores the selected YouTube event in `youtube-selection.json`.

The volume does not contain the Twitch Client Secret, YouTube API key, or OBS password.

## Troubleshooting

### The dashboard does not open

Check the container status and logs:

```bash
docker compose ps
docker compose logs -f
```

Confirm that the host port is available and that the server firewall permits access to port `6767`.

### Portainer reports that port 6767 is already allocated

Change the host side of the port mapping:

```yaml
ports:
  - "6868:6767"
```

Redeploy the stack and use port `6868` in the browser and OBS dock URL.

### OBS appears briefly in Connected Sessions and disappears

Confirm the WebSocket password and port. OBS close code `4009` means authentication failed.

### OBS shows a connected session but the dashboard indicator is red

Reload the dock, open the settings, and save the OBS connection again. The indicator only turns green after OBS returns the successful identification response.

### OBS works in the dock but not from another device

`127.0.0.1` only points to OBS when the page runs on the streaming computer. On another device, use the streaming computer's LAN IP and allow the WebSocket port through the streaming computer's firewall.

### Twitch shows zero or is not configured

Check all three items:

- `TWITCH_CLIENT_ID` exists in Portainer or `.env`.
- `TWITCH_CLIENT_SECRET` exists in Portainer or `.env`.
- The Twitch login name is saved in the dashboard settings.

Redeploy the container after changing environment variables.

### Twitch reports an authentication error

Generate a new Client Secret in the Twitch Developer Console, update the Portainer variable or `.env`, and recreate the container. Generating a replacement secret invalidates the previous secret.

### YouTube shows zero or is not configured

Check that:

- `YOUTUBE_API_KEY` exists in Portainer or `.env`.
- YouTube Data API v3 is enabled for the Google Cloud project.
- The YouTube channel ID is saved in the dashboard settings.
- The API key is permitted to use YouTube Data API v3.

### The YouTube event button finds no event

Confirm that the channel ID is correct and that the upcoming broadcast is public and scheduled. The current search may not return private or unlisted broadcasts.

### The interface looks outdated after redeployment

Reload the dock or use a temporary cache-busting URL:

```text
http://YOUR-SERVER-IP:6767/?version=1.0
```

## Security notes

- Keep `.env` out of Git.
- Keep Twitch Client Secret and YouTube API key in Portainer or a local `.env` file.
- Keep OBS WebSocket authentication enabled.
- Do not expose OBS WebSocket port `4455` publicly.
- Restrict the YouTube API key to YouTube Data API v3.
- Regenerate any secret or API key that is accidentally published.
- Use a read-only GitHub credential when Portainer only needs to pull the repository.

## Health check commands

Check whether the dashboard responds locally on the Docker server:

```bash
curl -I http://127.0.0.1:6767/
```

Check the platform endpoint without configured browser settings:

```bash
curl "http://127.0.0.1:6767/api/platforms?twitchChannel=&youtubeChannelId="
```

The endpoint should return JSON even when Twitch and YouTube are not configured.

## License

Add a `LICENSE` file if the repository will be distributed publicly and a specific reuse policy is required.
