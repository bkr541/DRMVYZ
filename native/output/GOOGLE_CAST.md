# Google Cast live output

DRMVYZ Stage 7 uses the documented Google Cast sender/receiver architecture instead of treating Electron as a Web Sender. Electron opens a separately hosted HTTPS browser companion, that page uses Google's Web Sender SDK and standard Cast launcher, and a registered Custom Web Receiver plays the live media stream produced by DRMVYZ.

## Required external configuration

1. Host `native/output/google-cast/sender/index.html` on HTTPS. It is static and contains no private application ID.
2. Host `native/output/google-cast/receiver/index.html` on HTTPS and register that URL as a Custom Web Receiver in the Google Cast SDK Developer Console.
3. Set `DRMVYZ_GOOGLE_CAST_APP_ID` to the resulting eight-character receiver application ID.
4. Set `DRMVYZ_GOOGLE_CAST_SENDER_URL` to the hosted HTTPS sender page URL.
5. Register the sender page origin for the Cast application as required by the Google Cast developer console/testing workflow.

The sender URL and app ID are deployment configuration, not saved-project state and not hard-coded developer credentials. The browser companion must stay open for the duration of the Cast session because it owns the supported Web Sender session.

## Production path

```text
OutputCastControl canonical final canvas
→ canvas captureStream()
→ MediaRecorder WebM (VP8/VP9, runtime-supported)
→ preload Google Cast media IPC
→ OutputTargetManager / GoogleCastProvider
→ tokenized private-LAN HTTP stream
→ Custom Web Receiver <video>
→ selected Google Cast device
```

Device selection is initiated by `google-cast/open-picker`. `GoogleCastProvider` creates a one-use browser transaction and passes its localhost callback URL/token only in the URL fragment so those secrets are not sent to the HTTPS hosting origin. The browser companion reports selection/session events back to the loopback control endpoint and relays versioned custom-message commands over `urn:x-cast:com.dvydrm.drmvyz.live`.

## Local media security

The local service never exposes a file root. A receiver can request only `/api/google-cast/live/:sessionId` with the random per-session token. Requests are accepted only from a private network address, only for the active session, and only after the renderer has declared an allowed WebM VP8/VP9 MIME type. Per-chunk and pre-receiver buffering limits bound memory use. Disconnect, stop, renderer failure, and app shutdown end HTTP responses and release the Cast media session.

The browser companion control routes permit only the configured HTTPS sender origin. Callback tokens are transaction-scoped. Browser local-network protections can still require the operator to grant local-network access to the hosted sender page.

## Media boundary

This stage intentionally limits the live relay to 1280×720 landscape (or 720×1280 portrait), 30 fps, and a 6 Mbps MediaRecorder hint. Encoding happens from a relay canvas outside React state; runtime transport statistics are sampled at low frequency. Renderer/source replacement is handled by reading the current canonical canvas reference on every relay frame rather than creating a second visual source of truth.

Actual codec acceptance is receiver-dependent. The Custom Web Receiver checks `canDisplayType()` before opening the stream and fails explicitly if the selected device cannot decode the renderer's WebM format. Physical Cast hardware validation is still required for each target device generation; mocked/native tests cannot establish real decoder/network behavior.
