# Stream Command Center v0.2, port 6767

## GitHub and Portainer deployment

1. Create a new GitHub repository.
2. Upload every file and folder from this project to the repository root. Do not create or upload a real `.env` file.
3. In Portainer, select your Docker environment and choose **Stacks > Add stack**.
4. Name it `stream-command-center` and select **Git repository**.
5. Enter your GitHub repository URL.
6. Set the repository reference to `refs/heads/main` if your branch is named `main`.
7. Set the Compose path to `compose.yml`.
8. For a private repository, enable authentication and provide an appropriate GitHub credential.
9. Add the following under Portainer's environment variables. Values may remain blank until configured:

```text
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_CHANNEL=
YOUTUBE_API_KEY=
YOUTUBE_LIVE_VIDEO_ID=
YOUTUBE_CHANNEL_ID=
```

10. Select **Deploy the stack**.
11. Open `http://YOUR-SERVER-IP:6767`.
12. In OBS, open **View > Docks > Custom Browser Docks** and add the same dashboard address.
13. In the dashboard's OBS Settings, use `ws://127.0.0.1:4455` and your OBS WebSocket password.

The container listens on port 6767 and Compose publishes host port 6767. Keep OBS WebSocket authentication enabled, never expose port 4455 publicly, and keep API secrets in Portainer rather than GitHub.
