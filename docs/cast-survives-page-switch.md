# Keeping a cast alive across pages, and the proper fix still to do

## The problem

The cast is a copy of the visualizer canvas, and the visualizer lives inside the React view. Opening any other page (Media Manager, Preset Manager, Show Manager, Lyric Manager, Admin) unmounted the React view, which ended the visualizer, the cast stream and the cast itself (`OutputCastControl` stops the cast when it unmounts). The operator had to stop, reselect the window and aspect ratio, and cast again.

Switching **engines** inside the React page does not do this (the cast control stays mounted and the relay follows the new engine's canvas), except for Canvas/Fractures, where casting is disabled on purpose.

## Option 1 (done): keep the React view alive behind other pages while casting

- `VyzualzView` hosts the React view in `ReactViewKeepAlive`, always as the first child of the page frame, so the same instance survives page changes.
- Mounted while on the React page, **or** while the cast is `ok` or `healing` in the health store (`systems.cast`, set by the cast self-healer when a cast starts and cleared when the user stops it, the cast ends, or the cast control unmounts). When the cast ends the view is unmounted, so nothing keeps rendering for no reason.
- On the React page the host is `display: contents` and adds no box; layout is unchanged (checked against the app's real stylesheets). Behind another page it is moved off screen at the size the view last had (so the visualizer, and the cast, keep their resolution), `visibility: hidden`, `pointer-events: none`, `inert`.
- While hidden (`useReactBackgrounded()`): the header controls are not rendered (they belong to the visible page), the cast popover and the cast preview monitor close, and the pad hotkeys ignore keystrokes meant for the page in front.
- `styles/reactView.css` has the React-page layout rules for `.fw-app-content > .vz-main` repeated for `.fw-app-content > .vz-react-host > .vz-main`; any new CSS written against that direct-child relationship needs the same.

### Limits of option 1 (what it does not do)

- **It costs GPU.** The visualizer, the cast copy and the React view's own effects all keep running behind the other page. A cast-only reduced load while hidden (lower the preview/analysis work, drop UI-only updates) is not done.
- **Any other popover, modal or portal that was open** when the user left the React page is not closed (only the cast popover and preview monitor are). They are hidden if they live inside the view, but one portaled to `<body>` would stay visible.
- **Not exercised end to end.** The app is behind login, so this was verified with unit/DOM tests (the host keeps one instance across pages, including the router returning a single element on some pages and a fragment on others) and a real-CSS layout check, not by casting from the running app across real pages. Try it before a gig: start a cast, open Media Manager, Preset Manager, Show Manager, come back, and confirm the output never blinks, changes size or loses audio-reactive motion.
- **Engines other than Cinema 2.0 are copied on the frame timer**, as before the earlier relay fix. PixGrid draws with WebGL without keeping its frame, so after switching to it the output may be black or frozen while the app says "Connected" (the same class of bug fixed for Cinema 2.0 in `docs/cinema2-cast-relay.md`). Fix: have PixGrid announce its finished frames with `notifyCanvasFrameRendered`, as `Cinema2Stage` does, and add a test. Not done.

## Option 2 (to do later, the robust design): give the output its own renderer

Instead of the main window rendering the visualizer and streaming a copy, the output window renders the visualizer itself. It then does not depend on which page the operator is on, drops the WebRTC copy/encode cost and its latency, and a crash of the main window's renderer no longer takes the output down.

What it needs:
- the output window runs the Cinema 2.0 runtime (and each other engine that can be cast) on its own canvas;
- the audio analysis (the analyser data every preset reads) delivered to it from the main window continuously, or analysis run in the output window from a shared audio tap;
- the active preset, its parameters and the transport state mirrored to it, and every change forwarded (preset switches, parameter edits, automation);
- a decision for engines that need main-window-only resources (camera for Headliner, MIDI/DMX hardware for Laser DMX, media/text scenes);
- a fallback to today's stream for engines that cannot render in the output window.

This is a project of its own; do not start it as part of a bug fix. Option 1 should hold until then.

## Related

- `docs/cinema2-cast-relay.md`: why a WebGL canvas is copied in the same task as its draw.
- `docs/self-healing.md`: the cast reconnect (the cast keeps being remembered, and kept alive, while it is being repaired).
