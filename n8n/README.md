# n8n workflows for 9router

This folder contains importable n8n workflows for 9router.

## Render redeploy

`render-redeploy-workflow.json` runs manually or on a schedule and sends a `POST` request to the Render Deploy Hook URL.

GitHub push auto-deploy should still be the main update path. This workflow is for scheduled redeploys or a manual "deploy now" button in n8n.

### Setup

1. In Render, open the `9router` web service.
2. Go to **Settings** and copy the **Deploy Hook** URL.
3. Add this environment variable to n8n:

```bash
RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv_xxx?key=xxx
```

4. Import `render-redeploy-workflow.json` into n8n.
5. Adjust the schedule if needed.
6. Activate the workflow.

Do not commit the actual deploy hook URL.

## GitHub RSS to Telegram update button

`github-rss-telegram-update-workflow.json` watches the GitHub Atom feed for `decolua/9router`, posts new commits to a Telegram group topic, and includes a button that calls an n8n webhook. The webhook dispatches the GitHub Actions workflow in `.github/workflows/n8n-update.yml`.

GitHub Actions then:

- Pulls the latest branch state.
- Installs dependencies.
- Runs tests.
- Writes an update status file.
- Pushes the result to GitHub.
- Reports success or failure back to the Telegram group topic.

### Required n8n environment variables

```bash
TELEGRAM_BOT_TOKEN=123456:telegram-bot-token
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_MESSAGE_THREAD_ID=123
N8N_UPDATE_SECRET=long-random-secret
N8N_UPDATE_WEBHOOK_URL=https://your-n8n.example.com/webhook/9router-run-update?secret=long-random-secret
GITHUB_RSS_URL=https://github.com/decolua/9router/commits/main.atom
GITHUB_OWNER=decolua
GITHUB_REPO=9router
GITHUB_BRANCH=main
```

### Required n8n credential

Create an HTTP Header Auth credential for the GitHub API:

- Header name: `Authorization`
- Header value: `Bearer github_pat_xxx`

The GitHub token needs permission to run workflows for this repository. After import, open the `Dispatch GitHub Update Workflow` node and select this credential.

### Required GitHub repository secrets

Add these in **GitHub > Settings > Secrets and variables > Actions**:

```bash
TELEGRAM_BOT_TOKEN=123456:telegram-bot-token
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_MESSAGE_THREAD_ID=123
```

`TELEGRAM_MESSAGE_THREAD_ID` can be empty if the group does not use forum topics.

### Telegram notes

- Add the bot to the Telegram group.
- Give the bot permission to send messages.
- For forum topics, use the numeric topic `message_thread_id`.
- Keep bot tokens and deploy/update URLs private.
