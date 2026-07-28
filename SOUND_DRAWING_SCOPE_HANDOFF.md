# Sound Drawing Professional Scope — Handoff Brief

You are picking up an in-progress feature in the DRMVYZ repo. Everything below is
factual state, not aspiration. Read it fully before changing code.

**Branch:** `feat/sound-drawing-scope-signal-core` (14 commits ahead of `main`,
54 files, ~10,900 insertions). Pushed to origin.

---

## 1. START HERE — the mistake that cost the most

The previous agent (Claude) built this entire feature **without ever looking at
the user's reference recordings.** It worked from a written brief that named
Greyland Audio's Visual Lab Pro as a benchmark, and invented an aesthetic from
that description.

The actual references are on the user's Desktop: screen recordings of **physical
Leader oscilloscopes**, including an **LBO-5528H "Stereoscope"** (a hardware
stereo vectorscope), fed real music.

```
/Users/kodyrobinson/Desktop/Screen Recording 2026-07-27 at 11.43.21 AM.mov
/Users/kodyrobinson/Desktop/Screen Recording 2026-07-27 at 11.44.58 AM.mov
/Users/kodyrobinson/Desktop/Screen Recording 2026-07-27 at 11.45.31 AM.mov
/Users/kodyrobinson/Desktop/Screen Recording 2026-07-27 at 11.46.43 AM.mov
```

There is also a 2-minute recording of the user testing the current build:
`Screen Recording 2026-07-27 at 11.10.55 PM.mov`

**Filename gotcha:** macOS puts a narrow no-break space (U+202F) before AM/PM.
`ls "path with AM"` fails. Use a glob: `/Users/…/Screen*2026-07-27*11.43*.mov`.

**No ffmpeg on this machine.** To extract frames, compile a small Swift tool
against AVFoundation (`AVAssetImageGenerator`), load duration with
`try await asset.load(.duration)`, and write PNGs via `NSBitmapImageRep`. A
working version was used and is reproducible in ~40 lines.

### The target aesthetic, from the footage

- **Hairline trace.** One to two pixels of intensely bright core.
- **Tight glow.** The aura hugs the line within a few pixels. It is *not* an
  atmospheric wash.
- **Near-absolute black** background.
- **Large figure** filling most of the tube.
- Complex, jagged, dense on real music — but **legible**, a continuous curve.
- Brightness varies strongly along the curve where the beam dwells.

What was shipped before recalibration was a **neon sign**: a ~10px soft tube with
a wide diffuse halo. Wrong in kind, not degree.

**Do not trust any "verified" claim in the git history to mean "matches the
reference."** It means the maths was checked. Those are different claims and the
previous agent conflated them repeatedly.

---

## 2. What the user wants

A professional oscilloscope / vectorscope inside Sound Drawing that:

1. Looks like the Leader hardware in the reference footage.
2. Is genuinely correct — true synchronized stereo, real triggering, a real
   timebase — not a decorative approximation.
3. Ships to users. **The user's DJ name "DVYDRM" must not appear in any
   user-facing string.** It has been removed from all scope work; it still exists
   elsewhere in the app (window title, brand-kit palette constants) and sweeping
   that is a separate, unrequested job.
4. Does not regress the existing creative Sound Drawing systems (text, lyrics,
   SVG, scanner kinematics, authored performances, Music Intelligence).

The user is cost-sensitive and has been billed heavily for this session. **Batch
your verification. Do not run one-change-one-screenshot loops.**

---

## 3. Architecture as built

### Signal core — `src/audio/scope/` (GL-free, fully unit-tested)

| File | Role |
| --- | --- |
| `scopeTypes.ts` | All persisted state + defaults. Currently **version 5**. |
| `scopeStateNormalization.ts` | Normalizers + migrations, run unconditionally on load |
| `StereoScopeAudioTap.ts` | Owns the capture worklet, ring buffer, lifecycle |
| `StereoScopeRingBuffer.ts` | Synchronized L/R ring, resets on discontinuity |
| `ScopeChannelMatrix.ts` | Signal modes, mid/side, correlation |
| `ScopeSignalConditioner.ts` | DC block, gain, offset, invert, swap |
| `ScopeTrigger.ts` | Schmitt trigger, hysteresis, holdoff, continuity |
| `ScopePeriodEstimator.ts` | NSDF period detection with octave guarding |
| `ScopeTimebase.ts` | Window resolution, beat-relative, aliasing guard |
| `ScopeSignalCore.ts` | Orchestrator, auto-gain, produces `ScopeTrace` |
| `scopePresets.ts` | 15 factory presets in 3 groups |
| `scopeMusicMapping.ts` | MI → presentation multipliers |

Capture: `public/worklets/stereo-scope-processor.js` — one AudioWorklet reading
L and R from the **same render quantum**. This is the property a vectorscope needs
and that `analyserL`/`analyserR` cannot provide.

### GPU phosphor — `src/components/vyzualz/react/renderers/soundDrawing/`

| File | Role |
| --- | --- |
| `soundDrawingPhosphorPlan.ts` | HDR probe, persistence decay, bloom pyramid, quality tiers |
| `ScopePhosphorTargets.ts` | Render targets, ping-pong, feedback-loop assertions |
| `ScopePhosphorRuntime.ts` | Owns the WebGL2 context, executes the pass chain |
| `scopePhosphorShaders.ts` | All GLSL |
| `ScopePhosphorQualityController.ts` | Frame-timing hysteresis |
| `soundDrawingBeamPacking.ts` | `VectorBeamSegment[]` → `GeometryPass` layout |

Pass chain: beam emission (additive, HDR) → persistence (ping-pong) → bloom
levels (separable Gaussian, 2 passes each) → tone-mapped composite → optional CRT.

The runtime renders to an **offscreen canvas** composited into the existing Sound
Drawing 2D output via `drawImage` — the same boundary `WebGL2Renderer` uses for
CANVAS. This keeps `ReactPlaceholderCanvas` the center-stage owner, leaves the
recording canvas untouched, and makes Canvas2D the natural fallback.

### Reused engine infrastructure (do not reimplement)

`GeometryPass`, `ShaderFramebuffer`, `ShaderPingPongBuffer`, `ShaderProgram`,
`FullscreenPass`, `ShaderCapabilities`, `WebGLContextLifecycle`,
`soundDrawingBloom.ts` (bloom reference maths), `VectorBeamSegment` /
`VectorBeamRasterizer` (Canvas2D path).

**Both renderers consume one array.** `buildProfessionalScopeSegments` in
`SoundDrawingRenderer.ts` resolves the trace and beam optics once; Canvas2D
strokes it, the GPU path packs the same array. Falling back changes presentation,
never geometry. Preserve this.

---

## 4. Bugs already found and fixed — DO NOT REINTRODUCE

Each of these was a real defect discovered by arithmetic or by looking at the
screen. Unit tests passed throughout every one of them.

1. **HDR needs `EXT_float_blend`, not just renderability.** Beam emission blends
   additively into the HDR target. A device that renders float but can't blend
   into it must take the RGBA8 path or it fails at draw time.
2. **Emission must be scaled into the HDR band.** The beam profile peaks ~0.5
   after exposure and intensity terms — not high dynamic range at all. Reinhard
   returned a dim third of white and bloom barely triggered.
3. **Bloom extraction must happen per tap, inside the kernel.** Thresholding the
   blurred result against the destination fragment's brightness deletes the halo
   entirely — that brightness is zero exactly where the glow belongs.
4. **Bloom levels are independent, not cascaded.** Chaining compounds the
   averaging loss until the widest level is ~0.2% of the trace.
5. **The blur must be a separable Gaussian reaching ~3σ, striding ≤1 texel.** A
   single-radius ring kernel convolves with a circle (produced an 8-lobe rosette).
   A kernel truncated at 1.6σ is a box and gives a square halo. Striding >1 texel
   gives an axis-aligned lattice. Width comes from downsampling — **no bloom level
   runs at full resolution.**
6. **Persistence saturation must act on luminance, not per channel.** Per-channel
   saturation flattens the hue ratio to white on anything that accumulates.
7. **`params.intensity` must never scale figure size.** `computePathBaseScale` in
   `SoundDrawingRenderer.ts` states this rule; it was violated 300 lines away and
   shrank every figure to ~65%.
8. **Never decimate the window.** Resampling onto fewer points than samples makes
   consecutive plotted points uncorrelated on broadband material — the trace
   becomes straight chords across the figure. Clamp the window to the point
   budget instead.
9. **Auto-gain is required.** Without it a -12 dBFS master spans 11% of the tube.
10. **Trigger continuity must be judged in absolute capture-frame coordinates.**
    The window advances every frame, so within-window indices aren't comparable.
11. **Beat-relative timebase needs an aliasing cap.** A 250 ms eighth-note window
    holds ~55 cycles of a 220 Hz tone and collapses the figure.

---

## 5. Honesty rules baked into the design — preserve these

- **A mono-derived figure is never labelled a stereo measurement.** The legacy
  `lissajous` mode plotted one mono buffer half against the other; it migrated to
  `monoDelayXY`, which renders identically. Never promote old projects to
  `stereoXY`.
- **Measurement presets must not apply treatment that misrepresents the signal** —
  no bass-driven width, no curvature. `violatesMeasurementDiscipline()` asserts
  this and a test proves the check can fail.
- **Music Intelligence modulates presentation only** — glow, width, exposure,
  persistence. Never geometry, signal path, or trigger.
- **Phosphor models are named for the look**, not claimed as emulation of a
  specific tube. The graticule is a reference overlay, not calibrated measurement.
- **Flicker, vertical roll, and horizontal jitter are absent from the CRT settings
  shape entirely** — not shipped present-and-zeroed. Photosensitivity risk. The
  shader has no time uniform so they cannot be reintroduced by setting a value.
- **Capture is best-effort.** When AudioWorklet is unavailable the scope falls
  back to the legacy analyser waveform. GPU quality is never mandatory for engine
  availability.

## 6. State versions — the migration rule

Persisted under `OscillatorSettings.scope`, normalized on every load.

| Version | Adds | Migration |
| --- | --- | --- |
| 1 | Signal, conditioning, trigger, timebase | `lissajous` → `monoDelayXY`, identical render |
| 2 | CRT presentation | Defaults disabled |
| 3 | Beam + phosphor tuning | Defaults reproduce previously hardcoded values |
| 4 | Music Intelligence mapping | All amounts zero = identity |
| 5 | Auto-gain | **Deliberately changes appearance** |

Rule: *migrating forward must never change how an existing project looks.*
Version 5 is the documented exception, because the old behaviour was the defect.

---

## 7. OPEN ISSUES — what actually needs doing

### Highest priority: the aesthetic is unverified against the reference

The last two commits (`621fd47` recalibration, `08110c4` auto-gain +
no-decimation) were **written and pushed without any visual verification.** They
are reasoned fixes, not confirmed ones.

**Do this first:** pull the branch, load a real track in the Electron app, and
compare against the Leader footage. Expect the figure to fill most of the tube and
the trace to be a continuous curve rather than crossed chords. Then judge
character: hairline thickness, glow tightness, brightness.

Relevant knobs, all in `scopeTypes.ts` defaults and `scopePresets.ts`:
- `DEFAULT_SCOPE_BEAM.coreWidthPx` (currently 0.8), `haloScale` (2.4)
- `DEFAULT_SCOPE_PHOSPHOR.mediumBloom` (0.22), `wideBloom` (0.08)
- `HDR_EXPOSURE_SCALE` (6) in `ScopePhosphorRuntime.ts`
- `DEFAULT_SCOPE_SIGNAL_CONDITIONER.autoGainTarget` (0.82)

### Other open items

- **11 of 15 presets have never been viewed.** Only Laboratory Green, Stereo
  Phase, Neon Persistence, and Heavy Drop Vector were seen. All 15 pass structural
  tests but need eyes.
- **No visual regression suite.** The brief asked for pixelmatch golden images.
  Structural GPU tests exist instead (pass order, blend state, ping-pong safety,
  context loss, budgets). The repo already has a Playwright e2e harness including
  `src/test/e2e/pixGridGpuPixelReadback.spec.ts` — pixel readback of known-answer
  signals is probably better than golden files here.
- **`BEAM_PROFILE_EDGE_RESIDUAL` taper never visually confirmed.** The stock beam
  profile had ~3.5% of peak at the quad edge (a faint parallel band). A smoothstep
  taper was added; the fix is untested by eye.
- **CRT curvature + graticule interaction unreviewed** at non-zero curvature.
- **Accessibility:** control labelling in `SoundDrawingProScopeControls.tsx` has
  not been audited against the repo's conventions.

---

## 8. Pre-existing repo problems — NOT caused by this work

Verified against a clean `main` via `git stash`. Do not attribute these to the
scope work, and do not silently "fix" them as part of it.

- `src/components/vyzualz/react/pixGrid/__tests__/PixGridGpuRenderer.test.ts:187`
  — TS2550, `.at()` needs `es2022` lib. **This breaks `npm run build`**, which
  runs `tsc` before `vite build`. `npx vite build` alone succeeds.
- `npm run test` batch 1 fails on LaserDMX pattern-frame-cache tests.
- 3 node + 6 DOM failures in PixGrid / shader-panel / store suites.
- `npm run repo:hygiene` fails on tracked `coverage/` output.
- Lint error in `scripts/verify-pix-grid-screen-recording.mjs`.

---

## 9. Validation

```bash
npx tsc --noEmit                                    # clean except the PixGrid error above
npx eslint src/audio/scope src/components/vyzualz/react
npx vitest run --config vitest.node.config.ts src/audio/scope/ \
  src/components/vyzualz/react/renderers/soundDrawing/     # 259 tests
npx vitest run --config vitest.node.config.ts src/audio/ src/stores/ \
  src/components/vyzualz/react/renderers/                  # ~2749 pass, 3 pre-existing fail
```

Running the app: `npm run electron:dev` (spawns its own Vite on 127.0.0.1:5173
with `--strictPort`; free that port first). The app is behind a Supabase auth
gate with no dev bypass.

---

## 10. Contracts you must follow

- `AI_IMPLEMENTATION_CONTRACT.md` — reuse before adding; no parallel component
  systems, stores, renderers, or timing authorities. Read it.
- `docs/documentation-index.md`, then `docs/sound-drawing.md` — the latter has a
  full section on this feature that must be updated in the same patch as any
  behaviour change.
- Renderer lifecycle rules: no Zustand in animation loops, no second audio
  analysis path, per-frame state out of React, dispose what you own.

---

## 11. Suggested first moves

1. Extract frames from the four Leader reference videos and the user's test
   recording. Look at them before touching code.
2. Pull the branch, run the app with a real track, and capture the current state
   **in one batched pass** — all presets, one screenshot each, no code changes
   between.
3. Diff that against the reference character and produce a single calibration
   change set rather than iterating one number at a time.
4. Only then consider the visual regression suite, so it locks in a look that is
   actually right.

## Patch 2 control semantics

Scope state version 6 adds persisted `axisGainLinked` authoring metadata. It does not change `gainX`, `gainY`, or `pathScale`. Earlier projects derive link state from gain equality.

The primary size control is **Trace Size** (`pathScale`). Advanced **Post Auto-Gain Trim** retains the conditioner smoothing and independent axis calibration. X Trim is unavailable in waveform modes because their horizontal axis is timebase-driven.

**Stability Macro** intentionally writes Continuity and Period Assist together only when the user moves the macro. Advanced edits remain independent and produce Custom status.

Scope `presetId` is provenance. The UI derives Exact, Modified from Preset, Custom, or Unknown Legacy by comparing the normalized current state with the complete installed recipe. Reset restores the exact source recipe.

See [`docs/sound-drawing-control-ownership-and-provenance.md`](docs/sound-drawing-control-ownership-and-provenance.md) for generic React provenance, row/domain ownership, and versioned trail-lock precedence.
