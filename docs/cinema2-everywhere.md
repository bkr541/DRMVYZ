# EVERYWHERE

The reference is a wall of dark CRT cabinets, filled to the edges, with a much larger centre television and four tilted foreground sets. Cool cyan on one side of each cabinet and warm orange on the other reveal beveled bezels, knobs and vents. The 3D scene owns cabinet depth and parallax. Its individual flat picture planes use a mildly curved CRT image mapping with scanlines, corner falloff and restrained glass glare. An original ImageGen eye close-up, guided by the supplied artwork, is the idle signal. Cabinet geometry is authored in Three.js. The supplied image guides the colour, layout and subject of the screen content.

The default composition uses a frontal camera aimed at the centre cabinet, nine foreground CRTs, fifty staggered intermediate cabinets, and 247 overlapping rear cabinets. All three tiers have distinct depth; the rear layer has no intentional missing cells. The camera retains its vertical FOV on narrow previews (cover instead of fit-to-width); portrait and square views intentionally crop the sides instead of exposing empty background. For aspects above 1.9, the wall scales both transverse axes equally using the final render camera aspect, retaining depth separation and screen proportions. The wall contains 306 instanced cabinets with a fixed draw-call count. Normal cabinet seams remain, and user brightness/coverage controls still apply. The base camera is now at Z=14 with a 40° vertical FOV; the hero scale is 2.65. Motion Amount zero freezes eye choreography.

## Patterns and timing

| Pattern | Screen program |
| --- | --- |
| All Eyes | The hero and surrounding monitors hold a clear default signal, with slight exposure differences across the wall. |
| Signal Sweep | A broad band progresses from left to right across the cabinets. |
| Outward Pulse | The signal expands from the centre toward the outer sets. |
| Cross Cut | Opposing diagonals trade emphasis. |
| Channel Hold | Small banks take turns in a distinct held-exposure sequence. |
| Ghost Feed | Adjacent screens carry staggered signal dimming and gentle interference. |
| Static Switch | Two-beat channel switches, restrained snow, kick-driven horizontal jitter and high-frequency interference. |
| Retro Broadcast | Bar changes, warm phosphor color, stronger scanlines, horizontal channel banks. |
| Tape Tracking | Four-beat channel changes, VHS tracking band, snare-driven tearing and color drift, vertical channel banks. |
| Channel Mosaic | Bar changes, alternating cabinet-sized channel tiles and warm/cool color accents. |
| Signal Relay | Two-beat changes, radial channel banks, traveling signal wave and bass/drop-driven glow. |
| Midnight Replay | Four-bar changes, cool desaturated replay, central hero focus on builds and subtle grain. |

The canonical Pattern Change toggle starts off. Trigger offers the shared eleven choices and is visible when the saved toggle is on. Manual selection takes effect immediately, leaves Pattern Change at its saved setting and ignores the event already present on the edit frame. Auto Performance uses the shared Mood Conductor's effective choices while the music has a beat grid. Music never edits the manually assigned media, named pool contents, manual Pattern, colors or saved toggle. Build and drop envelopes modulate the current pattern.

BPM Sync uses the shared beat clock when host and preset sync are enabled. With sync off, picture programs use the clock's 120 BPM reference rate. Pattern triggers retain their musical identities. Idle has a stable readable image. Playing music brings progressive exposure motion. Pause holds motion and audio accents. Track changes, seeks, context restoration and re-entry reset transient state using shared transport sources.

## Default eye choreography

Every screen borrows the original eye texture; a preset-local shader displaces only the iris within a fixed eyelid aperture, reconstructs newly exposed sclera and warps actual eyelid pixels into a curved blink. The pose follows the existing pattern phase (no extra clock) and the same kick, snare, build, drop and vocal envelopes. All Eyes synchronizes left/right gazes, blinks and periodic upward rolls; Signal Sweep staggers blinks along X; Outward Pulse and Signal Relay propagate gaze from the centre; Cross Cut uses opposing gaze directions; Channel Hold and Channel Mosaic alternate groups; Ghost Feed and Midnight Replay use staggered blinks and rolls; Static Switch, Retro Broadcast and Tape Tracking have different gaze and blink cadences. Drops roll all eyes upward; builds converge toward a raised gaze. Motion Amount governs intensity, and paused playback holds the exact pose. Track/seek reset follows the existing pattern phase reset. The effect is a texture-based approximation rather than a rigged anatomical 3D eye. The eye is exclusive to the built-in source mode; selecting a single feed or pool suppresses it even during texture decoding; the original CRT effects, named pool selection and user media transforms are preserved. Span mode uses an expanded wall coordinate domain to cover the new rear composition.

## Authority and presentation

| Area | Authored control | Music and Director authority | Edit behavior |
| --- | --- | --- | --- |
| Master Controls | Motion Amount, BPM Sync, Auto Performance | Motion scales timing and reactive accents. The initial Auto Performance value follows System Settings. | Auto Performance and BPM Sync remain editable; Motion Amount locks with Auto Performance on. |
| Design / Cabinets | Screen Brightness, Screen Coverage, Cabinet Angle | Energy recruits visible screens, bass deepens the accent on large sets, the build tightens attention toward the hero, and a drop fans out across the wall. Vocal presence keeps the hero feed clear. | Locked with Auto Performance on. |
| Design / Pattern | Pattern, Pattern Change, Trigger | Shared pattern authority and canonical events. Kick and snare have independent brightness and scan accents. | Locked with Auto Performance on. |
| Design / Screen Media | Content Source, Media Layout, Media Fit, Pool Trigger, Content Motion, Scale Variation, Screen Power Choreography, Preserve Hero Readability | User controls the asset and choreographed, repeat or wall playback. The shared media runtime owns decoding, fit, opacity, scale, position and rotation. | The native Design lock applies to Design rows. Media selection/reset remain available in the standard left Source library; the Design group summarizes the live source and offers reset. Pool Trigger appears only for an active pool. |
| Effects | Bloom, Scanlines, Glass Glare | Peak adds bounded bloom. Highs and snare briefly accent screen scans. | Locked with Auto Performance on. |
| Palette | Background, Cabinet, Cool Rim, Warm Rim, Screen Tint | User owns all colors. | Always editable. |

The shared Mood Conductor increases Screen Coverage by up to 0.18 on activity and reduces it by up to 0.47 in silence (baseline 0.86, range 0.18–1). Brightness can gain 0.20 on activity (baseline 1.06, range 0–1.8). Peak adds up to 0.22 Bloom, silence subtracts up to 0.20 (baseline 0.34, range 0–1.2). All drives scale with Motion Amount. Shared Audio Intelligence publishes signals, Visual Director publishes build/drop meaning, Choreography routes bounded contributions, and the native renderer consumes them. Parameter State and the workspace session own authored state.

The left Source tab uses the existing Cinema 2.0 Media Source panel and Media Library browser. It accepts images, video and SVG. Selecting an item replaces the default eye feed through the existing media slot. The same media library supports search, collection/library navigation, and opening Media Manager. The native CRT material borrows the shared GPU texture and preserves its presentation. With an unassigned or cleared slot the packaged eye feed returns.

## Named media pools

Use Source → Media Library → Pools to create a named pool and Set Active. Click or right-click a compatible media card and choose Add to Pool → pool name. These are the same persisted pools and active-pool selection used by CANVAS, not a duplicate store. Activating a pool clears the manual screen feed and invalidates outstanding single-source requests; Make Active clears the active-pool selection and assigns that one asset. Deactivating the pool restores the built-in eyes, never the previous individual asset. Reset to Default Eyes clears both assignments without deleting library items. Images, SVG and videos are eligible; text entries are not rendered as CRT media. The pool resolves eligible items from the shared loaded library cache; if some saved items are not yet loaded, browse/load those items in the Media Library. Signed URLs are prepared only for selected channels.

The new Pool Trigger control defaults to Program cadence (table above; legacy programs use four bars). Override it with any of the existing eleven musical triggers when Auto Performance is off. Pool Trigger is independent of Pattern Change. Pattern changes and trigger changes do not consume the already-present event. The pool advances only on unique shared musical event identities during playback, holds during pause or zero motion, and holds in conductor silence with Auto Performance enabled. No timer, local detector, or second beat clock is introduced. Choreographed and repeat modes distribute up to three shared feeds across whole individual CRTs; Span the wall intentionally uses one common feed across the wall. For a larger pool, one channel is replaced per accepted event in pool order. A slow replacement retains the previous ready feed and coalesces intervening events. An active empty pool or failed initial feed displays dark CRT glass instead of bringing back eyes. The three transient media slots use the canonical media loader, video pause/loop and texture lifecycle inside the module's tracked resource scope; they are not serialized as authored state.

## Continuation / integration details

EVERYWHERE owns its own stable scene graph and capabilities. It does not inherit the Corridor preset's schema or rendering descriptions. The manifest IDs (`everywhere-root`, `everywhere-passage`, `everywhere-aim`, `everywhere-world`, `everywhere-camera`, `everywhere-cassettes`) are unchanged for saved presets.

The CRT screen shader composites transparent image/video/SVG pixels against dark CRT glass; eye sampling is gated by exclusive source mode. Contain is the default for logos and pools. Glass edges are anti-aliased with transparent depth-tested planes. The performance controller treats audio timeline revisions as discontinuities, resetting its phase and transient pattern state without editing saved controls.

The preset stays classified as a **reference** in the first-party catalog until a human approves its actual visual output. The existing `scripts/verify-cinema2-everywhere.mjs` is the intended browser/WebGL acceptance check; run `npm run test:cinema2-everywhere` and `npm run test:e2e:cinema2-everywhere` in the application repository with installed dependencies and a Playwright browser. Its output captures the twelve screen programs, playback and drop behavior, portrait framing, Inspector and Source library selection.

## Screen content and camera choreography

The twelve existing pattern IDs now also author per-screen scale, translation, rotation, signal distortion, vertical compression, power and pool channel via instanced attributes. Choreographed Distribution applies full independent transforms; Repeat uses restrained content motion; Span preserves continuous wall-space mapping while retaining power choreography. Preserve Hero Readability protects the central feed. Motion uses the same phase and musical envelopes as the default eyes; no separate media clock or per-television decoder is introduced.

The shared camera runtime supplies drift, tempo sway, lens breathing, smoothing and safety. Camera Motion, Camera Mode, Distance, Sway, Drop Impact, Roll, Zoom on Kick and Follow Screen Choreography are under Design / Camera. The shared choreography routes builds, drops, phrases and snare accents to real camera targets. Camera profiles are selected by the saved pattern (the shared rule conditions use authored parameters); automatic pattern changes still receive the common cinematic camera accents. The camera remains frontal and bounded, never orbits behind the wall. The wall no longer simulates movement by translating or rolling its entire geometry. Cabinet counts, camera envelopes and rendering performance should be visually benchmarked in the browser acceptance run.
