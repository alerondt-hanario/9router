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

## Mobile admin app

The Expo Android app lives in `mobile/`. It can configure providers, run provider checks, and view tracker metrics through the 9router API.

```bash
cd mobile
npm install
npm start
```

Use `http://10.0.2.2:3000` for an Android emulator, or the LAN URL of this machine for a physical phone. The app also has a Settings screen where the API URL can be changed.

To build an APK, run the **Build mobile APK** GitHub Action or use a local Android toolchain:

```bash
cd mobile
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug
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
