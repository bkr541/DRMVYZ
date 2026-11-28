# Desktop security: Content Security Policy and native bridge checks

Beta remediation package 04 (SEC-03, SEC-04). The main window was already isolated (context isolation on, Node integration off, sandbox on, web security on, navigation limited to the app). These two measures add containment: if untrusted content ever ran in the page, it could not load scripts or send data anywhere, and it could not reach the native bridges.

## Content Security Policy (SEC-03)

One policy, `native/security/contentSecurityPolicy.cjs`, is delivered two ways in the built app:

- **Meta tag:** written as the first tag in every built HTML page by `src/dev/contentSecurityPolicyPlugin.ts` (production builds only). This covers the web build and Electron.
- **Header:** sent by Electron's `drmvyz-app://` protocol on HTML responses. Only a header can carry `frame-ancestors 'none'`, which stops other pages framing the app.

| Directive | Allows |
| --- | --- |
| `script-src` | The app's own bundles, and WebAssembly (`'wasm-unsafe-eval'`: Draco, ONNX background removal, MediaPipe, vtracer). No inline scripts and no `eval`; the build contains neither. |
| `worker-src` | The app's workers and `blob:` workers |
| `style-src` | The app's styles, inline style attributes, and Google Fonts' stylesheet |
| `font-src` | The app's fonts, `data:`, and Google Fonts' files |
| `img-src`, `media-src` | The app, `data:`, `blob:` and any `https:` source (signed Storage URLs, announcement images) |
| `connect-src` | The app, `data:`, `blob:`, and Supabase (`https://*.supabase.co`, `wss://*.supabase.co`, plus `VITE_SUPABASE_URL` if it is a custom domain) |
| `frame-src` | The app and `data:`/`blob:`/srcdoc frames (Layout Lab previews) |
| `object-src` | Nothing |
| `base-uri`, `form-action` | The app only |

The development server has no policy, because Vite's hot reload needs inline scripts and its own websocket. Test CSP-sensitive changes with `npm run build` and `npx vite preview` (or `electron . --production`).

**Adding a new external service:** add its origin to the right directive in `contentSecurityPolicy.cjs` and its test, or the policy blocks it. Anything blocked is written to the app log once (Settings › Developer › Logging, scope `security`, "Blocked by the Content Security Policy"; `src/lib/contentSecurityPolicyReporting.ts`), with query strings removed.

WebRTC (casting) is not governed by CSP; Web Cast signalling goes through Supabase Edge Functions.

## Native bridge sender check (SEC-04)

`native/security/trustedIpc.cjs` serves a bridge request only when it comes from the **main frame** of a **live** page whose URL is the app: the dev server in development, `drmvyz-app://app` when built. Requests from an embedded frame, a navigated-away page, a popup or an output window are refused (`handle` rejects; `on` is ignored). Each refused channel is logged once (scope `system:ipc`).

`electron/main.cjs` gives every bridge a checked `ipcMain` (`createTrustedIpcMain`), so no handler can be added without the check: Rekordbox USB, diagnostics and logs, system metrics, camera access, and output/casting. The output bridge's own per-handler check uses the same function. The development-only review-notes capture keeps its own stricter check (main window only).

**Popups.** The app's named windows (Layout Lab, Lyric Manager layout, Track Timeline, Mobile App Preview) open only blank (the app renders into them) or on the app's own URL. Any other URL with one of those names is denied and handed to the system browser if it is https, like every other link.

## Tests

- `native/security/trustedIpc.test.cjs`: trusted and untrusted senders (iframes, navigated pages, destroyed pages, missing frames), the wrapper for `handle` and `on`, logging once.
- `native/security/contentSecurityPolicy.test.cjs`: no inline scripts or eval, connect-src limited to the app and Supabase, custom Supabase domains, header vs meta.
- `src/lib/contentSecurityPolicyReporting.test.ts`: violations logged once, without query strings.
