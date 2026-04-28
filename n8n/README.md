# n8n Render redeploy workflow

This folder contains an importable n8n workflow for redeploying 9router on Render.

## What it does

- Runs manually from n8n, or
- Runs on a schedule, and
- Sends a `POST` request to the Render Deploy Hook URL.

GitHub push auto-deploy should still be the main update path. This workflow is for scheduled redeploys or a manual "deploy now" button in n8n.

## Setup

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

