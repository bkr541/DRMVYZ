# DRMVYZ Android TV / Google TV Receiver (Stage 6)

This module is the proprietary DRMVYZ Receiver V2 appliance for Android TV / Google TV. It is **not Google Cast/Chromecast**.

## Production path

The desktop production path remains unchanged:

```text
React Cast Output UI
→ preload `drmvyzNative.output`
→ output IPC
→ OutputTargetManager
→ DrmvyzReceiverProvider
→ Receiver V2 capability/pairing/session request
→ canonical DRMVYZ canvas relay (`captureStream`)
→ sender-hosted `/receiver` WebRTC page
→ Android TV WebView
→ fullscreen hardware-accelerated presentation where the platform WebView supports it
```

The TV app owns only receiver concerns: stable receiver identity, trusted-sender tokens, DNS-SD/legacy discovery advertisement, Receiver V2 HTTP control endpoints, operator pairing approval, lifecycle state, and fullscreen presentation. It does not contain desktop editor or visual-engine code.

## Receiver lifecycle

The visible lifecycle is `Ready → Pairing → Connecting → Connected`, with explicit `Error` states. Disconnect, unrecovered sender/WebView failure, app restart, and network topology changes tear down transient session state and return to `Ready`. Only receiver identity and paired-sender trust survive restart.

Pairing is D-pad operable. A pairing request blocks session authorization until the TV operator selects **Allow** or **Deny**, with a 30-second sender-compatible timeout.

## Discovery and Receiver V2

The receiver advertises `_drmvyz-cast._tcp.` using Android `NsdManager` and simultaneously emits the Stage 5 UDP compatibility beacon on port `53531`. The receiver HTTP server binds an ephemeral TCP port and implements:

- `GET /health`
- `GET /api/v2/capabilities`
- `POST /api/v2/pair`
- `POST /api/v2/sessions`
- `POST /api/v2/sessions/:castId/stop`

Capabilities expose one Android TV display (`android-default`) and the existing Stage 5 WebRTC/VP8 quality ceiling. Session creation accepts the existing Stage 5 window/aspect values, but the TV appliance always presents the receiver fullscreen.

## Media path

Stage 5 already serves an isolated `/receiver` page from the desktop sender. That page performs the exact WebRTC offer/answer flow against the sender's `/api/sessions/...` endpoints. Stage 6 intentionally loads that page in a locked-down Android `WebView` rather than duplicating WebRTC signaling in a new native stack.

The WebView:

- enables JavaScript only because the Stage 5 receiver page requires it,
- denies WebView permission requests,
- disables file/content access and popup windows,
- permits navigation only to the exact authorized sender receiver URL,
- runs with Android view hardware acceleration enabled,
- polls the Stage 5 page's `data-state` at low frequency to mirror Connecting/Connected/Error lifecycle states without per-frame UI updates.

Android System WebView availability is checked before capability/session acceptance. A device without a usable WebView returns an explicit `503` rather than appearing to connect successfully.

## Security boundary

Receiver V2 is currently an HTTP/WebRTC trusted-LAN protocol inherited from Stage 5, so the module includes a Network Security Configuration that permits cleartext traffic. Requests are still constrained by discovery token, private-network address checks, stable sender identity, durable pairing token, selected display ID, per-session control token, and exact sender-host source URL validation.

Do not expose this receiver directly to an untrusted/public network.

## Build

Prerequisites:

- Android Studio / Android SDK Platform 36
- Android Gradle Plugin 8.13.2
- Gradle 8.13
- JDK 17 for the Android build toolchain

From this directory with a compatible Gradle installation:

```bash
gradle :app:assembleDebug
gradle :app:testDebugUnitTest
```

Or open `android-tv-receiver/` as a Gradle project in Android Studio and run the `app` configuration on an Android TV / Google TV device.

The repository intentionally does not commit Gradle's generated caches, `local.properties`, Android build output, or a wrapper JAR.

## Validation boundary

Repository-native contract tests under `native/output/androidTvReceiverContract.test.cjs` compare this module's packaged protocol contract to the live Stage 5 sender constants and guard the TV manifest/control surface. Android JVM tests cover protocol validation and lifecycle transitions.

Real device validation is still required for DNS-SD visibility across the target LAN/router, TV WebView WebRTC/VP8 decode behavior, hardware decode characteristics, D-pad focus, sleep/wake, app background/foreground behavior, sender crash recovery, and Google TV vendor-specific lifecycle behavior.
