# Stream Command Center

Compact 600 × 400 OBS dock for Twitch, YouTube, and OBS monitoring.

## Current release

`1.0.3` restores the complete v1.0 front-end behavior, including viewer-history graphs, live status transitions, OBS status updates, button feedback, and spinning reload controls. The settings control now uses a gear icon.

## Portainer deployment

1. Upload the project contents to the root of a GitHub repository.
2. In Portainer, open **Stacks > Add stack**.
3. Select **Git repository** and enter the repository URL.
4. Use `refs/heads/main` for a `main` branch.
5. Set the Compose path to `compose.yml`.
6. Add these environment variables:

```text
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
YOUTUBE_API_KEY=
```

7. Deploy the stack and open `http://YOUR-SERVER-IP:6767/`.

## OBS

Enable OBS WebSocket under **Tools > WebSocket Server Settings**, use port `4455`, and keep authentication enabled. Add the dashboard through **View > Docks > Custom Browser Docks**. In dashboard settings, use `ws://127.0.0.1:4455` and the OBS WebSocket password.

## Twitch

Register an application in the Twitch Developer Console, copy the Client ID, generate a Client Secret with **New Secret**, and save both in Portainer. Enter only the Twitch login name in dashboard settings.

## YouTube

Create a Google Cloud project, enable YouTube Data API v3, create an API key, and restrict it to YouTube Data API v3. Save the key in Portainer and enter the YouTube channel ID in dashboard settings. Use the YouTube reload control to select the nearest public upcoming event.

## Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

## Updating

Push changes to GitHub and use Portainer's pull/redeploy action. If the OBS dock is cached, use:

```text
http://YOUR-SERVER-IP:6767/?version=1.0.3
```

## Troubleshooting

- OBS close code `4009` means the WebSocket password was rejected.
- If port `6767` is occupied, change the host side of the mapping, for example `6868:6767`.
- Private or unlisted YouTube events may not be returned by the API-key-only search.
- Keep `.env`, Twitch Client Secret, and YouTube API key out of Git.
