# V-CON — Android video converter

V-CON is an Android-ready, on-device video converter. It uses a local WebView UI and
FFmpeg.wasm (single-thread core) to convert files without uploading them to a server.

## What it does
- Pick a video from Android storage
- Convert among MP4, WebM, MOV, MKV, AVI, and GIF (actual codec/container support depends on the bundled FFmpeg build)
- Choose output resolution and quality preset
- Show progress and let the user save/share the result
- All processing happens on-device; no conversion API or account is used

## Important limitations
- This starter loads FFmpeg.wasm and its core from jsDelivr at runtime. The first use needs internet access.
- Large files can exhaust Android WebView memory. Start with short clips (under ~100 MB).
- MP4 is the most reliable output. Some input/output combinations may fail because codecs are not included in the selected FFmpeg core.
- Android WebView's file picker and download flow are handled by the Android wrapper.
- This is a project source bundle, not a signed APK. Build/sign it using Android Studio as described below.

## Project layout
- `www/` — V-CON app UI and conversion logic
- `android/` — Capacitor Android project scaffold is created by the commands below
- `capacitor.config.json` — Capacitor configuration

## Build the Android app
Requirements: a computer (Windows/macOS/Linux), Node.js 20+, Android Studio, Android SDK.

1. Install Node.js and Android Studio.
2. Extract this ZIP, open a terminal in the `V-CON` folder.
3. Run:

   ```bash
   npm install
   npx cap add android
   npx cap sync android
   npx cap open android
   ```

4. In Android Studio, wait for Gradle sync. Select a device/emulator and press **Run**.
5. For a release APK: **Build → Generate Signed Bundle / APK → APK**, create/select a signing key, then build `release`.
6. The APK is usually at `android/app/build/outputs/apk/release/app-release.apk`.

## Install on your Android phone
- Transfer the APK to your phone.
- Open it and allow installation from that source when Android asks.
- For Google Play, create a signed Android App Bundle (AAB) and complete Play Console's current policy/testing requirements.

## Run as a web app for quick testing
```bash
npm install
npm run dev
```
Open the local URL on your phone/desktop. For Android install, use the Capacitor steps above.

## Privacy
V-CON does not upload selected video files. FFmpeg runs locally in the app's WebView. The FFmpeg runtime files are fetched from jsDelivr; replace the CDN paths with locally hosted files if you want a fully offline first launch.

## Troubleshooting
- **Conversion fails:** Try MP4 output, a lower resolution, or a shorter clip.
- **App closes / out of memory:** Use a shorter video and close other apps.
- **FFmpeg won't load:** Check internet access on first launch. The CDN core version must match `@ffmpeg/ffmpeg`.
- **No sound:** Some source codecs may not be supported by the chosen FFmpeg build.
