# Cast output after a Cinema 2.0 preset change

## What went wrong

After every Cinema 2.0 preset change the cast output went **black and frozen while the app still said "Connected"**; the only cure was to disconnect, pick the window and aspect ratio again and reconnect (in one logged session, 82 of 97 preset changes while casting were followed by that manual reset).

The cast relay copied the visualizer canvas with `drawImage` from its **own `requestAnimationFrame` callback**. A WebGL canvas keeps its picture only until the browser presents the frame, so a copy that runs before the canvas's own renderer in a frame reads back **cleared**. Callbacks run in the order they registered, and a preset change creates a new render loop that registers **after** the relay's: from then on the relay ran first every frame and copied blank pictures (identical black frames also explain the stream bitrate collapsing from about 12 Mbps to about 140 kbps in the logs). A fresh reconnect created a new relay that registered after the render loop, which is why it "fixed" it.

## The fix

- `lib/canvasFrameReadiness.ts`: a renderer can announce each finished frame (`notifyCanvasFrameRendered`); consumers subscribe with `onCanvasFrameRendered` and can tell a canvas announces its frames (`isCanvasFramePublisher`).
- `Cinema2Runtime` calls `onFrameRendered` right after each frame is drawn (same task, picture intact); `Cinema2Stage` forwards it for its canvas.
- `output/relayFramePump.ts` drives both cast relays (WebRTC and Google Cast): it copies **in the announcement** for a canvas that announces its frames, falls back to the frame timer for one that does not (2D canvases, other engines), follows a canvas that is replaced, respects the relay's frame-rate limit, and **never lets an exception end the loop** (the old loop was ended by any error other than `InvalidStateError`). Distinct failures are reported once (`[cast] relay frame copy failed`).

## Checked

- Reproduced on the real Electron output bridge with a real receiver window and real WebRTC, with the real app view: connect with a preset running (picture moves), change preset (output black, brightness 0, frozen), reconnect (moves again).
- After the fix, ten preset changes in a row with no reconnect: the receiver's picture matched the stage's every time (same brightness; still where the preset is still, moving where it moves), and the main process received no `stop-cast` or `fail-session`.
- `relayFramePump.test.ts` models a WebGL canvas that is blank outside its renderer's task: with the old timer-only copy every copy is cleared (20 of 20), with the fix none is.
- Presets without a loaded track are legitimately still (Cinema 2.0 freezes animation while analysis is inactive); a still output is not this bug. Compare the output with the stage.
