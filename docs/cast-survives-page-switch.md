# Keeping a cast alive across pages, and the proper fix still to do

## The problem

The cast is a copy of the visualizer canvas, and the visualizer lives inside the React view. Opening any other page (Media Manager, Preset Manager, Show Manager, Lyric Manager, Admin) unmounted the React view, which ended the visualizer, the cast stream and the cast itself (`OutputCastControl` stops the cast when it unmounts). The operator had to stop, reselect the window and aspect ratio, and cast again.

Switching **engines** inside the React page does not do this (the cast control stays mounted and the relay follows the new engine's canvas), except for Canvas/Fractures, where casting is disabled on purpose.

## Option 1 (done): keep the React view alive behind other pages while casting

- `VyzualzView` hosts the React view in `ReactViewKeepAlive`, always as the first child of the page frame, so the same instance survives page changes.
- Mounted while on the React page, **or** while the cast is `ok` or `healing` in the health store (`systems.cast`, set by the cast self-healer when a cast starts and cleared when the user stops it, the cast ends, or the cast control unmounts). When the cast ends the view is unmounted, so nothing keeps rendering for no reason.
- On the React page the host is `display: contents` and adds no box of its own; layout is unchanged (checked against the app's real stylesheets). Behind another page it is moved off screen at the size the view last had, `visibility: hidden`, `pointer-events: none`, `inert`.
- **Stage-only while hidden (`useReactBackgrounded()`).** Only the visualizer and the cast control run. `ReactView` does not render the left and right rail contents, the track map / timelines / pads, the audio dock, the Track Timeline modal, the authoring overlays or the header controls. That removes every UI-only animation loop and poll (track map playhead, timeline lanes, live-value polling, dock waveform) at once, and it is exactly what a page switch did to those panels before this existed, so nothing is lost that was not already lost. `OutputCastControl` keeps its exact place in the tree (the gated siblings leave empty slots), so it is not remounted and the cast is not interrupted. The cast popover and preview monitor close.
- **Anything left open is closed.** Because the panels unmount, their popovers, menus, modals and portals unmount with them; the cast popover/preview are gated explicitly; the pad hotkeys are gated too. Checked in a real browser: with the cast popover open on the React page, leaving leaves no popover, no preview, no React header controls and no visible element from the hidden view.
- **The visualizer panel keeps its size while hidden** (`ReactViewKeepAlive.css`, sizes measured on the React page). Without it the panel would grow into the space the panels freed and the cast's picture would change shape.
- `styles/reactView.css` has the React-page layout rules for `.fw-app-content > .vz-main` repeated for `.fw-app-content > .vz-react-host > .vz-main`; any new CSS written against that direct-child relationship needs the same.

### Other engines' frame copy (done)

Cinema 2.0 announces each finished frame (`notifyCanvasFrameRendered`); the relay copies it in the same task. The other engines' output canvases were checked: Headliner, XY Scope, the Canvas engine (its capture canvas) and the placeholder canvases are 2D canvases, which keep their picture, so the frame timer copies them correctly. **PixGrid** is the only other WebGL output canvas, and it now announces its frames too. It also stops rendering when paused or when no audio is playing, which would have left the relay with nothing to copy (a black output); while a relay is watching its GPU canvas (`hasCanvasFrameListeners`) it redraws about 15 times a second (`WATCHED_REFRESH_MS`), and the normal loop takes over when playback is live. A new WebGL output canvas added to any engine must announce its frames the same way.

### Verification

- Unit/DOM tests: the host keeps one instance and its state across pages (including the router returning a single element on some pages and a fragment on others), hides and un-hides, keeps the visualizer panel size, and unmounts when no cast is live; `canvasFrameReadiness` has a test for `hasCanvasFrameListeners`.
- `src/test/browser/page-keepalive.html` mounts the real application router (frame, sidebar, every page, the React view; no login gate) in Chromium. With the cast state set, going to Preset Manager, Media Manager, Show Manager and back kept the same cast-control DOM node, the visualizer panel size (717x650, canvas 715x648) and its canvas, rendered the panels again on return, and unmounted the hidden view when the cast state was cleared. The visualizer kept rendering behind Media, Show and Lyric Manager (about 240 frames in 2 s in headless Chromium) without slowing the page in front.
- **Not exercised:** a real cast to a real output across real pages, and PixGrid's new announcement against a real WebGL PixGrid canvas (the announcement is one call after the draw; the paused-redraw loop is the part to watch). Try both before a gig: start a cast on a Cinema 2.0 preset and on PixGrid (also with the transport paused), open each other page, come back, and confirm the output never blinks, changes size or goes black.

### Limits that remain

- It still costs GPU: the visualizer and the cast copy run behind the other page. A cast-only lower render quality while hidden is not done.
- Anything in the kept (visualizer) subtree that portals outside the view and is open when the user leaves is not closed; nothing known does.
- If the main window freezes and freeze recovery reloads it, or another page's heavy work starves the shared process, the cast is still affected. Only option 2 fixes that.

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
