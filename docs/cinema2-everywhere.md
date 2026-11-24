# EVERYWHERE

The reference is a wall of dark CRT cabinets, filled to the edges, with a much larger centre television and four tilted foreground sets. Cool cyan on one side of each cabinet and warm orange on the other reveal beveled bezels, knobs and vents. The 3D scene owns cabinet depth and parallax. Its individual flat picture planes use a mildly curved CRT image mapping with scanlines, corner falloff and restrained glass glare. An original ImageGen eye close-up, guided by the supplied artwork, is the idle signal. Cabinet geometry is authored in Three.js. The supplied image guides the colour, layout and subject of the screen content.

The default composition uses a frontal camera aimed at the centre cabinet, a staggered wall of smaller sets, and five prominent CRTs including the centre hero. The wall fills the 16:9 frame. Square and portrait framing retain the complete hero picture and reveal a different crop of the surrounding wall. Camera motion is bounded to the front of the wall. For a static idle shot, set Motion Amount to zero.

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

## Authority and presentation

| Area | Authored control | Music and Director authority | Edit behavior |
| --- | --- | --- | --- |
| Master Controls | Motion Amount, BPM Sync, Auto Performance | Motion scales timing and reactive accents. The initial Auto Performance value follows System Settings. | Auto Performance and BPM Sync remain editable; Motion Amount locks with Auto Performance on. |
| Design / Cabinets | Screen Brightness, Screen Coverage, Cabinet Angle | Energy recruits visible screens, bass deepens the accent on large sets, the build tightens attention toward the hero, and a drop fans out across the wall. Vocal presence keeps the hero feed clear. | Locked with Auto Performance on. |
| Design / Pattern | Pattern, Pattern Change, Trigger | Shared pattern authority and canonical events. Kick and snare have independent brightness and scan accents. | Locked with Auto Performance on. |
| Design / Screen Media | Screen Media, Media Layout, Pool Trigger | User controls the asset and repeat versus wall playback. The shared media runtime owns decoding, fit, opacity, scale, position and rotation. | The native Design lock applies to Design rows. Media selection uses the standard left Source library. |
| Effects | Bloom, Scanlines, Glass Glare | Peak adds bounded bloom. Highs and snare briefly accent screen scans. | Locked with Auto Performance on. |
| Palette | Background, Cabinet, Cool Rim, Warm Rim, Screen Tint | User owns all colors. | Always editable. |

The shared Mood Conductor increases Screen Coverage by up to 0.18 on activity and reduces it by up to 0.47 in silence (baseline 0.86, range 0.18–1). Brightness can gain 0.20 on activity (baseline 1.06, range 0–1.8). Peak adds up to 0.22 Bloom, silence subtracts up to 0.20 (baseline 0.34, range 0–1.2). All drives scale with Motion Amount. Shared Audio Intelligence publishes signals, Visual Director publishes build/drop meaning, Choreography routes bounded contributions, and the native renderer consumes them. Parameter State and the workspace session own authored state.

The left Source tab uses the existing Cinema 2.0 Media Source panel and Media Library browser. It accepts images, video and SVG. Selecting an item replaces the default eye feed through the existing media slot. The same media library supports search, collection/library navigation, and opening Media Manager. The native CRT material borrows the shared GPU texture and preserves its presentation. With an unassigned or cleared slot the packaged eye feed returns.

## Named media pools

Use Source → Media Library → Pools to create a named pool and Set Active. Click or right-click a compatible media card and choose Add to Pool → pool name. These are the same persisted pools and active-pool selection used by CANVAS, not a duplicate store. The active pool takes precedence over the manual screen feed; Make Active on a media card clears the shared active-pool selection and assigns that one asset. Deactivate the pool to return to the prior manual feed (or packaged eye). Images, SVG and videos are eligible; text entries are not rendered as CRT media. The pool resolves eligible items from the shared loaded library cache; if some saved items are not yet loaded, browse/load those items in the Media Library. Signed URLs are prepared only for selected channels.

The new Pool Trigger control defaults to Program cadence (table above; legacy programs use four bars). Override it with any of the existing eleven musical triggers when Auto Performance is off. Pool Trigger is independent of Pattern Change. Pattern changes and trigger changes do not consume the already-present event. The pool advances only on unique shared musical event identities during playback, holds during pause or zero motion, and holds in conductor silence with Auto Performance enabled. No timer, local detector, or second beat clock is introduced. Repeat mode distributes up to three shared feeds across whole individual CRTs; Span the wall intentionally uses one common feed across the wall. For a larger pool, one channel is replaced per accepted event in pool order. A slow replacement retains the previous ready feed and coalesces intervening events. A missing/empty pool or failed initial feed falls back to the manual slot or packaged eye. The three transient media slots use the canonical media loader, video pause/loop and texture lifecycle inside the module's tracked resource scope; they are not serialized as authored state.

## Continuation / integration details

EVERYWHERE owns its own stable scene graph and capabilities. It does not inherit the Corridor preset's schema or rendering descriptions. The manifest IDs (`everywhere-root`, `everywhere-passage`, `everywhere-aim`, `everywhere-world`, `everywhere-camera`, `everywhere-cassettes`) are unchanged for saved presets.

The CRT screen shader alpha-blends transparent image/video pixels over the packaged eye, respecting the standard Source panel opacity and fit. Glass edges are anti-aliased with transparent depth-tested planes. The performance controller treats audio timeline revisions as discontinuities, resetting its phase and transient pattern state without editing saved controls.

The preset stays classified as a **reference** in the first-party catalog until a human approves its actual visual output. The existing `scripts/verify-cinema2-everywhere.mjs` is the intended browser/WebGL acceptance check; run `npm run test:cinema2-everywhere` and `npm run test:e2e:cinema2-everywhere` in the application repository with installed dependencies and a Playwright browser. Its output captures the twelve screen programs, playback and drop behavior, portrait framing, Inspector and Source library selection.
