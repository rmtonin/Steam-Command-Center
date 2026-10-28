# Stream Command Center

> Current release: v0.8

A small self-hosted dashboard for monitoring an OBS session alongside Twitch and YouTube. It is designed to run as a Docker container on a home server and to be opened as an OBS custom browser dock.

The dashboard currently shows:

- OBS connection state
- Stream output state and elapsed time
- Active FPS
- OBS CPU and memory use
- Rendering and encoding lag
- Twitch live viewers and follower count
- YouTube live viewers and subscriber count
- Combined Twitch and YouTube viewers
- The nearest public upcoming YouTube broadcast, selected manually

The web interface listens on port `6767`.


## Interface size and appearance

The main dashboard is designed for a `600 × 400` OBS custom dock. It uses a compact dark translucent interface with rounded floating surfaces, restrained color, thin highlights, and clear foreground hierarchy. The layout does not need vertical scrolling at the target dock size.

For the intended result, set the OBS dock to approximately 600 pixels wide and 400 pixels high. The layout can shrink below that size, although telemetry labels become more compact.

## How it is put together

The Node server serves the dashboard and makes the Twitch and YouTube API requests. API credentials stay inside the container environment and are not sent to the browser.

The browser dock connects directly to OBS WebSocket on the streaming computer. OBS connection details, the Twitch channel login, and the YouTube channel ID are kept in that browser's local storage.

## Requirements

- Docker with Docker Compose, or Portainer connected to a Docker environment
- OBS Studio 28 or newer
- OBS WebSocket enabled
- A Twitch developer application
- A Google Cloud project with YouTube Data API v3 enabled

Twitch and YouTube support can be configured independently. Leaving one platform unconfigured does not prevent the rest of the dashboard from running.

## Repository layout

```text
.
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── compose.yml
├── Dockerfile
├── package.json
├── README.md
└── server.js
```

## Deploy with Portainer from GitHub

1. Fork this repository or create a new GitHub repository containing these files.
2. In Portainer, open the Docker environment where the container should run.
3. Go to **Stacks** and select **Add stack**.
4. Give the stack a name, for example `stream-command-center`.
5. Select **Git repository** as the build method.
6. Enter the repository URL.
7. Use `refs/heads/main` as the repository reference if the deployment branch is `main`.
8. Set the Compose path to `compose.yml`.
9. If the repository is private, enable repository authentication and provide a GitHub credential with read access.
10. Add the environment variables listed below.
11. Select **Deploy the stack**.

Portainer supports deploying a stack from a Git repository and supplying variables from the stack configuration. See the [Portainer stack documentation](https://docs.portainer.io/user/docker/stacks/add).

### Portainer environment variables

```text
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
YOUTUBE_API_KEY=
```

The following values are entered later through the dashboard and should not be added to Portainer:

```text
TWITCH_CHANNEL
YOUTUBE_CHANNEL_ID
OBS_WEBSOCKET_URL
OBS_WEBSOCKET_PASSWORD
```

Once the stack is running, open:

```text
http://YOUR-SERVER-IP:6767/
```

For example:

```text
http://192.168.1.50:6767/
```

## Deploy with Docker Compose

Clone the repository and create a local environment file:

```bash
git clone YOUR_REPOSITORY_URL
cd stream-command-center
cp .env.example .env
```

Fill in the API credentials in `.env`, then build and start the container:

```bash
docker compose up -d --build
```

To view the container logs:

```bash
docker compose logs -f
```

To stop it:

```bash
docker compose down
```

The named Docker volume is kept when the container is recreated. It stores the selected YouTube event.

## Update an existing Portainer deployment

Push the new version to the branch used by Portainer. Open the stack and use **Pull and redeploy** or the equivalent Git update action in the installed Portainer version.

If environment variables changed, update them in the stack before redeploying.

## Configure OBS

OBS WebSocket is built into OBS Studio 28 and newer. In OBS:

1. Open **Tools > WebSocket Server Settings**.
2. Enable the WebSocket server.
3. Keep authentication enabled.
4. Use port `4455`, unless another application already requires a different port.
5. Copy or set the WebSocket password.

OBS recommends protecting WebSocket access with a password. See the [OBS remote control guide](https://obsproject.com/kb/remote-control-guide).

Add the dashboard as a dock:

1. Open **View > Docks > Custom Browser Docks**.
2. Enter a dock name such as `Stream Command Center`.
3. Enter the dashboard address, for example `http://192.168.1.50:6767/`.
4. Open the dashboard's **Settings** menu.
5. Enter `ws://127.0.0.1:4455` as the OBS WebSocket URL.
6. Enter the OBS WebSocket password.
7. Save the settings.

When the page is running inside OBS, `127.0.0.1` refers to the streaming computer. If the dashboard is opened on another device, use the streaming computer's LAN address instead:

```text
ws://STREAMING-PC-IP:4455
```

Do not forward port `4455` to the internet.

## Twitch setup

### Create a Twitch developer application

1. Sign in to the [Twitch Developer Console](https://dev.twitch.tv/console).
2. Make sure the Twitch account has two-factor authentication enabled.
3. Open **Applications** and register a new application.
4. Choose a unique application name.
5. Enter an HTTPS redirect URL accepted by the Twitch console. This build uses the client-credentials flow, so the redirect URL is not used during normal dashboard operation.
6. Select an appropriate application category.
7. Create the application.
8. Open **Manage** for the new application.
9. Copy the Client ID.
10. Select **New Secret**, then copy the generated Client Secret.

Twitch documents the application registration, Client ID, and **New Secret** process in its [application registration guide](https://dev.twitch.tv/docs/authentication/register-app/).

Store the values in Portainer or `.env`:

```text
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

Never commit the Client Secret to Git.

### Set the Twitch channel

Open the dashboard's **Settings** menu and enter the Twitch login name without the full URL:

```text
example_streamer
```

## YouTube setup

### Create the API key

1. Sign in to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project or select an existing one.
3. Open **APIs & Services > Library**.
4. Find and enable **YouTube Data API v3**.
5. Open **APIs & Services > Credentials**.
6. Select **Create credentials > API key**.
7. Copy the key.
8. Restrict the key to **YouTube Data API v3** before using it in production.

Google documents the project, API enablement, and credential requirements in the [YouTube Data API getting-started guide](https://developers.google.com/youtube/data/getting-started) and the [authorization credentials guide](https://developers.google.com/youtube/registering_an_application).

Store the key in Portainer or `.env`:

```text
YOUTUBE_API_KEY=your_api_key
```

Do not commit the key to Git.

### Set the YouTube channel

Find the channel ID in YouTube's advanced account settings. It normally begins with `UC`.

Open the dashboard's **Settings** menu and enter it there:

```text
UCxxxxxxxxxxxxxxxxxxxxxx
```

After saving the channel ID, select **Find next YouTube event**. The dashboard searches for the nearest public upcoming broadcast and stores the selected event in the Docker volume. Private or unlisted broadcasts may not be returned by an API-key-only search.

## Connection indicator

The OBS badge has three states:

- Yellow: connecting
- Green: OBS completed identification and the dashboard can make requests
- Red: disconnected or an error occurred

The badge changes to connected only after OBS sends the `Identified` message. A prior socket that closes during a reconnect is ignored, so it cannot overwrite the current connection state.

Common close codes:

```text
4007  OBS did not receive Identify in time
4008  OBS rejected the Identify message
4009  OBS rejected the password
4010  Unsupported RPC version
```

## Troubleshooting

### OBS appears in Connected Sessions, but the dashboard says disconnected

Use version 0.7 or newer. Earlier versions could let the close event from an old socket overwrite the state of the new socket during reconnection.

### Authentication failed

Check the password under **Tools > WebSocket Server Settings**, clear the dashboard's saved settings, and enter it again. A close code of `4009` indicates that OBS rejected the authentication response.

### Dashboard loads but Twitch or YouTube says Not configured

Check that the corresponding API credential is present in Portainer or `.env`, then recreate the container. Also confirm that the channel value was saved through the dashboard's Settings menu.

### YouTube event search returns nothing

Confirm the channel ID, verify that YouTube Data API v3 is enabled, and check that the broadcast is public and scheduled. The manual search is intentionally not run during every dashboard refresh.

### Port 6767 is already in use

Change only the host side of the Compose mapping. For example:

```yaml
ports:
  - "6868:6767"
```

The application can then be opened on port `6868`, while the container continues listening on `6767`.

## Security notes

- Keep OBS WebSocket authentication enabled.
- Do not expose OBS WebSocket port `4455` to the public internet.
- Keep API secrets in Portainer or a local `.env` file.
- Do not commit `.env`.
- If a Twitch Client Secret or YouTube API key is exposed, revoke or regenerate it and update the stack.

## License

No license has been selected yet. Add a license file before distributing modified builds if you want to define reuse and contribution terms explicitly.
