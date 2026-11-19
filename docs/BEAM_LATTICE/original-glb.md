# Beam Lattice — reference-video presentation

**Reference presentation checkpoint; extended by the [full native performance](performance.md).** The user withdrew Laser Loom, requested the original laser scene, then supplied `/Users/kodyrobinson/Desktop/Reference_vid.mov` as the appearance and movement reference. The prior external artifact view was rejected and is superseded by this presentation. Changes remain uncommitted.

## Reference analysis and resulting presentation

The recording is 40.0817 seconds, 1578×892 at 60 fps. Twenty checkpoints across the recording and sixteen source-clip poses were inspected. It shows a stationary view **inside** four beam banks, with fine yellow rays extending through every frame edge around a small dark central opening. As the original animation advances, the rays sweep into wide crossing shafts near the camera and return to the tunnel. Yellow/olive glow remains between the shafts. There is no mechanical environment or added sculpture.

The supplied `lasers_-_vj.glb` remains the source. Its four meshes, 800 triangles, node hierarchy, geometry/UVs and eight animation tracks are unchanged. The 10.4167-second `Animation` clip repeats at authored 1× speed. The file embeds neither the external viewer's camera nor its post-processing; simply playing it with the old inspection framing did not reproduce the video.

Presentation adjustments are deliberately scoped to Beam Lattice:

- Camera centred on the bank origin at [−0.021289, 0.286656, 0.82], looking along −Z, with a 154° vertical field of view. A comparison across depths and lens settings used the tunnel, approach and crossing checkpoints, including the clip times visible in the video's player.
- Private beam-mesh Y scale ×2 calibrates apparent shaft thickness near the camera; animated parent transforms and original geometry stay intact. It is reapplied from the baseline, never accumulated.
- A private neon-yellow emissive override matches the recording's yellow presentation. Source materials and GLB bytes remain unchanged.
- A 2× scene render target improves coverage of thin geometry. Shared HDR bloom supplies the yellow spill (intensity 0.9, threshold 0.1, spread 0.85, seven high-tier levels). The background is black; the visible olive atmosphere comes from bloom. No replacement background image, new environment geometry or beam paths are used.

This is a visual match to the supplied viewer recording, not a claim of identical external-viewer shaders or encoded pixels. Source animation timing stays unchanged; the video player overlay is not reproduced. Small differences in sampling, halo falloff and compressed-video appearance may remain. Final appearance acceptance belongs to the user.

## Timing and ownership

The bridge passes original clips to the optional model-controller attachment. Only Beam Lattice opts into playback; other assets do not autoplay. The existing shared `Cinema2ThreeAnimationController` evaluates canonical transport seconds for source-present playback, including seek/loop. Idle playback advances at authored speed using shared frame delta; pause holds. The controller releases mixer caches and the shared bridge/cache retain asset resource ownership. Private mesh-width scaling does not edit source geometry or the animation clip.

Stable name/ID remain Beam Lattice / `drmvyz.cinema2.crate-beam-lattice`. This document describes the reference presentation. The subsequent full-performance implementation adds geometry programs, audio/choreography and Auto/Mood controls while retaining it as the default. Camera motion remains fixed to the reference. The user's specified original/reference scope supersedes the cancelled Laser Loom plan and its future Pattern library.

Source SHA-256: `b2dd79d39bc3caee20898bf0f863a2327b9fca8bef7b4558f8091c0fe1979e87`.

## Validation and evidence

Five focused checks pass: manifest/source identity, unchanged source-animation pose parity, idle pause/resume, nonaccumulating private-width calibration, and scoped crate registration. TypeScript and focused ESLint pass. Earlier shared Three scene and animation-controller checks passed (26 checks); the optional clip-delivery API is unchanged in this revision.

Production-canvas checks verify four source meshes, zero added geometry, eight original tracks, calibrated private width, actual yellow geometry at all four edges, a visibly brighter crossing phase, clip motion and exact loop return, pause/seek, context restoration and zero remaining leases/surfaces. No broad asset-copy validation was rerun.

Evidence: [reference comparison](evidence/reference-comparison.webp), [tunnel](evidence/reference-render-tunnel.webp), [crossing](evidence/reference-render-burst.webp), [acceptance record](evidence/reference-acceptance.json). The earlier `original-*` evidence documents the rejected external view and is retained only as history. The thumbnail now comes from the updated production render.

Reproduce with `node scripts/run-cinema2-beam-lattice-browser.mjs`; append `--preview` for a complete 8 fps checkpoint sequence. `PLAYWRIGHT_BASE_URL` selects the local dev server. No commit requested.
