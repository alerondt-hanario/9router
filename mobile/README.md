# 9router Admin Mobile

Expo React Native app for configuring 9router providers and watching tracker metrics.

## Run locally

```bash
npm install
npm start
```

Set the API URL in the app Settings screen. On Android emulator, use `http://10.0.2.2:3000`; on a physical phone, use the LAN URL of the machine running 9router.

## Build APK

```bash
npm run build:apk
```

This uses EAS and the `apk` build profile in `eas.json`.
