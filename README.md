# Stream Command Center v0.3

Docker-hosted dashboard for OBS, Twitch, and YouTube. It listens on port **6767**.

## Important fixes in v0.3

- Query strings such as `/?reset=1` no longer break the HTTP server.
- Static-file errors are handled instead of producing an empty response.
- OBS authentication no longer depends on `crypto.subtle`, which may be unavailable on a plain-HTTP LAN address.
- OBS close codes are displayed as readable diagnostic messages.
- A **Clear saved OBS settings** button is included.
- JavaScript is split into readable, commented modules.

## Upload to GitHub

1. Create a new empty GitHub repository.
2. Extract this project.
3. Upload the contents of this folder to the repository root.
4. Do not upload a real `.env` file. `.gitignore` already excludes it.

Expected repository structure:

```text
public/
  js/
    app.js
    obs-client.js
    sha256.js
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

1. In Portainer, open **Stacks > Add stack**.
2. Name the stack `stream-command-center`.
3. Select **Git repository**.
4. Paste the GitHub repository URL.
5. Use `refs/heads/main` as the repository reference if the branch is `main`.
6. Set the Compose path to `compose.yml`.
7. If the repository is private, enable authentication and provide a GitHub token with read access.
8. Add the environment variables below in Portainer.
9. Select **Deploy the stack**.

```text
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_CHANNEL=
YOUTUBE_API_KEY=
YOUTUBE_LIVE_VIDEO_ID=
YOUTUBE_CHANNEL_ID=
```

Open the dashboard at:

```text
http://YOUR-SERVER-IP:6767/
```

## Add the dashboard to OBS

1. Open **View > Docks > Custom Browser Docks**.
2. Add `http://YOUR-SERVER-IP:6767/`.
3. Open **OBS settings** inside the dashboard.
4. Keep the default URL `ws://127.0.0.1:4455`.
5. Enter the exact password shown in **Tools > WebSocket Server Settings**.
6. Select **Save and reconnect**.

If it fails, the dashboard now displays the OBS close code. Code 4009 means the password was rejected.

## Updating through Portainer

After pushing a change to GitHub, open the stack in Portainer and use its Git update/redeploy option to pull the latest repository revision and rebuild the container.

## Security

- Keep OBS WebSocket authentication enabled.
- Do not expose port 4455 to the internet.
- Keep API credentials in Portainer environment variables, not in GitHub.
