# MARQUEE — Cinema 2.0 implementation report

Status: implementation and automated production validation complete; human visual approval remains a release gate.

## Artifact audit

The requested artifacts are stored under `docs/Marquee/` (not directly under `docs/`). Their supplied SHA-256 fingerprints match the validation documents.

| Path | Purpose / relevant content | Runtime use / compatibility |
|---|---|---|
| `docs/Marquee/DVYDRM_Cinema2_Theater_Blender_Scene_Package/` | Source GLB, procedural Blender builder, geometry blueprint, model preview, reference image, node manifest. The builder groups architecture, three sign faces, canopy, marquee/tower bulbs, left/right LEDs, red/amber/blue neon, five Blender cameras, and driven look-development emission. | Geometry, naming, camera, and look-development authority. The `.py` builder is not run at runtime and no `.blend` is supplied; Blender execution remains unverified. |
| `docs/Marquee/DVYDRM_Cinema2_Theater_GLTF_Package/` | Editable glTF + BIN + seven textures + import/text instructions + node manifest. Right-handed `+X` right, `+Y` up, `+Z` toward the street. | Inspection/reference source. The production app consumes the equivalent self-contained GLB. The three source text textures are presentation defaults only. |
| `docs/Marquee/DVYDRM_Cinema2_Theater_Implementation_Specification.md` | Preset-specific visual, text, fixture, control, audio, authority, camera, performance, and acceptance contract. | Implementation and acceptance authority below the repository-wide Cinema 2.0 contract. |
| `docs/Marquee/DVYDRM_Cinema2_Theater.glb` | Self-contained glTF 2.0 theater: 1,833 nodes, 43 meshes, 31 materials, four cameras, zero animations. | Shipped production geometry, registered as `cinema2-marquee-theater`. No flat-image substitute. |
| `docs/Marquee/DVYDRM_Cinema2_Visual_Validation_Package/` | Cleaned reference, current-model comparison, zone/text contract, and V01–V08/T01–T08 checklist. | Visual acceptance oracle. It explicitly marks the source model as not visually approved and requires human review of the integrated production canvas. |
| `docs/Marquee/DVYDRM_Theater_Blender_README.md` | Blender 3.6/4.x instructions, live FONT-object mapping, lighting properties, cameras, and limitations. | Confirms browser text belongs on the three `*.TEXT_SURFACE` meshes and the Blender timeline is not production choreography. |

Verified scene identities:

- `marquee.front.TEXT_SURFACE`, `marquee.left.TEXT_SURFACE`, and `marquee.right.TEXT_SURFACE` are distinct meshes/materials.
- 216 marquee-trim bulbs, 718 canopy bulbs, 152 tower bulbs, and 160 LED cells per entrance side are individually named.
- Red, amber, and blue neon are separate source groups/material families.
- The supplied GLB is a prototype-scale reconstruction. Missing components: native `.blend`, embedded animation, runtime behavior, and human visual acceptance.

Required runtime corrections: lower/tighter hero framing to expose the canopy underside and increase marquee dominance; stronger dimensional crown treatment through material/lighting presentation; dynamic text textures; bounded fixture programming; controlled bloom and wet-ground reflection. The source geometry is preserved because no authoritative corrected mesh is supplied.

## Codebase integration map

| Concern | Existing source / exported seam | MARQUEE decision |
|---|---|---|
| First-party discovery | `presets/Cinema2FirstPartyPresetCatalog.ts` | Register one keeper manifest. |
| Native module registry | `modules/Cinema2ModuleRegistry.ts` | Register one `marquee-native-render` module. |
| GLB loading/cache | `modules/three/Cinema2ThreeAssetManifest.ts`, `Cinema2ThreeAssetCache`, generated asset manifest | Add one repository-owned GLB record and reuse reference-counted loading/disposal. |
| Shared renderer | `modules/three/Cinema2ThreeSceneBridge.ts` | Reuse the shared WebGL context, renderer, lighting, depth, environment, warm-up, and resource accounting. Add only a generic cloned-model visitation seam for named-node controllers. |
| Parameter/persistence | `parameters/Cinema2ParameterSchema.ts`, `Cinema2ParameterState.ts`, module/effect/camera bindings | Define ordinary persisted parameters; no Inspector special case. |
| Inspector grouping | `parameters/Cinema2InspectorModel.ts` and `designParentGroup` | Use only Master Controls, Design, Effects, Palette. Trigger uses existing conditional visibility. |
| Shared trigger contract | `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` and `resolveCinema2AfterhoursTriggerEventIdentity` | Reuse values, labels, and fresh-event identity semantics. |
| Timing | `modules/Cinema2BeatClock.ts` | BPM Sync on follows shared tempo/grid; off intentionally free-runs at 120 BPM. |
| Audio Intelligence | `audio/Cinema2AudioIntelligenceBridge.ts` | Read the host frame only; no local analysis/detection. |
| Choreography | `choreography/Cinema2ChoreographyRuntime.ts` + module action bindings | Shared event rules dispatch bounded fixture impulses to the native module. |
| Visual Director | `director/Cinema2VisualDirector.ts` | Use available intensity/momentum/build/impact only as bounded gains. |
| Camera | `spatial/Cinema2CameraRuntime.ts` | Shared static hero camera with bounded optional tempo motion; no second camera runtime. |
| Effects/render graph | HDR bloom, volumetric atmosphere, reflective floor, cinematic finish | Bind ordinary effect parameters in the standard scene → floor → haze → bloom → finish graph. |
| Production validation | existing Cinema 2.0 Vitest suites and browser capture scripts | Add focused manifest/domain/lifecycle tests and a production browser harness/capture set. |

## Visual specification

MARQUEE is a world-space 3D nighttime Art Deco theater. The default 16:9 hero keeps the facade symmetrical, the three letterboards readable, the crown and both vertical towers in frame, the canopy underside visible, the entrance centered, and the wet street in the lower frame. Idle mode is a restrained warm architectural hold with slow authored bulb travel. Music adds spatially distinct canopy, perimeter, tower, LED, and crown behavior rather than undifferentiated brightness.

Palette roles are independently authored: Night Atmosphere, Marquee Red, Incandescent Gold, Crown Blue, and Architectural Accent. Text content is user-owned and generated only when a sign string or its visual styling changes.

Pattern library:

1. Opening Night — marquee-first warm perimeter presentation.
2. Canopy Cascade — facade-to-street underside row travel.
3. Triple-Face Relay — left/front/right face sequence.
4. Tower Call & Response — alternating vertical towers with opposite LED echoes.
5. Neon Crown Rise — layered red/amber/blue crown buildup.
6. Velvet Intermission — quiet curtain/sign emphasis and architectural negative space.
7. Premiere Burst — coordinated bounded drop reveal, also available manually.

## Authority matrix

| Property | Manual control | Audio / choreography | Visual Director | Auto Performance | Manual edit behavior |
|---|---|---|---|---|---|
| Front/left/right text | User owned | None | None | Never | Updates only its own face immediately and persists. |
| Pattern | User-authored base | Selected fresh Trigger may advance runtime base while enabled | Significance scales strength only | Temporary build/drop substitute only | Immediate base selection; Pattern Change stays enabled; stale event is armed out. |
| Pattern Change / Trigger | User owned | Shared fresh event identity only | None | Cannot mutate | Values persist; Trigger is hidden while disabled. |
| Master and zone intensities | User base + bounded intelligence | Multiplicative/additive bounded envelopes | Bounded gain | May modulate below authored ceiling | Zero remains zero. |
| Palette colors | User owned | Emission amplitude only | No color ownership | Never | Immediate distinct material-family update. |
| BPM Sync | User owned | Selects shared-grid versus authored 120 BPM timebase | None | Cannot change | Clean clock transition/reset on discontinuity. |
| Camera movement | Hard user authorization | Tempo drift/kick response only when enabled | Bounded meaning | No implicit enable | Off stays off. |
| Bloom / haze / reflection | User base + bounded intelligence | Existing effect path only | Bounded where configured | No implicit enable | Zero stays zero. |
| Auto Performance | User owned opt-in | Temporary build/drop pattern scope | Supplies significance only | Pattern scope only | Turning off immediately restores runtime base. |

Pattern precedence: manual authored base → shared Trigger advancement while Pattern Change is on → temporary authorized build/drop substitute → current underlying runtime base resumes.

## Parameter-to-render mappings

| Inspector control(s) | Runtime consumer |
|---|---|
| `marquee-master-intensity`, zone intensity controls | `Cinema2MarqueeSceneController` fixture-family emission; zero remains zero. |
| `marquee-bpm-sync` | Shared `Cinema2BeatClock`; analyzed grid when available, stable 120 BPM fallback otherwise. |
| `marquee-auto-performance` | Runtime-only `Cinema2MarqueePatternController` build/drop substitutions. |
| `marquee-camera-motion` | Shared camera motion amount, with bounded position/FOV safety and tempo sync. |
| `marquee-pattern`, `marquee-pattern-change`, `marquee-trigger` | Seven-program fixture engine and shared Afterhours fresh-event resolver. |
| `marquee-front-text`, `marquee-left-text`, `marquee-right-text` | Independent CanvasTextures on the three authored `replaceableRuntimeText` meshes. |
| `marquee-sign-illumination` | Bounded letterboard material emission; base texture remains readable instead of being bloomed white. |
| `marquee-night-color` | Environment background, night material, floor base/sky. |
| `marquee-marquee-color` | Red trim/neon and front-copy styling. |
| `marquee-incandescent-color` | Bulb families and warm bloom/light character. |
| `marquee-blue-color` | Blue crown neon and rim-light identity. |
| `marquee-architecture-color` | Facade/masonry surface palette. |
| `marquee-bloom`, `marquee-haze`, `marquee-reflection`, `marquee-cinematic-finish` | Standard HDR bloom, volumetric atmosphere, reflective-floor, and finish effects. |

## Audio-to-visual mappings

- Continuous overall/director intensity raises bounded global activity; sub/bass emphasizes canopy, mid/transients animate entrance LEDs, highs animate neon, and vocal presence is used by the restrained intermission program.
- Shared choreography dispatches deduplicated beat, kick, snare, transient, downbeat, phrase, section-change, and drop impulses. The module does not subscribe to or analyze audio independently.
- Kick accents canopy rows; snare accents towers; transient accents entrance LEDs; beat/phrase accent the marquee faces; build raises the layered crown; drop produces a temporary four-beat Premiere Burst and then restores the runtime base pattern.
- Discontinuity, seek/backward time, track replacement, and WebGL context generation changes reset the beat clock, event identities, impulses, and temporary authority.

## Camera and production look

The authored production view is `marquee-hero-camera`: a 39° street-level perspective at `[0, 3.15, 20.5]`, aimed at `[0, 4.7, 1.2]`. This lower viewpoint improves the canopy underside read while retaining the crown and both light towers. Camera drift defaults to a restrained 0.18 and can be set to zero. The render graph is HDR scene → reflective floor → volumetric haze → bloom → cinematic finish. A warm key/fill and cool crown rim complement the actual emissive fixture geometry.

## Files

New implementation files:

- `assets/cinema2/cinema2-marquee-theater/asset.json`
- `public/cinema2/models/marquee-theater.glb`
- `src/components/vyzualz/cinema2/modules/Cinema2MarqueeNativeModule.ts`
- `src/components/vyzualz/cinema2/modules/marquee/Cinema2MarqueeDomain.ts`
- `src/components/vyzualz/cinema2/modules/marquee/Cinema2MarqueeSceneController.ts`
- `src/components/vyzualz/cinema2/presets/Cinema2MarqueePreset.ts`
- `src/components/vyzualz/cinema2/__tests__/Cinema2MarqueePreset.test.ts`
- `src/test/browser/MarqueeProductionBrowserHarness.ts`
- `src/test/browser/cinema2-marquee-production.html`
- `scripts/cinema2-assets/accept-marquee-production.mjs`

Modified integration files are the generated asset manifest/attributions, Three asset registry, native module registry, first-party preset catalog, package scripts, and the shared Three bridge. The bridge change is a generic optional named-model controller hook; presets that do not provide one are unchanged.

The shipped GLB preserves the supplied geometry, hierarchy, extras, materials, and fixture identities. Its embedded presentation textures were resized to a maximum 1024×768 so the actual model fits every Cinema 2.0 tier; runtime text is independently generated at 1024×220 and is unaffected by that optimization. The authoritative unmodified source remains in `docs/Marquee/`.

## Validation results

- Focused Vitest: `Cinema2MarqueePreset.test.ts` — 5/5 passed. Covers catalog/module/asset registration, compiler and authoring gates, exactly four Inspector parents, exact canonical Trigger options, independent string persistence/reset/blank safety, seven distinct pattern signatures, duplicate-event rejection, and auto-override restoration.
- Asset build/check: 20 assets, 71.33 MB shipped; generated manifest and attributions updated. MARQUEE estimates 16,001,336 GPU bytes and remains within all per-tier asset budgets.
- Production browser acceptance: `artifacts/cinema2-marquee-acceptance/run-TczbNK/` — 21 captures across 1920×1080, 2048×1041, high/medium/low tiers, all seven patterns, independent three-face copy, long copy, and empty copy. Every 16:9 pattern produced a distinct screenshot hash.
- Runtime acceptance also passed resize, missing-asset diagnostics, and WebGL context loss/recovery (`contextGeneration: 2`). The sampled 1080p high run reported about 9.05 ms average CPU frame time, 14.14 ms GPU frame time, and 16.0 MB module GPU residency on this machine.
- Repository-wide `npm run typecheck` was attempted once and remains red on pre-existing unrelated test/application errors. No MARQUEE file appeared in the reported errors; per repository policy it was not rerun.

## Remaining visual differences and approval state

The integrated render is recognizable, symmetrical, readable, uses the real three-sided marquee, and exposes the crown, tower bulbs, entrance, and canopy bulb row. The production correction pass reduced letterboard washout and lowered the camera. However, the supplied validation package already labels the source model **not visually approved**, and the integrated model inherits its unresolved geometry differences: the canopy underside remains shallower than the photographic reference, the crown is thinner/more angular, facade dressing is simplified, and the foreground reflection is less cinematic than the approved image. Those cannot be fully corrected without an authoritative revised mesh/source scene.

Automated production acceptance is green. Human comparison against the approved source image is still required, so MARQUEE must be reported as **awaiting visual approval**, not fully visually approved.
