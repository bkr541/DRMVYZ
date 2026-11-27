# NIGHTSHIFT: room pan and editable signs

Enable **Signs** in Design to edit Back, Left, Front and Right Sign Text. The
original Back message defaults to NIGHTSHIFT; the three added fields default
empty. Each message is a freestanding neon outline on its own side, facing into
the room. Empty/whitespace-only messages hide that side. Sign Size and Sign
Color apply to all four signs, with the existing musical lighting response.

Messages render up to 64 characters, fit within the sign width and retain the
original letter height for short words. The bundled Anton contour alphabet
supports Latin letters, numbers and punctuation; unsupported characters render
as question marks. Line breaks become spaces. Geometry rebuilds only when a
message changes, disposing the previous buffers. No network font load is needed.
Regenerate the outline alphabet with
`node scripts/cinema2-assets/generate-nightshift-sign.mjs`.

**Pan Room** is under Master Controls / Performance and defaults off. It makes
a full revolution in 64 beats (16 beats per side), rotating around the disco
ball's vertical axis. The camera's radius, height, lens and target remain stable
so the ball stays at the top center while every side comes into view. This mode
supersedes Camera Motion drift and works even when Camera Motion or Motion
Amount is zero. Turning Pan Room off restores the authored camera/drift view.

With **BPM Sync** on, the shared beat clock follows the track's tempo and beat
grid. With sync off, or no available tempo, it runs at the authored 100 BPM
(38.4 seconds per revolution). Pan continues without a loaded track and holds
on explicit playback pause/stop. Each nonempty wall message gradually reveals
letter by letter as that wall comes into view, then recedes as it passes.
Enable Signs is still required to display the messages. Pausing also holds the
reveal. All four text values and Pan Room persist with the preset.

The room orbit extends the shared semantic camera, including its camera
matrices, rather than overriding only the model renderer. Reflections and
atmosphere therefore use the same camera as the geometry. Other cameras keep
their existing in-place orbit behavior. The stronger floor lighting from the
previous change is retained.

## Validation

Focused unit checks cover the four persistent inputs, geometry replacement and
disposal, empty messages, directional progressive reveal, a complete revolution,
BPM scaling, free-running tempo, idle transport, pause and restoring the camera.
The shared camera runtime, motion and tempo tests also pass. TypeScript and
scoped ESLint pass.

Run `node scripts/cinema2-assets/accept-nightshift-pan-room.mjs` for the native
browser check. Its 12 checks pass: real Inspector input edits, visible text on
all four sides, pause, restoring framing, persistence and render health. The
four side captures under `artifacts/cinema2-nightshift-pan-room/` were visually
reviewed. No browser, shader or render failures occurred. Live desktop playback
was not tested. Changes remain uncommitted; no commit was requested.
