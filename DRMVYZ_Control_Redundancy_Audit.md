# DRMVYZ Full Control-Redundancy and Duplicate-Behavior Audit

**Repository audited:** `DRMVYZ-main - 2026-07-28T034820.535.zip`  
**Audit mode:** Read-only code trace. No repository files were edited. Temporary numerical checks were run outside the repository.  
**Authority:** The uploaded repository was treated as the source of truth.

## Executive Summary

### Finding totals

- **23 confirmed findings**
- **3 probable perceptual redundancies requiring rendered-frame validation**
- **13 important pairs or duplicate surfaces confirmed as correctly distinct or intentionally mirrored**

### Distribution by area

| Area | Confirmed findings |
|---|---:|
| PixGrid | 9 |
| Sound Drawing / Pro Scope | 6 |
| LaserDMX | 3 |
| Shader Pads | 1 |
| CANVAS | 1 |
| Cinematic Worlds | 1 |
| Global presets and appearance contracts | 2 |

### Highest-risk issues

1. **LaserDMX React Master Intensity and Master Glow are dead on the normal WebGL path but live in Canvas2D fallback.** This is a backend-dependent control contract failure.
2. **PixGrid Starting Quality disables Adaptive Quality.** The label and handler directly contradict each other.
3. **PixGrid Program selectors have different scopes.** One loads an entire React preset; the other changes only the performance program.
4. **PixGrid has three exact intensity multipliers and two exact glow addends.**
5. **Shader master controls are exposed for scenes that do not consume them.**
6. **Sound Drawing Trails lock does not preserve the value a user reasonably expects it to lock.**

### Controls that appear to work but are ignored

- LaserDMX `Master Intensity` and `Master Glow` on WebGL.
- Shader scene-specific dead masters:
  - Prism Tunnel: generic Master Glow.
  - Liquid Metaballs: generic Master Glow.
  - Brand Echo Signal: generic Motion.
  - Laser Lattice Overdrive: generic Bass React.
  - Melodic Rift Bloom: generic Bass React.
- Legacy theme/appearance state has no current React runtime consumer.

### Proven mathematical identity or product redundancy

- Pro Scope settled `Input Gain` and `Visual Size`.
- Laser Canvas2D `Master Intensity` and Beam Matrix `Master Dimmer`.
- Laser Canvas2D `Master Glow` and Beam Matrix `Global Glow`.
- PixGrid React Intensity, Global PixGrid Intensity, and Cell Brightness.
- PixGrid React Glow and local Glow.
- CANVAS Opacity and Source Visibility for base source alpha, with a limited particle-specific distinction.

### Duplicate information and exposure

- Pro Scope preset identity remains displayed after manual divergence.
- Generic preset cards remain active after global manual edits.
- PixGrid presentation, performance, and route settings appear in multiple places with different side effects.
- PixGrid diagnostics are repeated at compact and advanced density.
- Cinematic Auto Director is represented both as Camera Mode and an enable toggle on the same field.

## Method and Verification

The audit traced each finding through:

`React component -> handler -> Zustand/settings state -> normalization/migration -> runtime/compiler -> renderer/shader -> final result`

### Focused numerical checks performed

A standalone deterministic sweep reproduced the traced formulas without changing repository code:

| Check | Result |
|---|---:|
| Pro Scope X/Y, Gain 2 x Size 1 versus Gain 1 x Size 2 | `0 px` maximum delta |
| Pro Scope waveform vertical amplitude, same product swap | `0 px` maximum delta |
| First frame after conditioner gain step 1 to 2 | effective gain `1.35`, confirming smoothing |
| PixGrid equivalent intensity product tuples | `0` scalar delta |
| PixGrid swapped Glow addends | `0` scalar delta |
| Laser swapped global intensity factors | `0` scalar delta |
| Laser swapped global glow factors | `0` scalar delta |
| PixGrid Adaptive Draft | effective Low, `96 x 54` |
| PixGrid Fixed Draft | effective Draft, `64 x 36` before Canvas fallback promotion |

### Test execution limitation

The repository declares Vitest `^3.2.6`, but the uploaded `node_modules` does not contain the Vitest package or executable. Network-backed installation was not used. Existing test files were inspected, including scope, PixGrid adaptive quality, preset, Cinematic, Laser, Canvas, and renderer tests, but the full Vitest suite could not be executed in this sandbox. Browser image regression was therefore not claimed.

## Confirmed Redundancies


### F-01 - Pro Scope Input Gain and Visual Size collapse into the same steady-state trace scale

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Sound Drawing > Pro Scope top controls, plus React FX > Drawing Size. |
| **2. Control names** | `Input Gain`; `Visual Size`. |
| **3. Source file and component** | `src/components/vyzualz/react/soundDrawing/SoundDrawingProScopeControls.tsx:137-144`; `src/components/vyzualz/react/ReactFxPanel.tsx:171-184`. |
| **4. State field or fields** | `osc.scope.signalConditioner.gainX`, `gainY`; `osc.pathScale`. |
| **5. Update handler** | Input Gain calls `patchConditioner({ gainX: v, gainY: v })`; Visual Size calls `set({ pathScale: v })`. |
| **6. Normalization or migration** | Gain is independently clamped to `0.01..16` by `src/audio/scope/scopeStateNormalization.ts:77-92`; Visual Size is clamped to `0.1..2.5` by `src/components/vyzualz/react/soundDrawing/SoundDrawingVisualSize.ts:3-15`. |
| **7. Runtime consumer** | Auto Gain is applied first, then the signal conditioner multiplies samples by gain in `src/audio/scope/ScopeSignalCore.ts:215-235` and `ScopeSignalConditioner.ts:67-100,112-139`. |
| **8. Renderer, shader, compiler, or audio effect** | `src/components/vyzualz/react/renderers/SoundDrawingRenderer.ts:1357-1369` converts `pathScale` into `scalePx`; `soundDrawingScopeGeometry.ts:103-134` multiplies conditioned samples by `scalePx`. |
| **9. Mathematical or logical relationship** | For X/Y modes: `xScreen = centerX + xRaw * autoGainX * gainX * pathScale * viewportScale`; `yScreen = centerY - yRaw * autoGainY * gainY * pathScale * viewportScale`. For waveform modes, the same product controls vertical amplitude while the timebase owns horizontal width. Equivalent gain/size products therefore produce identical settled geometry. |
| **10. Classification** | Fully redundant for steady-state visible scale; partially distinct only during live adjustment because gain is smoothed by 35 percent per frame while Visual Size is immediate. |
| **11. User-visible consequence** | Users receive two apparent size controls. A project can store different values that produce the same picture, and automation can fight over a single perceptual dimension. |
| **12. Severity** | High. |
| **13. Recommended correction** | Expose one primary `Trace Size` control. Preserve gain as an Advanced `Post Auto-Gain Trim`, or add a link model and show the resolved product. Do not delete either stored field initially. |
| **14. Migration or compatibility risk** | Medium. Scope presets and saved projects persist all three fields. Any external automation keyed to `gainX`, `gainY`, or `pathScale` would need aliases. No field-specific MIDI contract was proven in the audited React path. |
| **15. Tests needed** | Add matched-product geometry tests in X/Y and waveform modes, Auto Gain on/off tests, and a transient test proving gain easing versus immediate path scale. The standalone sweep in this audit produced `0` maximum pixel delta for equivalent settled products. |

### F-02 - Pro Scope Input Gain is a misleading linked master for independently editable X and Y gains

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Sound Drawing > Pro Scope, top level and Signal Conditioning advanced section. |
| **2. Control names** | `Input Gain`; `X Gain`; `Y Gain`. |
| **3. Source file and component** | `SoundDrawingProScopeControls.tsx:137-144,500-515`. |
| **4. State field or fields** | All three UI rows address `scope.signalConditioner.gainX` and `gainY`. |
| **5. Update handler** | Input Gain reads only `gainY` and writes both axes. X Gain and Y Gain write one axis each. |
| **6. Normalization or migration** | Both fields are independently preserved and clamped by `scopeStateNormalization.ts:77-92`. |
| **7. Runtime consumer** | The conditioner consumes the axes independently in X/Y modes, while waveform modes intentionally consume only Y gain for both channel traces in `ScopeSignalConditioner.ts:81-99,103-139`. |
| **8. Renderer, shader, compiler, or audio effect** | Scope geometry consumes the already-conditioned X and Y arrays in `soundDrawingScopeGeometry.ts:119-133`. |
| **9. Mathematical or logical relationship** | The top control is not a third parameter. It is a link operation: `gainX = gainY = v`. Once X and Y differ, its displayed value represents only Y, and touching it silently destroys the unlinked ratio. |
| **10. Classification** | Intentional linked master, but misleading duplicate exposure and missing mixed-state semantics. |
| **11. User-visible consequence** | A user can carefully set an asymmetric vectorscope scale, then erase it by touching Input Gain without any indication that the axes were re-linked. |
| **12. Severity** | Medium. |
| **13. Recommended correction** | Rename to `Linked X/Y Gain`, add a link toggle, show a mixed value when axes differ, and hide or disable the linked master while unlinked. |
| **14. Migration or compatibility risk** | Low. No state migration is required because `gainX` and `gainY` remain canonical. |
| **15. Tests needed** | Preset with unequal gains, mixed-state rendering, link/unlink round trip, and waveform mode verification that X Gain is intentionally inactive. |

### F-03 - Trigger Stability silently writes two different trigger algorithms

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Sound Drawing > Pro Scope top controls. |
| **2. Control names** | `Trigger Stability`, internally `continuityWeight` and `periodAssist`. |
| **3. Source file and component** | `SoundDrawingProScopeControls.tsx:146-151`; trigger implementation `src/audio/scope/ScopeTrigger.ts:205-253`. |
| **4. State field or fields** | `scope.trigger.continuityWeight`; `scope.trigger.periodAssist`. |
| **5. Update handler** | The single slider reads `continuityWeight` and writes `{ continuityWeight: v, periodAssist: v }`. |
| **6. Normalization or migration** | The two fields are independently normalized in `scopeStateNormalization.ts:116-117`. Scope presets can intentionally give them different values, including `0.85` and `0.9` in `scopePresets.ts:152`. |
| **7. Runtime consumer** | `periodAssist` weights phase-period error, while `continuityWeight` weights drift from the prior within-window trigger position in `ScopeTrigger.ts:215-243`. |
| **8. Renderer, shader, compiler, or audio effect** | The selected trigger position changes the capture window sent to all scope renderers. |
| **9. Mathematical or logical relationship** | These are not mathematically identical. The UI combines two distinct costs into one macro, reads only one, and re-links them on edit. |
| **10. Classification** | Misleading compound control; partially redundant UI abstraction, not redundant runtime behavior. |
| **11. User-visible consequence** | Preset-authored differences are invisible. Moving the slider changes two stabilization strategies at once and can make a trace behave differently from the displayed value alone. |
| **12. Severity** | Medium. |
| **13. Recommended correction** | Label it `Stability Macro`, show that it controls continuity and period lock, and expose both values in Advanced. Use mixed/custom status when they differ. |
| **14. Migration or compatibility risk** | Low. Preserve both trigger fields and preset values. |
| **15. Tests needed** | Candidate sets with known period confidence, separate continuity-only and period-only sweeps, preset divergence round trip, and macro relink behavior. |

### F-04 - Pro Scope preset identity remains selected after manual edits

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Sound Drawing > Pro Scope preset row and every editable subsection below it. |
| **2. Control names** | `Preset` plus all Pro Scope manual controls. |
| **3. Source file and component** | `SoundDrawingProScopeControls.tsx:47-74,103-118`. |
| **4. State field or fields** | `scope.presetId` plus the full mutable scope object. |
| **5. Update handler** | Preset selection replaces scope with `resolveScopePresetState(v)`. Every patch helper mutates nested scope state but leaves `presetId` unchanged. |
| **6. Normalization or migration** | `presetId` is preserved as a string by `scopeStateNormalization.ts:237`, independently of whether current values still match the preset. |
| **7. Runtime consumer** | The renderer consumes current scope fields, not a fresh preset resolution, so manual edits do take effect. |
| **8. Renderer, shader, compiler, or audio effect** | All Pro Scope signal and presentation consumers receive the modified state while the preset description remains displayed. |
| **9. Mathematical or logical relationship** | The identity is provenance, but the UI presents it as an exact current selection. There is no dirty comparison or `Custom from preset` state. |
| **10. Classification** | Preset versus manual duplication with stale status. |
| **11. User-visible consequence** | The UI claims a named preset is active even when its values no longer match, making reproduction and bug reports unreliable. |
| **12. Severity** | Medium. |
| **13. Recommended correction** | Keep `presetId` as provenance, derive `modified`, and display `Custom from <preset>`. Reset should restore the exact preset. |
| **14. Migration or compatibility risk** | Low. Add derived UI state rather than changing persisted schema. |
| **15. Tests needed** | Select each preset, edit every scope subsystem, verify modified status, reset, save/reload, and migration of legacy preset IDs. |

### F-05 - Sound Drawing Trails lock does not preserve the manual Trail Decay value

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Sound Drawing > Authored Performance > Parameter Locks > Trails, compared with React FX > Trail Decay. |
| **2. Control names** | `Trails` lock; `Trail Decay`; Ribbon Trail controls. |
| **3. Source file and component** | UI `ReactEnginePanel.tsx:800-835`; runtime `SoundDrawingPerformanceEngine.ts:839-944`; final composition `SoundDrawingRenderer.ts:2975-2991`. |
| **4. State field or fields** | `soundDrawingPerformanceSettings.locks.trail`; `reactTrailDecay`; oscillator auto-section mode; ribbon trail settings. |
| **5. Update handler** | The lock toggles a Boolean. Trail Decay writes `reactTrailDecay`. |
| **6. Normalization or migration** | Performance settings are normalized separately from the global React trail scalar; no snapshot of the manual decay is stored in the lock. |
| **7. Runtime consumer** | When locked, global persistence is replaced with hard-coded `0.92` or `0.8` based on `autoSectionMode`, then Ribbon Trails may replace it again. User Trail Intensity later rescales persistence. |
| **8. Renderer, shader, compiler, or audio effect** | Final decay is `((1 - authoredPersistence) * 0.28 + params.trailDecay * 0.04) / trailDetail`, clamped to `0.02..0.32`. |
| **9. Mathematical or logical relationship** | The lock does not mean `preserve my Trail Decay`. It restores a recipe constant, and the visible Trail Decay remains only a small additive term. |
| **10. Classification** | Mislabeled and partially overridden control ownership. |
| **11. User-visible consequence** | A user can lock Trails and still see a different decay than the manual value, especially with Ribbon Trails or Auto Section mode. |
| **12. Severity** | High. |
| **13. Recommended correction** | Either snapshot and restore the actual manual resolved trail state, or rename the lock to `Protect Performance Trail Recipe` and visibly show which trail factors remain live. |
| **14. Migration or compatibility risk** | Medium. Changing lock semantics can alter saved shows. Version the lock behavior or preserve legacy semantics for old projects. |
| **15. Tests needed** | Auto Performance on/off; lock on/off; autoSectionMode variants; Ribbon Trails precedence; Trail Intensity and Trail Decay sweeps; seek/reset persistence. |

### F-06 - Auto Performance shadows manual Sound Drawing controls without showing ownership per row

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Sound Drawing Engine panel while Auto Performance is enabled. |
| **2. Control names** | Performance Show, Auto Performance, source, transforms, glow, trails, reactions, and locks. |
| **3. Source file and component** | UI `ReactEnginePanel.tsx:448-475,800-847`; precedence contract `SoundDrawingPerformanceEngine.ts:1094-1105`. |
| **4. State field or fields** | Manual oscillator/settings state plus resolved performance program state and lock map. |
| **5. Update handler** | Manual controls continue writing their normal stores. Only explicit locks reassert selected manual domains. |
| **6. Normalization or migration** | Performance and manual settings are normalized independently; no UI-level disabled state is derived from current ownership. |
| **7. Runtime consumer** | Actual precedence is authored scene/cadence, routes, event envelopes, user intensity controls, explicit locks, and safety clamps. |
| **8. Renderer, shader, compiler, or audio effect** | Renderer receives the resolved performance frame, not necessarily the visible manual control values. |
| **9. Mathematical or logical relationship** | Controls are distinct when Auto Performance is off or locked, but can be shadowed while still looking editable. |
| **10. Classification** | Mode-dependent shadowing, not dead state. |
| **11. User-visible consequence** | A slider can move numerically with little or no output change, making the app feel broken and obscuring Performance Show ownership. |
| **12. Severity** | Medium. |
| **13. Recommended correction** | Annotate or disable rows owned by the performance program, show `Program`, `Manual`, or `Locked` ownership, and show the resolved live value beside the authored value. |
| **14. Migration or compatibility risk** | Low for UI-only ownership indicators. Higher if precedence changes. |
| **15. Tests needed** | For every lock domain, edit while unlocked and locked, verify resolved runtime values, seek determinism, and program switch behavior. |

### F-07 - Generic React presets remain highlighted after manual master edits

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Presets panel and React FX master controls across non-Cinematic engines. |
| **2. Control names** | Preset card plus Intensity, Motion, Glow, Bass React, Trail Decay, Fog Density, and Particle Density. |
| **3. Source file and component** | Preset application `src/stores/reactStore.ts:1732-1751,5009-5026`; manual setters `reactStore.ts:5035-5041`; UI status `ReactPresetsPanel.tsx:617-637`, `ReactPresetBrowser.tsx:23-35`, `ReactPresetCard.tsx:133-144`. |
| **4. State field or fields** | `activeReactPresetId` and React-wide scalar fields. |
| **5. Update handler** | Preset selection sets both ID and values. Manual setters change values but do not clear the ID or mark it modified. |
| **6. Normalization or migration** | No generic derived comparison exists. `modifiedIds` is built only from Cinematic config overrides. |
| **7. Runtime consumer** | Renderers consume the modified scalar values, so the output diverges from the highlighted preset. |
| **8. Renderer, shader, compiler, or audio effect** | All affected engine renderers receive current React params. |
| **9. Mathematical or logical relationship** | Preset identity is treated as exact selection in the browser while functioning as stale provenance in runtime state. |
| **10. Classification** | Preset versus manual stale status and duplicate information exposure. |
| **11. User-visible consequence** | Preset cards can falsely imply reproducible preset values. Cinematic and Canvas already provide better modified-state precedents. |
| **12. Severity** | Medium. |
| **13. Recommended correction** | Add engine-neutral dirty comparison or a provenance model: `activePresetId` plus `modifiedFromPreset`. Never silently clear provenance. |
| **14. Migration or compatibility risk** | Medium. Preset automation and Track Map cues depend on stable preset IDs. The fix should not replace or clear IDs during playback. |
| **15. Tests needed** | Select preset, edit every master, return values to exact preset, Track Map cue application, automation crossing, save/reload, and engine switch. |

### F-08 - LaserDMX React Master Intensity and Master Glow are ignored by the normal WebGL path

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | LaserDMX > React Master. |
| **2. Control names** | `Master Intensity`; `Master Glow`. |
| **3. Source file and component** | Capability declaration `reactFxMasterControls.ts:9-19`; UI `ReactFxPanel.tsx:82-99`; renderer split `LaserDmxRenderer.ts:612-618,700-734,831-879,982-999`. |
| **4. State field or fields** | React-wide `reactIntensity` and `reactGlow` passed through `ReactRenderParams`. |
| **5. Update handler** | Global React setters update the scalar fields. |
| **6. Normalization or migration** | Values are bounded by the control/store path, but are not folded into the WebGL scene frame. |
| **7. Runtime consumer** | The WebGL branch calls `webglRuntime.render(sceneFrame)` and returns. Canvas2D fallback explicitly passes `params.intensity` and `params.glow`. |
| **8. Renderer, shader, compiler, or audio effect** | Canvas beam/scanner renderers consume both masters; WebGL consumes Beam Matrix output fields but not these React masters. |
| **9. Mathematical or logical relationship** | Backend-dependent dead controls. The same UI values work only after WebGL failure or forced fallback. |
| **10. Classification** | Dead on WebGL, live on Canvas2D, and therefore conditionally overridden by backend selection. |
| **11. User-visible consequence** | Users can move the controls with no result on healthy systems, then see a sudden brightness/glow change during renderer fallback. |
| **12. Severity** | Critical for control trust; High for visual consistency. |
| **13. Recommended correction** | Resolve React masters into the backend-neutral scene frame before the branch, or remove them from LaserDMX and retain only Beam Matrix controls. Do not maintain different semantics per backend. |
| **14. Migration or compatibility risk** | High. Existing WebGL projects currently ignore these fields; activating them changes output. Use compatibility defaults or a versioned renderer contract. |
| **15. Tests needed** | WebGL and Canvas2D parity at 0, 0.5, and 1; forced context loss; saved projects with non-default masters; blackout and hardware output isolation. |

### F-09 - Laser Master Intensity and Beam Matrix Master Dimmer are interchangeable output multipliers on Canvas2D

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | LaserDMX > React Master and Output Styling. |
| **2. Control names** | `Master Intensity`; `Master Dimmer`; `Safety Clamp` also contributes to the product. |
| **3. Source file and component** | UI `ReactFxPanel.tsx:82-88,254-258`; compiler `renderers/LaserDmxBeamMatrixCompiler.ts:624-633,859-864`; Canvas renderer `LaserDmxBeamMatrixRenderer.ts:415-426,450-494`. |
| **4. State field or fields** | `reactIntensity`; `laserDmxBeamMatrix.output.masterDimmer`; `safetyClamp`. |
| **5. Update handler** | Separate React master and Beam Matrix output setters. |
| **6. Normalization or migration** | Each is independently clamped to `0..1`. |
| **7. Runtime consumer** | Compiler produces `beamDimmer * safetyClamp * masterDimmer`; Canvas presentation multiplies compiled beam intensity by React `intensityScale`. |
| **8. Renderer, shader, compiler, or audio effect** | Canvas2D beam bodies, cores, and cones use `beam.intensity * intensityScale`. WebGL receives Master Dimmer but not React Master Intensity. |
| **9. Mathematical or logical relationship** | Canvas equation: `finalIntensity = beamDimmer * safetyClamp * masterDimmer * reactMasterIntensity * gates`. Swapping the two master factors leaves output unchanged before clamping. |
| **10. Classification** | Conditional mathematical redundancy plus backend inconsistency. |
| **11. User-visible consequence** | Two global brightness knobs compete for the same result in fallback, but only one works in WebGL. |
| **12. Severity** | High. |
| **13. Recommended correction** | Define explicit scopes: `Show Dimmer` for authored show state and `Preview Output Trim` for app-level monitoring. Show the resolved product, and make both backends consume the same hierarchy. |
| **14. Migration or compatibility risk** | Medium to High. Preserve both persisted fields and automation targets; changing labels is safe, changing multiplication order or WebGL use is behavioral. |
| **15. Tests needed** | Equivalent product tuples, clamp boundary cases, strobe/gate interactions, WebGL parity, and Track Map/Performance Show automation. |

### F-10 - Laser Master Glow and Beam Matrix Global Glow are interchangeable glow multipliers on Canvas2D

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | LaserDMX > React Master and Global Beam. |
| **2. Control names** | `Master Glow`; `Global Glow`. |
| **3. Source file and component** | UI `ReactFxPanel.tsx:93-99,261-264`; compiler `LaserDmxBeamMatrixCompiler.ts:627-633,904-905`; Canvas renderer `LaserDmxBeamMatrixRenderer.ts:415-426,455-483`; scene frame `renderers/laserDmx/LaserDmxSceneFrame.ts:1260-1266`. |
| **4. State field or fields** | `reactGlow`; `laserDmxBeamMatrix.output.globalGlow`; per-beam glow. |
| **5. Update handler** | Separate setters. |
| **6. Normalization or migration** | All glow factors are clamped to `0..1`. |
| **7. Runtime consumer** | Compiler computes `beamGlow * globalGlow`; Canvas renderer multiplies the result by React `glowScale`. |
| **8. Renderer, shader, compiler, or audio effect** | Canvas glow and body passes consume the product. WebGL receives `globalGlow` only. |
| **9. Mathematical or logical relationship** | Canvas equation: `effectiveGlow = beamGlow * globalGlow * reactMasterGlow`. The two global factors are commutative and perceptually identical before saturation. |
| **10. Classification** | Conditional mathematical redundancy plus backend inconsistency. |
| **11. User-visible consequence** | The same visual dimension is controlled twice in fallback and once in WebGL. |
| **12. Severity** | High. |
| **13. Recommended correction** | Keep one primary global glow. If both scopes are required, rename to `Authored Show Glow` and `Preview Glow Trim`, show the resolved product, and unify backend consumption. |
| **14. Migration or compatibility risk** | Medium to High for existing WebGL projects. |
| **15. Tests needed** | Matched-product tuples, saturation boundaries, WebGL/Canvas frame comparison, fog interactions, and preset automation. |

### F-11 - PixGrid has three interchangeable global intensity multipliers

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | React FX Master, PixGrid LED Matrix, and PixGrid Output. |
| **2. Control names** | React `Intensity`; `Cell Brightness`; `Global PixGrid Intensity`. |
| **3. Source file and component** | UI `ReactFxPanel.tsx:82-88`, `pixGrid/PixGridControls.tsx:212-213,312-317`; normalization `PixGridValidation.ts:940-957`; Canvas renderer `renderers/pixGrid/PixGridBaselineRenderer.ts:85-97,185-190`; GPU `PixGridGpuRenderer.ts:409-423`, shader `PixGridGpuShaderSources.ts:99-110`. |
| **4. State field or fields** | `reactIntensity` enters `frame.intensity`; `pixGridState.cellBrightness`; `pixGridState.globalIntensity`. |
| **5. Update handler** | Three separate setters. |
| **6. Normalization or migration** | Each field is independently clamped to `0..1`. |
| **7. Runtime consumer** | Logical pixels are composed first; presentation multiplies the three scalar factors. |
| **8. Renderer, shader, compiler, or audio effect** | Canvas equation is explicit. GPU sends cell brightness and global intensity separately, then the shader multiplies them. |
| **9. Mathematical or logical relationship** | `emitter = logicalPixel * reactIntensity * globalIntensity * cellBrightness`. Any redistribution with the same product is identical until quantization/clamp. |
| **10. Classification** | Fully mathematically redundant at final emitter intensity, although the code may intend separate semantic scopes. |
| **11. User-visible consequence** | Users have three brightness knobs with no visible scope distinction, reduced useful range, and difficult preset reproduction. |
| **12. Severity** | High. |
| **13. Recommended correction** | Expose one primary `Output Intensity`. Move `Cell Calibration` and authored/performance trim to Advanced, label scopes, and show the resolved product. |
| **14. Migration or compatibility risk** | Medium. Preserve all fields for project and preset compatibility. A migration can compute the legacy product into the new primary while retaining hidden legacy values. |
| **15. Tests needed** | Matched-product tuples in Canvas and GPU, 8-bit quantization sensitivity, zero/one clamp boundaries, presets, cues, and adaptive quality. |

### F-12 - PixGrid React Glow and local Glow are exact symmetric addends

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | React FX Master and PixGrid presentation controls. |
| **2. Control names** | React `Glow`; PixGrid `Glow`. |
| **3. Source file and component** | UI `ReactFxPanel.tsx:93-99`, `PixGridControls.tsx:213`, `PixGridDesignPanel.tsx:138`; Canvas `PixGridBaselineRenderer.ts:96-97`; GPU `PixGridGpuRenderer.ts:409-420`. |
| **4. State field or fields** | `frame.glow`; `pixGridState.glowAmount`. |
| **5. Update handler** | Separate React and PixGrid setters. |
| **6. Normalization or migration** | Both are clamped to `0..1`. |
| **7. Runtime consumer** | No distinct radius, threshold, or layer scope is preserved. |
| **8. Renderer, shader, compiler, or audio effect** | Both backends compute `effectiveGlow = clamp01((frame.glow + glowAmount) * 0.5)`. |
| **9. Mathematical or logical relationship** | The two terms are perfectly symmetric. A delta in either produces the same half-delta before clamping. |
| **10. Classification** | Fully mathematically redundant. |
| **11. User-visible consequence** | Two controls with the same label produce exactly the same renderer input and halve each control's intuitive authority. |
| **12. Severity** | High. |
| **13. Recommended correction** | Merge into one Glow control, or redefine the local control as a genuinely different dimension such as diffusion radius or emitter halo width. |
| **14. Migration or compatibility risk** | Medium. Preserve and combine legacy values on load, then write a canonical value while retaining compatibility aliases. |
| **15. Tests needed** | A/B sweeps, equivalent sum pairs, clamp saturation, Canvas/GPU parity, and legacy state migration. |

### F-13 - PixGrid Starting Quality silently disables Adaptive Quality

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | PixGrid Engine > LED Matrix. |
| **2. Control names** | `Adaptive Quality`; `Starting Quality`. |
| **3. Source file and component** | `PixGridControls.tsx:197-209`. |
| **4. State field or fields** | `pixGridState.qualityMode`; `pixGridState.quality`. |
| **5. Update handler** | The selector is labeled `Starting Quality` when adaptive, but its handler always writes `{ quality, qualityMode: 'fixed' }`. |
| **6. Normalization or migration** | `PixGridValidation.ts:943-948` preserves the resulting fixed mode. |
| **7. Runtime consumer** | Adaptive controller is bypassed when mode becomes fixed. |
| **8. Renderer, shader, compiler, or audio effect** | Both GPU and Canvas paths then use fixed requested quality rules. |
| **9. Mathematical or logical relationship** | The UI label promises an adaptive baseline selection, while the binding turns adaptive off. |
| **10. Classification** | Behavioral binding bug and shadowed toggle. |
| **11. User-visible consequence** | Users enable Adaptive Quality, choose a starting tier, and unknowingly disable the feature. |
| **12. Severity** | High. |
| **13. Recommended correction** | When the label is `Starting Quality`, update only `quality`. Keep mode changes exclusively in the Adaptive Quality toggle. |
| **14. Migration or compatibility risk** | Very Low. No schema or saved-state migration is required. |
| **15. Tests needed** | Adaptive remains adaptive after tier changes; fixed remains fixed; keyboard and mouse interactions; save/reload; requested versus effective quality display. |

### F-14 - The two PixGrid Quality selectors have different side effects

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | PixGrid Engine quick controls and PixGrid Design > Grid Presentation. |
| **2. Control names** | `Starting/Fixed Quality`; `Quality`. |
| **3. Source file and component** | `PixGridControls.tsx:197-209`; `PixGridDesignPanel.tsx:131-140`. |
| **4. State field or fields** | Same `pixGridState.quality`, with one surface also changing `qualityMode`. |
| **5. Update handler** | Engine selector forces fixed mode. Design selector changes quality only. |
| **6. Normalization or migration** | Both flow through the same PixGrid state normalizer. |
| **7. Runtime consumer** | The same visible quality choice can start or stop adaptive behavior depending on panel. |
| **8. Renderer, shader, compiler, or audio effect** | Effective matrix resolution and secondary effects differ as a result. |
| **9. Mathematical or logical relationship** | Duplicate UI exposure with non-equivalent behavior. |
| **10. Classification** | Behavioral redundancy caused by inconsistent bindings. |
| **11. User-visible consequence** | The location of the edit changes runtime policy. This is especially confusing when both panels display synchronized tier values but not synchronized mode ownership. |
| **12. Severity** | High. |
| **13. Recommended correction** | Centralize `setPixGridRequestedQuality` and use it in both panels. Mode policy must be explicit and identical. |
| **14. Migration or compatibility risk** | Low. |
| **15. Tests needed** | Edit from each surface, compare full state, undo/redo, adaptive controller stage, and saved-state round trip. |

### F-15 - PixGrid Draft is unavailable in Adaptive mode and silently promoted in Canvas2D fallback

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | PixGrid Quality selectors and runtime renderer selection. |
| **2. Control names** | Quality option `Draft`. |
| **3. Source file and component** | Adaptive policy `PixGridAdaptiveQuality.ts:34-48`; Canvas fallback `PixGridBaselineRenderer.ts:152-170`; existing contract test `pixGrid/__tests__/PixGridAdaptiveQuality.test.ts:22-39`. |
| **4. State field or fields** | Requested quality can remain `draft`; effective logical quality becomes `low`. |
| **5. Update handler** | UI allows Draft in the same option list. |
| **6. Normalization or migration** | Base state records Draft as 64 x 36, but adaptive policy promotes it to Low 96 x 54. Canvas fallback also promotes fixed Draft to Low. |
| **7. Runtime consumer** | Adaptive quality never drops below 96 x 54. GPU fixed Draft can remain 64 x 36. |
| **8. Renderer, shader, compiler, or audio effect** | Backend and mode determine whether Draft is reachable. |
| **9. Mathematical or logical relationship** | A selectable range value is a no-op in Adaptive mode and backend-dependent in Fixed mode. |
| **10. Classification** | No-op option and conditional override. |
| **11. User-visible consequence** | The displayed requested tier can disagree with effective resolution, and switching renderer can alter matrix size without a control change. |
| **12. Severity** | Medium. |
| **13. Recommended correction** | Show requested and effective quality separately. Disable or relabel Draft when unreachable, or support it consistently if product intent changes. |
| **14. Migration or compatibility risk** | Low for UI truthfulness. Higher if Canvas fallback starts rendering 64 x 36. |
| **15. Tests needed** | Requested/effective matrix across all tiers, both modes, GPU/Canvas backends, and adaptive degradation stages. |

### F-16 - PixGrid presentation controls are duplicated with inconsistent history semantics

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | PixGrid Engine > LED Matrix and PixGrid Design > Grid Presentation. |
| **2. Control names** | Quality, Cell Gap, Cell Roundness, Cell Brightness, Glow, Diffusion, RGB Subpixels. |
| **3. Source file and component** | `PixGridControls.tsx:197-220`; `PixGridDesignPanel.tsx:125-141`. |
| **4. State field or fields** | Same PixGrid presentation fields. |
| **5. Update handler** | Quick controls call direct `setState`; Design sliders use `HistorySlider` and `applyState`, while Design Quality uses a different direct state change. |
| **6. Normalization or migration** | Same state normalizer. |
| **7. Runtime consumer** | Values stay synchronized, but authoring history and quality policy differ by surface. |
| **8. Renderer, shader, compiler, or audio effect** | All feed the same Canvas/GPU presentation pipeline. |
| **9. Mathematical or logical relationship** | Mostly intentional compact and advanced duplication, but not behaviorally equivalent due undo/redo and Quality side effects. |
| **10. Classification** | Intentional duplication with defective synchronization context. |
| **11. User-visible consequence** | Some edits can be undone and others cannot, depending only on where the same setting was changed. |
| **12. Severity** | Medium. |
| **13. Recommended correction** | Define quick controls as a documented live surface and route all mutating actions through the same history policy, or make the quick surface read-only summaries plus shortcuts. |
| **14. Migration or compatibility risk** | Low to Medium because history serialization may change, but rendering state need not. |
| **15. Tests needed** | Cross-surface synchronization, undo/redo after each surface, quality mode preservation, keyboard accessibility, and history transaction boundaries. |

### F-17 - PixGrid Performance controls are duplicated with different program-selection behavior

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | PixGrid Engine > Performance and Reactivity Workspace > Performance Program. |
| **2. Control names** | Auto Performance, Performance Intensity, Program/Active Program. |
| **3. Source file and component** | `PixGridControls.tsx:142-166`; `PixGridReactivityWorkspace.tsx:595-610`. |
| **4. State field or fields** | `pixGridState.performance.enabled`, `intensity`, `sharedPerformanceProgramId`, overrides, plus global active React preset. |
| **5. Update handler** | Engine Program selects a matching React preset when mapped. Reactivity Active Program edits only the program ID and clears program overrides. Engine controls use direct state; Reactivity uses authoring `applyState`. |
| **6. Normalization or migration** | PixGrid state normalization preserves program and overrides; React preset selection can replace broader engine state. |
| **7. Runtime consumer** | The unified performance runtime consumes the selected program, cues, and overrides in `PixGridSurface.tsx:697-724`. |
| **8. Renderer, shader, compiler, or audio effect** | Resolved runtime state feeds PixGrid logical composition and presentation. |
| **9. Mathematical or logical relationship** | The same apparent program selector either loads an entire preset or changes only the program, depending on surface. |
| **10. Classification** | Duplicate UI exposure with non-equivalent behavioral scope. |
| **11. User-visible consequence** | Selecting the same named program can reset artwork/settings in one location but not the other, and history/custom status can differ. |
| **12. Severity** | High. |
| **13. Recommended correction** | Create one centralized action with two explicitly named operations: `Load Program Preset` and `Change Program Only`. Do not hide the distinction behind identical selectors. |
| **14. Migration or compatibility risk** | High if existing workflows rely on implicit preset loading. Preserve legacy action behavior behind an explicit command. |
| **15. Tests needed** | Both surfaces, matching and custom programs, active preset ID, overrides, history, cues, save/reload, and deterministic seek. |

### F-18 - PixGrid reaction assignments have two editors with incompatible ranges and partial schemas

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Group Reaction panel and full Reactivity Workspace route editor. |
| **2. Control names** | Source, target/operation, amount, threshold, envelope, quantization, priority, blend, and route conditions. |
| **3. Source file and component** | `PixGridGroupReactionPanel.tsx:208-244`; `PixGridReactivityWorkspace.tsx:343-420`. |
| **4. State field or fields** | The same `PixGridReactionAssignment` objects in group reaction arrays. |
| **5. Update handler** | Both mutate the same assignments. The compact panel caps Amount at `-2..2` and Priority at `-100..100`; the full editor allows Amount `-4..4`, Priority `-500..500`, finer envelope steps, input/output ranges, cooldown, and conditions. |
| **6. Normalization or migration** | A single assignment normalizer/compiler accepts the broader schema; the compact UI cannot represent every valid value. |
| **7. Runtime consumer** | The route compiler and performance runtime consume the full assignment. |
| **8. Renderer, shader, compiler, or audio effect** | Assignments affect groups, pixels, layers, scenes, animation, and output targets. |
| **9. Mathematical or logical relationship** | Duplicate editing surfaces are not schema-equivalent. Values created in the full editor can be out of range or invisible in the compact editor. |
| **10. Classification** | Duplicate UI exposure with range mismatch and partial editing. |
| **11. User-visible consequence** | Round trips through the compact panel can misrepresent high amounts/priorities and hide conditions that explain why a route is inactive. |
| **12. Severity** | High. |
| **13. Recommended correction** | Use one canonical control schema. Make the group panel a compact summary with safe subset editing and an `Open full route editor` action, or render the same shared editor component. |
| **14. Migration or compatibility risk** | Medium. Do not clamp existing wider values during display or save. |
| **15. Tests needed** | Assignments at all wider bounds, open in both surfaces, no clamping on render, edit round trip, conditions, cooldown, and route compiler output. |

### F-19 - PixGrid performance diagnostics repeat the same live state in multiple dense blocks

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | PixGrid Engine performance status, Shared Performance Diagnostics, and Reactivity Workspace live cards/override blocks. |
| **2. Control names** | Read-only displays for program, section plan, roles, routes, arcs, cues, transition, binding warnings, and override ownership. |
| **3. Source file and component** | `PixGridControls.tsx:167-195`; `PixGridReactivityWorkspace.tsx:603-618`; shared diagnostics mounted at `PixGridControls.tsx:195`. |
| **4. State field or fields** | Shared performance runtime diagnostics and cue status. |
| **5. Update handler** | Read-only subscriptions, plus duplicate Clear Override actions in compact and full workspaces. |
| **6. Normalization or migration** | All display derived runtime diagnostics, so values are synchronized. |
| **7. Runtime consumer** | Same unified performance runtime publication. |
| **8. Renderer, shader, compiler, or audio effect** | No direct renderer effect except Clear Override mutations. |
| **9. Mathematical or logical relationship** | Information is intentionally repeated, but the compact panel is nearly a full diagnostic dump rather than a summary. |
| **10. Classification** | Duplicate information exposure; partly intentional, excessively dense. |
| **11. User-visible consequence** | The most important ownership signal is buried among repeated program details, and users can mistake readouts for separate systems. |
| **12. Severity** | Low. |
| **13. Recommended correction** | Compact panel should show Program, Owner, Section, and one warning line. Move route banks, arcs, and binding details to the full workspace. Keep one canonical Clear Override action per surface with identical behavior. |
| **14. Migration or compatibility risk** | Very Low. |
| **15. Tests needed** | Snapshot/readout consistency, accessibility labels, stale diagnostic publication, and identical Clear Override results. |

### F-20 - Shader master controls are shown for scenes that do not consume them

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Shader Pads > React FX Master. |
| **2. Control names** | Intensity, Motion, Glow, Bass React, depending on active scene. |
| **3. Source file and component** | UI policy `reactFxMasterControls.ts:14-19`; uniform writes `shaders/ShaderEngineRenderer.ts:504-520`; production registry `shaders/scenes/index.ts:39-48`; scene sources listed below. |
| **4. State field or fields** | React-wide master scalars. |
| **5. Update handler** | Global React master setters. |
| **6. Normalization or migration** | No scene capability normalization filters the UI. |
| **7. Runtime consumer** | Renderer attempts to set all master uniforms. Unused uniforms are absent or optimized out and have no shader effect. |
| **8. Renderer, shader, compiler, or audio effect** | Confirmed unused pairs by static shader trace: Prism Tunnel and Liquid Metaballs do not use `uMasterGlow`; Brand Echo Signal declares but does not use `uMasterMotion`; Laser Lattice Overdrive and Melodic Rift Bloom do not use `uMasterBassReactivity`. Reactor, Bass Cathedral, and Wobble Glyph Forge consume all relevant masters. Sources: `prismTunnel.ts:33-35,76-78,140-145`; `liquidMetaballs.ts:32-34,43,73-74,93,119-122`; `brandEchoSignal.ts:64-67,102,125`; `laserLatticeOverdrive.ts:39,49,85`; `melodicRiftBloom.ts:63,89`. |
| **9. Mathematical or logical relationship** | A control can write a global state field and uniform setter while the active shader has no read of that uniform. |
| **10. Classification** | Scene-dependent dead controls. |
| **11. User-visible consequence** | Users move valid-looking masters that do nothing in specific scenes. Prism and Liquid can also have scene-local glow controls while generic Glow is dead, which is especially misleading. |
| **12. Severity** | High. |
| **13. Recommended correction** | Add scene capability metadata generated or validated against uniform usage. Hide or disable unused masters with a clear `Not used by this scene` explanation. |
| **14. Migration or compatibility risk** | Low for conditional UI. Medium if shaders are changed to consume formerly ignored masters because saved values may suddenly affect output. |
| **15. Tests needed** | Static shader uniform capability audit, per-scene sensitivity render tests, active scene switching, preset automation, and shader compilation. |

### F-21 - Canvas Opacity and Source Visibility multiply the same source alpha in all main paths

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | CANVAS Transform and CANVAS React Controls. |
| **2. Control names** | `Opacity`; `Source Visibility`. |
| **3. Source file and component** | UI `ReactCanvasEngineShell.tsx:2124-2146,2677-2690,2819-2827`; direct media style `383-395`; particle path `1556`; orchestration `canvasPerformance/CanvasOrchestrationStage.tsx:95-135,362-391`. |
| **4. State field or fields** | `canvasEngineSettings.opacity`; `canvasPresetSettings.sourceVisibility`. |
| **5. Update handler** | Separate engine and recipe setters. |
| **6. Normalization or migration** | Both are bounded `0..1` in their respective state contracts. |
| **7. Runtime consumer** | Direct media uses their product. Particle base alpha uses their product. Orchestration passes `transitionOpacity * opacity * sourceVisibility`, then multiplies per-layer opacity. |
| **8. Renderer, shader, compiler, or audio effect** | CSS, Canvas2D particle, and orchestration paths all consume the product. Source Visibility additionally changes particle source CSS brightness/visibility variables at `ReactCanvasEngineShell.tsx:436-440`. |
| **9. Mathematical or logical relationship** | For base source alpha: `finalAlpha = layerOpacity * transitionOpacity * engineOpacity * sourceVisibility`. The two global factors are interchangeable there, but Source Visibility has extra particle-specific semantics. |
| **10. Classification** | Partially mathematically redundant and conditionally distinct. |
| **11. User-visible consequence** | For normal media, two sliders appear to be identical opacity controls. Particle recipes can diverge slightly, making the distinction inconsistent rather than clear. |
| **12. Severity** | Medium to High. |
| **13. Recommended correction** | Rename `Opacity` to `Canvas Output Opacity`. Redefine `Source Visibility` as `Dry Source Mix` that affects only the untreated source layer, not every composited source alpha. Show per-layer opacity separately. |
| **14. Migration or compatibility risk** | Medium. Existing Canvas recipes and saved projects rely on the product. Version the interpretation or preserve legacy mode. |
| **15. Tests needed** | Direct media, particle WebGL/Canvas2D, orchestration layers, masks, transitions, effects-only recipes, and legacy recipe migration. |

### F-22 - Cinematic Camera Mode and Auto Director Enabled edit the same field

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Cinematic Worlds > Camera and Auto Director. |
| **2. Control names** | `Camera Mode`; `Auto Director Enabled`. |
| **3. Source file and component** | `CinematicWorldsControls.tsx:335-357,386-393,418-428`. |
| **4. State field or fields** | `config.cameraRig`. |
| **5. Update handler** | Camera Mode selects any supported rig. Auto Director toggle writes `autoDirector` when enabled and hard-codes `locked` when disabled. |
| **6. Normalization or migration** | Cinematic config overrides preserve the selected rig and already track modified status via `useActiveCinematic` at `183-213`. |
| **7. Runtime consumer** | Camera runtime branches on `cameraRig`. |
| **8. Renderer, shader, compiler, or audio effect** | Cinematic camera controller receives the selected rig. |
| **9. Mathematical or logical relationship** | Two controls in the same screen edit one field. Turning the toggle off does not restore the previous rig; it forces Locked. |
| **10. Classification** | Fully duplicate state exposure with destructive off behavior. |
| **11. User-visible consequence** | A user can choose Fly Through or Handheld, turn Auto Director on, then lose the previous choice when turning it off. |
| **12. Severity** | High. |
| **13. Recommended correction** | Remove the enable toggle and let Camera Mode own the rig, or make the toggle remember and restore the prior manual rig. |
| **14. Migration or compatibility risk** | Low. UI behavior only, unless prior-rig memory is persisted. |
| **15. Tests needed** | All camera rigs, toggle on/off, prior-rig restoration, preset modified status, save/reload, and world-specific supported rig lists. |

### F-23 - Theme and appearance schemas are orphaned from the current React workspace

| Required field | Audit result |
|---|---|
| **1. Engine and UI location** | Global application theme/appearance contract. |
| **2. Control names** | No active React control was found, but legacy theme, accent, scanline, glow, grid, logo, border, transparency, and density fields remain declared. |
| **3. Source file and component** | `src/types/session.ts:3-20`; `src/types.ts:179-236`; `src/types/database.ts:100-108`; only type-level preset use in `src/hooks/usePresets.ts`. |
| **4. State field or fields** | `WorkspacePreset.theme`; `GlobalSettings.theme` and appearance fields; database `UserSettings.theme`. |
| **5. Update handler** | No current React workspace setter or control was found for these fields. |
| **6. Normalization or migration** | Defaults exist, but no current React runtime application was found. |
| **7. Runtime consumer** | No renderer or root CSS variable binding reads `THEME_COLORS` in the audited `src` tree. |
| **8. Renderer, shader, compiler, or audio effect** | No visible effect in the current React application path. |
| **9. Mathematical or logical relationship** | Orphaned legacy schema, not duplicate active controls. |
| **10. Classification** | Dead state and obsolete contract surface. |
| **11. User-visible consequence** | Documentation or saved data can imply user-selectable appearance support that the current workspace does not implement. |
| **12. Severity** | Low. |
| **13. Recommended correction** | Mark the fields deprecated and document current CSS-only appearance, or implement one canonical theme service before exposing controls. Do not add another local engine theme selector. |
| **14. Migration or compatibility risk** | Medium for persistence/database compatibility. Retain fields and migrations even if hidden. |
| **15. Tests needed** | Legacy workspace/database round trip, default loading, deprecation warnings, and future root theme application. |

## Probable Perceptual Redundancies

These are code-supported hypotheses, not confirmed equivalence. They require representative frame comparison or controlled user-perception thresholds.

### P-01 - Sound Drawing Trail Decay versus performance Trail Intensity

`reactTrailDecay` contributes only `0.04` to final decay while performance `trailIntensity` heavily rescales layer/global persistence (`SoundDrawingPerformanceEngine.ts:977-1007`; `SoundDrawingRenderer.ts:2975-2991`). They are not mathematically identical, but broad practical ranges may feel like two persistence knobs. Validate with frame persistence half-life sweeps across non-Ribbon and Ribbon shows.

### P-02 - Shader global masters versus scene-local brightness/glow controls

When a scene consumes both a generic master and a local parameter, the two often multiply or add in the final color expression. Examples include Prism Tunnel local `uGlow` with Master Intensity, and scenes that combine local glow with Master Glow. They are semantically valid as global versus scene-local, but may be perceptually inseparable unless the UI communicates scope. Validate with per-scene image sensitivity matrices.

### P-03 - Canvas Visual Intensity versus individual recipe effects

`Visual Intensity` scales several effect terms in `ReactCanvasEngineShell.tsx:407-435`, while Glow, Trail, Glitch, Particle Density, and Motion also feed those terms. This is a legitimate macro, but at high settings several controls can compress into similar brighter/blurrier output. Validate with effect-isolated fixtures and perceptual difference thresholds.

## Dead or Shadowed Controls

| Finding | Status |
|---|---|
| F-05 Trails lock | Restores recipe constants rather than the user's manual Trail Decay. |
| F-06 Sound Drawing manual controls | Shadowed by Auto Performance unless their domain is explicitly locked. |
| F-08 Laser React masters | Dead on WebGL, live on Canvas2D fallback. |
| F-13 Adaptive Quality toggle | Shadowed when Starting Quality is changed because the handler forces Fixed. |
| F-15 PixGrid Draft | Unreachable in Adaptive mode and promoted by Canvas fallback. |
| F-20 Shader masters | Dead only in scenes that omit the corresponding uniform read. |
| F-23 Theme/appearance fields | Orphaned legacy state with no current React runtime consumer. |

## Duplicate Information and UI Exposure

| Finding | Duplicate surfaces | Problem |
|---|---|---|
| F-02 | Input Gain plus X/Y Gain | Missing linked/mixed-state semantics. |
| F-04 | Pro Scope preset plus editable scope | Preset remains displayed after divergence. |
| F-07 | Preset browser plus manual master controls | Active card remains exact-looking after edits. |
| F-14 | Two PixGrid Quality selectors | Same value, different mode side effects. |
| F-16 | Two PixGrid presentation panels | Same fields, inconsistent history semantics. |
| F-17 | Two PixGrid performance panels | Same labels, different program-selection scope. |
| F-18 | Two PixGrid route editors | Different ranges and schema coverage. |
| F-19 | Three PixGrid diagnostics/status surfaces | Excessive repeated detail. |
| F-22 | Camera Mode plus Auto Director Enabled | Same field, destructive toggle-off behavior. |

## Correctly Distinct Controls


### Auto Gain vs Input Gain

Auto Gain normalizes source level before manual conditioner gain (`ScopeSignalCore.ts:215-235`). It is a continuous source normalizer; manual gain is a post-normalization trim. The issue is Input Gain versus Visual Size, not Auto Gain itself.

### Timebase vs Visual Size

Waveform X is a normalized time ramp (`soundDrawingScopeGeometry.ts:128-133`), so timebase changes duration/content while Visual Size changes vertical amplitude. In X/Y modes, timebase changes captured samples/phase history, not final scale alone.

### Independent X and Y Gain

In X/Y measurement modes, separate axes are useful for calibration and intentional aspect correction. They are valid once the linked master has proper mixed-state semantics.

### Canvas Visual Intensity vs Source Visibility

Visual Intensity controls effect recipe strength, glitch, aura, trail, brightness, and motion terms (`ReactCanvasEngineShell.tsx:407-435`). Source Visibility primarily controls source alpha. They should remain distinct after Source Visibility is made a true dry mix.

### Canvas per-layer opacity vs global output opacity

Layer opacity is applied per layer before the global alpha product (`CanvasOrchestrationStage.tsx:121-135,364-391`). Different scope, valid hierarchy.

### Cinematic macros vs Advanced controls

The UI explicitly states macros are non-destructive runtime offsets (`CinematicWorldsControls.tsx:280-288`), while Advanced edits authored geometry/material/camera state. Modified status is also explicit (`292-300`).

### Laser per-beam dimmer vs Beam Matrix Master Dimmer

Per-beam dimmer is authored fixture content; Master Dimmer is global show output. This hierarchy is valid. The redundant extra factor is React Master Intensity.

### Hardware Master vs virtual visual intensity

Production Hardware Master is applied only while preparing adapter frames and explicitly excludes virtual preview (`output/ProductionOutputPanel.tsx:59-64`). It is a safety/output domain, not a renderer brightness duplicate.

### Global output header vs Production Output panel

Both subscribe to the same `productionOutputController` (`ReactGlobalOutputControls.tsx:49-105`; `ProductionOutputPanel.tsx:20-107`). The header is compact emergency access; the panel is full configuration. Synchronization and scope are clear.

### Laser DJ vs Advanced inspector

The two surfaces are mutually exclusive via `showAdvanced` (`LaserDmxShowDirectorInspector.tsx:731-840`). They edit the same fixture state intentionally, with the DJ mode explaining when Advanced is needed.

### Music Intelligence diagnostics vs route controls

`ReactAudioPanel.tsx:1-5` is read-only diagnostics. `MusicIntelligenceDiagnosticsPanel.tsx:31-184` reads the canonical `AudioFeatureBus` and performs no writes. Repetition of BPM/bands in Track Map is contextual status, not a second analyzer control.

### Track Map summary vs editor

The selected-section overview is read-only context (`ReactTrackMapStrip.tsx:2289-2329`) while the editor owns mutations. Effective BPM versus analyzed BPM is explicitly distinguished (`2144-2165`).

### Recording target FPS vs live FPS

Target FPS controls capture configuration; live FPS is a diagnostic warning/readout. They represent requested versus observed rate, not duplicate settings.

## Recommended Consolidation Plan

### Remove

- Remove the duplicate Cinematic `Auto Director Enabled` toggle, or replace it with non-destructive prior-rig restoration.
- Remove scene-inapplicable Shader master rows from the active UI, while retaining underlying global fields.
- Remove full diagnostic dumps from the compact PixGrid Engine panel.

### Rename

- Sound Drawing `Input Gain` to `Linked X/Y Gain` or Advanced `Post Auto-Gain Trim`.
- Sound Drawing `Trigger Stability` to `Stability Macro`.
- Sound Drawing `Trails` lock to match its actual ownership if semantics are not repaired.
- Laser `Master Dimmer` to `Authored Show Dimmer` and React Master Intensity to `Preview Output Trim`, if both remain.
- Laser `Global Glow` to `Authored Show Glow` and React Master Glow to `Preview Glow Trim`, if both remain.
- CANVAS `Opacity` to `Canvas Output Opacity`.
- CANVAS `Source Visibility` to `Dry Source Mix` after behavior is corrected.
- PixGrid `Cell Brightness` to `Cell Calibration` if retained.

### Merge

- Merge PixGrid React Glow and local Glow into one canonical Glow.
- Merge the primary PixGrid output intensity experience while preserving hidden compatibility fields.
- Merge the two PixGrid Quality handlers into one action.
- Merge the two PixGrid Program selection implementations into a single explicit service.

### Convert to linked controls

- Pro Scope Input Gain with X/Y Gain and a visible link toggle.
- Trigger Stability as a macro over separately visible Continuity and Period Lock controls.
- Laser authored and preview masters can remain linked by default, but must expose scope and resolved product.

### Move to Advanced

- Scope post-normalization gain after one primary Trace Size control exists.
- PixGrid Cell Calibration and any legacy intensity factors.
- Detailed PixGrid route conditions and performance diagnostics.
- Backend-specific Laser preview trims, only if they remain separate.

### Hide conditionally

- Shader masters unsupported by the active scene.
- PixGrid Draft when it is unreachable for the active quality mode/backend.
- Manual Sound Drawing controls currently owned by Auto Performance, unless a lock is enabled.
- X Gain in waveform modes, or show it disabled with an explanation.

### Make read-only

- Compact PixGrid performance status should be a short owner/program/section summary.
- Selected media and Track Map overview should remain read-only contextual summaries.
- Preset identity should be read-only provenance once values become modified.

### Preserve but clarify

- Auto Gain versus manual gain.
- Per-layer versus global opacity.
- Per-beam dimmer versus show master dimmer.
- Hardware Master versus virtual renderer intensity.
- Global output header versus full Production Output panel.
- Cinematic macros versus Advanced authored controls.
- Laser DJ versus Advanced inspector.

### Repair broken binding

- PixGrid Starting Quality must not set `qualityMode: 'fixed'`.
- Laser React masters must be resolved consistently before backend selection, or removed from LaserDMX.
- Generic preset modified status must be derived after manual edits.
- Pro Scope preset modified status must be derived after manual edits.
- PixGrid Program selectors must have explicit, centralized semantics.

## Prioritized Patch Plan

### Patch 1 - PixGrid Quality Binding and Contract Tests

Scope:
- Repair `Starting Quality` so it preserves Adaptive mode.
- Centralize requested-quality changes for both PixGrid surfaces.
- Add requested versus effective quality display.
- Add regression tests for mode preservation and Draft effective resolution.

Why first:
- High user impact.
- Very small code surface.
- No schema migration.
- No preset output should change except restoring the behavior the UI already promises.

### Patch 2 - Preset and Ownership Truthfulness

Scope:
- Add `Modified from preset` to generic React presets and Pro Scope.
- Add Sound Drawing per-domain ownership indicators under Auto Performance.
- Clarify Trails lock semantics without changing runtime precedence yet.

Risk:
- Low because it is primarily derived UI state.

### Patch 3 - PixGrid Control Consolidation

Scope:
- Merge Glow.
- Define and label the three intensity scopes.
- Unify quick/Design history semantics.
- Unify performance-program selection.
- Replace the compact route editor with shared schema or summary-plus-link.

Risk:
- Medium because presets and authored states contain legacy fields.

### Patch 4 - Laser Backend-Neutral Master Resolution

Scope:
- Decide the canonical authored versus preview output hierarchy.
- Apply the same resolved intensity/glow to WebGL and Canvas2D.
- Add context-loss parity tests and compatibility versioning.

Risk:
- High because previously ignored WebGL values will begin affecting saved shows.

### Patch 5 - Sound Drawing Scale and Lock Semantics

Scope:
- Introduce one primary Trace Size.
- Retain gain as Advanced trim with link/mixed state.
- Split Trigger Stability macro into visible advanced factors.
- Repair or version Trails lock behavior.

Risk:
- Medium because scope presets, saved projects, and performance shows persist these fields.

### Patch 6 - Shader Capability Metadata

Scope:
- Add per-scene master capability metadata.
- Validate metadata against shader uniform usage.
- Conditionally render master rows.
- Add scene sensitivity visual tests.

Risk:
- Low for UI-only hiding; Medium if formerly unused uniforms become active.

### Patch 7 - CANVAS Alpha Scope Migration and Theme Contract Cleanup

Scope:
- Separate Output Opacity from Dry Source Mix.
- Preserve legacy product behavior through a compatibility version.
- Deprecate or implement orphaned theme/appearance contracts.

Risk:
- Medium because Canvas recipes and persisted appearance schemas are involved.

## Smallest Safe First Patch Proposed

**Patch title:** `PixGrid Starting Quality Binding Fix`

**Exact intent:**

1. In `PixGridControls.tsx`, change the Starting/Fixed Quality handler so:
   - Adaptive mode updates `quality` only.
   - Fixed mode updates `quality` only.
   - Only the Adaptive Quality toggle changes `qualityMode`.
2. Route the Design panel Quality selector through the same centralized action.
3. Add tests proving:
   - Adaptive remains enabled after changing Starting Quality.
   - Fixed remains fixed after changing Fixed Quality.
   - Both UI surfaces produce identical state.
   - Requested Draft in Adaptive mode displays effective Low 96 x 54 without pretending the requested value was rendered.
4. Do not change PixGrid state version, preset schema, renderer behavior, or saved-state migration.

This is the smallest safe first patch because it repairs a confirmed high-severity binding contradiction without changing persisted fields or the visual meaning of existing projects.
