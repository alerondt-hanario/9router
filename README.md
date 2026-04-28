# 9router

Deploy-ready Node.js starter for Render.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm test
```

## Deploy on Render

This repo includes `render.yaml`, so Render can create the service from a Blueprint.

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint**.
3. Connect the GitHub repository.
4. Review the service settings and apply.

Render will set `NODE_ENV=production` and provide `PORT` automatically at runtime.

## Environment variables

Copy `.env.example` to `.env` for local development. Do not commit `.env`.

