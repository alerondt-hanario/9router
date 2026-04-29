# 9router Admin Mobile

Expo React Native app for configuring 9router providers and watching tracker metrics.

## Run locally

```bash
npm install
npm start
```

By default, the app points to `https://ninerouter-admin.onrender.com`. Set another API URL and admin token in the app Settings screen when testing local services. On Android emulator, use `http://10.0.2.2:3000`; on a physical phone, use the LAN URL of the machine running 9router.

## Build APK

```bash
npm run build:apk
```

This uses EAS and the `apk` build profile in `eas.json`.
