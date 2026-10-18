# DVYDRM Theater | Cinema 2.0 Implementation Specification

**Document type:** Production implementation / integration specification  
**Version:** 1.0 | 2026-10-18  
**Preset working ID:** `theater-marquee` (proposed; check the application registry before finalizing)  
**Status:** **SPECIFICATION ONLY / NOT IMPLEMENTED / NOT VISUALLY APPROVED**  
**Applies to:** New, first-party **Cinema 2.0 native** preset, with a three-sided Art Deco theater marquee and audio-responsive architectural lighting  
**Primary requirement:** All three marquee sign faces must have independently editable, persistent runtime text.  
**Governing contract:** `DRMVYZ_Cinema_2_0_Preset_Creation_Contract_Updated.md` (read for this specification). If the application’s authoritative contract has been updated again, that newer contract takes precedence.  

---

## 0. Implementation mandate

Create a recognizable, reference-matched **real 3D Art Deco theater**. Its three-sided marquee, building facade, illuminated canopy, tall bulb towers, crown neon, curtain, entrance LEDs, windows, glass doors, and wet-ground lighting must be individually defined, visually legible, and correctly controllable.

**Do not** substitute a flat background image with decorative lights. **Do not** replace the marquee with one planar sign or bake three faces into an immutable texture. **Do not** hide incorrect modeling behind bloom, haze, camera tricks, or excessive effects. **Do not** treat the GLB as proof of final visual accuracy. The supplied cleaned PNG is the visual authority; the geometry blueprint and GLB are *editable starting assets*.

**Required delivery sequence:** visual parity -> independent text editing -> manual controls and actual lighting behavior -> six or more genuine native patterns -> shared Audio Intelligence -> Choreography / Visual Director -> authorized Auto Performance -> final camera/effects -> production-canvas acceptance.

### 0.1 What is verified vs. what remains to be built

| Item | Present in supplied artifacts? | Meaning for implementation |
|---|---|---|
| Cleaned reference image | Yes | Visual source of truth, not a real-world measured architectural survey |
| Vector geometry blueprint | Yes | Model-space layout; distances are prototype scene units |
| glTF 2.0 GLB theater model | Yes | 1,833 nodes, 43 meshes, 31 materials, 4 embedded cameras |
| Independent text face nodes | Yes | The **three exact names** below exist in the GLB |
| Named light fixtures | Yes | 1,406 bulb/LED nodes; their presence is **not** independent emission animation |
| Blender scene builder `.py` | Yes | Unexecuted Blender builder; not proof that a `.blend` was created or rendered |
| WebGL standalone HTML demo | Yes | Prototype / interactive reference, **not** Cinema 2.0 integration |
| GLB animation channels | **No** | All production runtime choreography must be implemented by the host |
| Native preset registration, Inspector bindings, live Audio Intelligence | **No** | Must be implemented in DRMVYZ and tested using current APIs |
| Human-approved reference fidelity | **No** | V01–V03 are currently blocking; see visual validation package |

### 0.2 Required upstream files

Use these exact delivered artifact names, taken together. Avoid silently re-generating or substituting source images.

1. `art_deco_theater_marquee_at_night.png` — **approved cleaned reference**, 1448×1086.
2. `DVYDRM_Cinema2_Theater_Geometry_Blueprint.svg` — geometry, depth, sign zones, scene coordinates.
3. `DVYDRM_Cinema2_Theater.glb` — model with node IDs and separate lighting groups.
4. `DVYDRM_Cinema2_Theater_GLTF_Package.zip` — unpack to access `.gltf`, `.bin`, textures and `Cinema2_Theater_Node_Manifest.json`.
5. `DVYDRM_Cinema2_Theater_Blender_Builder.py` and `DVYDRM_Cinema2_Theater_Blender_Scene_Package.zip` — editable scene generation / visual refinement.
6. `Cinema_2_0_DVYDRM_Theater_Prototype.html` — interaction prototype only, **not** the implementation architecture.
7. `DVYDRM_Cinema2_Visual_Validation_Package.zip` — annotated PNG sheets, V01–V08 visual gaps, T01–T08 marquee tests.
8. `DRMVYZ_Cinema_2_0_Preset_Creation_Contract_Updated.md` — mandatory shared design / runtime acceptance criteria.

**Verified SHA-256 asset fingerprints** (detect accidental mixing of versions):

| Asset | SHA-256 |
|---|---|
| Cleaned reference PNG | `e838e6ec783f741a6f469a6abe0cd08b82718a962a1401e01ad69dbf980ae73a` |
| Theater GLB | `746cedbf0d6ee1e8ad2e308975d2ca5b55e47ee4d0c5dd6b88fb2dd5b85541ed` |
| Geometry blueprint SVG | `7d6e0870221ff2249c65f60d846647924ec57973f0dec1b7a408c31d07cf3224` |
| Standalone HTML preview | `ec1a56c95f6cd6e0d600bc22819d17a35be06459bd530fc876cd8f98b58e3bdd` |

---

## 1. Inspect the actual DRMVYZ codebase before changing code

No current DRMVYZ repository ZIP has been inspected as part of *this* specification. The implementer **must discover real application filenames, imports, exports, parameters, types, render ownership, and event APIs** rather than inventing plausible code paths.

Audit and record:

- Cinema 2.0 preset registration/manifest and static asset loading conventions.
- Native scene/module constructors, disposal, animation loop, GPU renderer and postprocessing graph.
- Parameter schema, target resolver, authored vs. resolved state, and generic Inspector grouping/conditional visibility.
- Shared `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` or its canonical successor and existing Pattern Change implementation.
- Shared transport/playback position, BPM Sync path, rhythm/structural events, Audio Intelligence feed, seek/reset semantics.
- Choreography target/value-resolution, Visual Director outputs, Auto Performance authority.
- Camera ownership, scene/effects/lighting systems, render bounds and browser production test harness.
- Current high-quality native Cinema 2.0 implementations (including Mainframe/Conduit/After Hours where applicable).

**Output of inspection:** a short `theater-codebase-integration-map.md` containing *real* source paths, exact exported symbols, reuse decisions, and any incompatibilities. **Stop and resolve major API mismatches before implementing the engine module.** Do not build a parallel Cinema 2.0 runtime or new Inspector framework.

### 1.1 Suggested logical modules (names are conceptual, not claims about existing files)

| Concern | Ownership / responsibility |
|---|---|
| Preset definition | Registers the preset, defaults, parameters, patterns, palette roles and asset reference |
| Theater scene adapter | Loads the GLB and maps its named nodes to typed handles |
| Text surface controller | Generates independent text textures, handles resizing / persistence / cleanup |
| Lighting fixture controller | Maintains index maps and emissive/light output for each zone |
| Theater pattern library | Defines at least six genuinely different, theater-specific programs |
| Theater choreography binding | Resolves shared audio/director signals into temporary native actions |
| Camera/safe-frame handler | Keeps three-face sign geometry, canopy and entrance visible |
| Validation harness | Production render captures, assertions, lifecycle/performance tests |

Use **existing equivalents** wherever available. Add only the preset-specific geometry, behavior, and bindings that are missing.

---

## 2. Visual target and coordinate contract

### 2.1 Approved aesthetic

- Symmetric red-brown brick Art Deco facade; warm windows and recessed poster displays; deep crimson curtain above the sign.
- Three **physically angled**, white letterboard faces with red illuminated borders: front `DVYDRM`, sides `SHOWINGS` / `SHOWINGS` by default.
- Tall side towers of large warm-white circular bulbs, multiple rows of small canopy and marquee-trim bulbs.
- Rounded stepped **red/amber** ornamental neon above the marquee, with strongly distinguished **blue** vertical elements.
- Recessed lobby depth behind green-dark glass doors, golden metal handles, warm lighting, restrained reflective glass.
- Distinct tiled sidewalk and dark, wet-looking roadway with long orange/red/blue reflections.
- A clean, colorful night render with controlled emission and localized glow. The letterboards must remain readable at drop intensity.

### 2.2 World coordinate system

From source `Cinema2_Theater_Node_Manifest.json`:

| Axis | Convention |
|---|---|
| +X | Right across the theater facade |
| +Y | Up in the **glTF** model |
| +Z | Forward toward the street / camera |
| Origin | Source-defined model origin; do not shift without updating camera/sign/light mappings |
| Units | Arbitrary scene units, **not meters** |

glTF -> Blender imports with axis conversion (Blender Z-up). Do not double-convert. In the browser scene, retain source glTF coordinates unless the app already defines a world-axis transformation. Capture and document any root transform applied.

### 2.3 View and framing

- **Default production composition:** 16:9, centrally framed, front hero at a slightly low viewpoint so the **underside canopy rows are exposed**, while the top facade/crown and the entrance remain in frame.
- Side three-quarter views must show actual angled geometry and readable left/right signs; avoid mirror transforms that reverse text.
- Camera may have low-amplitude authorized music response, but cannot clip any letterboard, the crown, or the entrance. Manual camera selection stays user-owned unless the user enables an explicit automatic camera mode.
- Compare the cleaned 4:3 image with the final 16:9 render using a **composition-aware framing match**, not a destructive center crop or a misleading numerical pixel similarity score.

### 2.4 Geometry priority before audio integration

Fix these verified visual gaps from `DVYDRM_Cinema2_Visual_Validation_Checklist.md`:

| ID | Priority | Required adjustment |
|---|---|---|
| V01 | **P0** | Increase visibility and apparent depth of illuminated **canopy underside**; revise model and/or hero camera |
| V02 | **P0** | Replace weak angular crown strokes with **thick, rounded, stepped**, convincingly dimensional red/amber/blue elements |
| V03 | **P0** | Correct framing, marquee dominance, actual three-sided depth and side sign proportions |
| V04 | P1 | Improve lobby, recessed entrance, glass, handles, and visible poster displays |
| V05 | P1 | Separate sidewalk/road and add natural stretched neon/bulb reflections |
| V06 | P1 | Improve warm facade illumination, controlled emission and bloom |
| V07 | P1 | Improve letter weight, outlines, baseline and center/side-specific signage typography |
| V08 | P2 | Refine curtain folds, brick/stone texture and ornamental details |

**Hard gate:** no final Audio Intelligence integration until V01–V03 receive production-path screenshots and human approval. Temporary integration stubs are allowed to scaffold the module, not to claim completion.

---

## 3. Scene graph and preserved GLB names

### 3.1 Root and logical groups

Existing named groups, as listed by the manifest:

```text
DVYDRM_THEATER_ROOT
├── facade
│   ├── facade.brickwork
│   ├── facade.art_deco
│   └── facade.windows
├── entrance
├── curtain
├── canopy
├── marquee
│   ├── marquee.front
│   ├── marquee.left
│   └── marquee.right
├── roof_neon_ornament
├── lighting
│   ├── bulbs.marquee
│   ├── bulbs.canopy
│   ├── bulbs.tower
│   ├── leds.left
│   ├── leds.right
│   ├── neon.red
│   ├── neon.amber
│   └── neon.blue
├── pavement
└── lights.punctual_preview_rig
```

Hierarchy shown is the **desired logical mapping**. Actual nesting of GLB scene nodes must be inspected at load time, not assumed from this illustrative tree. Retain the existing names as stable asset identifiers, and map them to typed controller groups.

### 3.2 Confirmed source asset counts

| Asset family | Named GLB nodes |
|---|---:|
| Marquee-trim bulbs | **216** |
| Canopy bulbs | **718** |
| Tower bulbs | **152** |
| Entrance LED cells left | **160** |
| Entrance LED cells right | **160** |
| **Total bulbs / LEDs** | **1,406** |
| GLB nodes, total | **1,833** |
| GLB cameras | **4** |
| GLB embedded animations | **0** |

**Rendering warning:** fixture-named nodes may share mesh/material instances. Modifying a shared material can light every fixture unexpectedly. Build per-zone/per-instance amplitude attributes, limited material clones, or optimized instance buffers as supported by the actual renderer. Avoid adding 1,406 shadow-casting point lights or one expensive GPU material per fixture. Emissive material intensity and actual punctual illumination are separate responsibilities.

### 3.3 Resource/lifecycle requirements

- Load the GLB **once per live preset instance**, with current host asset caching if available.
- Traverse and assert that all three marquee text nodes are present **exactly once**; treat a missing required node as an actionable asset mismatch, not as a silent fallback.
- Build ordered arrays of fixtures by stable name/spatial position and explicitly document ordering for chase/sweep effects.
- If optimizing into `InstancedMesh` or similar, preserve a stable `sourceNodeName -> instanceIndex` mapping for diagnostics.
- Clone only mutable per-instance materials/texture references where necessary; do not mutate globally shared materials.
- Release generated canvas textures, buffers, subscribers, event handlers, caches and transient envelopes on preset exit. Do not dispose shared cached GLB assets owned by the host.
- Re-entry must reload a valid scene and reapply authored text/colors/pattern parameters without leaking the prior instance's state.

---

## 4. Three independent editable marquee signs (RELEASE BLOCKER)

### 4.1 The three exact source GLB node IDs

| Face | Mesh/node name | Initial text | Outward normal (glTF XYZ) |
|---|---|---|---|
| Front | `marquee.front.TEXT_SURFACE` | `DVYDRM` | `(0, 0, +1)` |
| Left | `marquee.left.TEXT_SURFACE` | `SHOWINGS` | `(-0.683, 0, +0.730)` |
| Right | `marquee.right.TEXT_SURFACE` | `SHOWINGS` | `(+0.683, 0, +0.730)` |

Each source texture is **2048×440 px**. Distinct source glTF material names are `TEXT_SWAP · marquee.front`, `TEXT_SWAP · marquee.left`, and `TEXT_SWAP · marquee.right`.

### 4.2 Grounded text-plane geometry

Source manifest `cornersXYZ`, listed lower-left -> lower-right -> upper-right -> upper-left in the face's local reading direction:

```json
{
  "front": [[-2.8608,3.82,4.63], [2.8608,3.82,4.63], [2.8608,4.89,4.63], [-2.8608,4.89,4.63]],
  "left":  [[-6.5912,3.82,1.5097], [-3.48,3.82,4.4197], [-3.48,4.89,4.4197], [-6.5912,4.89,1.5097]],
  "right": [[3.48,3.82,4.4197], [6.5912,3.82,1.5097], [6.5912,4.89,1.5097], [3.48,4.89,4.4197]]
}
```

Preserve the physical sign faces and their orientation. Perform actual browser testing for correct UV direction and signage reading direction from each camera. Never move text outside the letterboard plane to compensate for a texture UV bug.

### 4.3 Inspector placement and persistence

Under **Design tab > Design parent group > Marquee Text (nested group)** add three **independent string** controls:

- **Front Marquee Text** -> `marquee.front.TEXT_SURFACE`; default `DVYDRM`.
- **Left Marquee Text** -> `marquee.left.TEXT_SURFACE`; default `SHOWINGS`.
- **Right Marquee Text** -> `marquee.right.TEXT_SURFACE`; default `SHOWINGS`.

Use the app's normal parameter definitions, persisted preset settings, undo/reset behavior, and generic Inspector text control. **Do not add a new Inspector special case** for this preset. Persist the **underlying Unicode string**, not a generated image blob.

At runtime:

1. Resolve the named mesh and clone its *own* independently mutable material.
2. Generate the corresponding text image using the app's supported text/canvas/atlas mechanism; choose deterministic fonts and fallbacks.
3. Clear the face surface, draw the white/light ivory panel and dark/red outlined glyphs (face-specific configurable styling), center and auto-fit within safe insets.
4. Update only the selected face's texture. Mark it dirty through the renderer's own texture update path and clean up the previous generated texture.
5. Preserve the base geometry, red trim, perimeter bulbs, physical depth, neon and illumination.
6. Refresh on parameter change, import/preset-load, renderer/context recovery, and font-ready transitions. **Do not** regenerate every frame.

**Note:** source 2048×440 textures are guidance; higher/lower dynamic resolution is allowed to match renderer memory budgets. For a Three.js glTF surface, verify color-space handling, sRGB output, orientation/`flipY` and texture transform on a test render. Don't assume a universal `flipY` value without validating the actual loader/texture configuration.

### 4.4 Text policy

- Allow letters, numerals, spaces, punctuation and normal Unicode text where supported by the selected font. Unsupported characters should use documented fallback rather than blank/missing UVs.
- Suggested initial budget: **1–28 Unicode code points per face**; the implementer may adopt a different well-tested bound, but must communicate it in the Inspector. Test 1, 12, 24, and boundary-length strings.
- Auto-size while preserving padding; optionally use two lines **only when expressly supported in the design**. Default should be a single visually centered line. No clipping through trim or neon.
- Empty text means a **blank illuminated letterboard**, rather than reverting automatically to the default.
- String content remains fixed while Audio Intelligence, Pattern Change or Auto Performance alters lighting.
- Ensure no mirrored text, text overlap, dark-on-dark contrast loss, z-fighting or stale textures when editing rapidly.
- Keep text **text-based**, never permanently bake user input into the GLB. Blender native `C2_TEXT_*_EDITABLE` FONT objects are offline authoring helpers, not browser runtime objects.

### 4.5 Mandatory text tests (all three faces)

`T01` front-only change; `T02` left-only change; `T03` right-only change; `T04` short/long text fitting; `T05` punctuation/Unicode/blank; `T06` orientations and three-quarter cameras; `T07` persistence during beat/build/drop and pattern changes; `T08` reload/seek/re-entry and repeat edits. Tests **must exercise the production preset**, not only the standalone HTML.

---

## 5. Lighting, bulbs, neon, reflective environment

### 5.1 Required independently controllable families

| Logical target | Default role | Independent consumer proof |
|---|---|---|
| `bulbs.canopy` | 718 underside fixtures | Per-row / progressive wave and kick swell visibly traverse canopy |
| `bulbs.marquee` | 216 perimeter fixtures | Ordered perimeter chase with front/left/right panel awareness |
| `bulbs.tower` | 152 large vertical fixtures | Left/right and top/bottom accents independent of marquee trim |
| `leds.left` | 160 entrance LED cells | Independent left-side intensity and local sequences |
| `leds.right` | 160 entrance LED cells | Independent right-side intensity and local sequences |
| `neon.red` | Red border/crown | Controllable red emission and build/drop accent |
| `neon.amber` | Warm crown accents | Warm step illumination separate from red/blue |
| `neon.blue` | Vertical accents | Blue accent/sweep independent from warm lamp families |
| architectural ambient | Facade and lobby | Warm facade and lobby stay believable while reactive emitters change |
| reflection pass | Pavement/road | Corresponding reflection responds to real light activity, with limits |

### 5.2 Fixture programming model

For each fixture, maintain **stable spatial/group metadata** (zone, side, row, column, ordinal perimeter position, home intensity and palette role). Support independent `brightness[fixture]` or optimized equivalent. If a fixture mesh is shared, update the correct GPU instance attribute or explicit supported override rather than mistakenly changing all identical bulbs. Treat ordered bulb arrays as metadata, not duplicate geometry or 1,406 new real lights.

Proposed compositing rule (must use Cinema 2.0's existing target resolver if present):

```text
resolvedIntensity = clamp(
  authoredMaster * authoredZoneIntensity
  * (authoredPatternShape + boundedAudioModulation)
  * directorBoundedGain,
  0, zoneCeiling
)
```

This equation illustrates *intent*, not an invitation to bypass host authority. In particular, `zoneEnabled = false` must force effective output **OFF** even during drop or Auto Performance. Fade/shimmer behavior should use attack/decay and minimum-visible-state rules, not direct raw FFT frame noise.

### 5.3 Emission, scene illumination and limiting

- Emissive bulbs/neon give the correct shape; a **limited set** of actual light sources can provide nearby facade/entrance illumination. Do not create thousands of point lights.
- Expose master, per-zone, bloom, haze and maximum output where meaningful. Use the existing Cinema 2.0 lighting limiter and effect path when present.
- `Bloom = OFF` must leave clearly readable bulbs, signs and modeled neon; bloom should not be the only thing making shapes visible.
- Protect letterboard contrast and postprocessing highlights from oversaturation; visually compare quiet vs. peak-drop frames.
- Reflection intensity scales with participating emitters, but the street must not turn into a fully mirrored floor.

---

## 6. Inspector parameter specification

**Mandatory top-level Design-tab parent groups:** `Master Controls`, `Design`, `Effects`, `Palette`. Nested groups are permitted. All controls must use the normal parameter schema, binding and visible-output validation.

### 6.1 Proposed Inspector schema (labels and defaults are design choices unless marked CONTRACT)

| Path | Label / type | Suggested default | Consumer / behavior |
|---|---|---|---|
| Design > Master Controls | **BPM Sync**, boolean **CONTRACT** | ON | Chase/step timing uses shared transport when ON; deliberate free-running cadence when OFF |
| Design > Master Controls | Master Intensity, 0–1 | 0.80 | Visible emission/scene balance, bounded by output limiter |
| Design > Master Controls | Auto Performance, boolean | OFF | Authorized temporary performance decisions only |
| Design > Master Controls | Camera Motion, boolean | OFF | Hard disables camera automation |
| Design > Design > Patterns | **Pattern**, enum **CONTRACT** | Opening Night | At least six native pattern programs; immediate manual selection |
| Design > Design > Patterns | **Pattern Change**, boolean **CONTRACT** | OFF | Automatic pattern progression enabled by shared Trigger |
| Design > Design > Patterns | **Trigger**, enum **CONTRACT** | Bar | Visible only when Pattern Change ON; canonical shared 11 options |
| Design > Design > Marquee Text | Front Marquee Text, text | DVYDRM | Face-specific CanvasTexture/atlas update |
| Design > Design > Marquee Text | Left Marquee Text, text | SHOWINGS | Face-specific CanvasTexture/atlas update |
| Design > Design > Marquee Text | Right Marquee Text, text | SHOWINGS | Face-specific CanvasTexture/atlas update |
| Design > Design > Lighting | Canopy Brightness, 0–1 | 0.80 | `bulbs.canopy` |
| Design > Design > Lighting | Marquee Bulbs, 0–1 | 0.85 | `bulbs.marquee` |
| Design > Design > Lighting | Tower Bulbs, 0–1 | 0.80 | `bulbs.tower` |
| Design > Design > Lighting | Entrance LEDs Left, 0–1 | 0.70 | `leds.left` |
| Design > Design > Lighting | Entrance LEDs Right, 0–1 | 0.70 | `leds.right` |
| Design > Design > Lighting | Crown Neon, 0–1 | 0.80 | Crown red/amber/blue bounded collective intensity |
| Design > Design > Lighting | Perimeter Chase Speed, 0–1 | 0.45 | Pattern-specific chase timing; respects BPM Sync |
| Design > Design > Camera | Camera View, enum | Front Hero | Documented bounded camera presets |
| Design > Effects | Bloom, 0–1 | 0.35 | Host bloom target |
| Design > Effects | Haze, 0–1 | 0.10 | Host atmosphere target |
| Design > Effects | Wet Road Reflections, 0–1 | 0.55 | Reflection strength, no flat-image trick |
| Design > Palette | **Brick / Background**, color **CONTRACT** | warm brick/night | Architecture/background role, independent consumer |
| Design > Palette | **Marquee Red**, color **CONTRACT** | classic neon red | Red trim/crown role, independent consumer |
| Design > Palette | **Incandescent Gold**, color **CONTRACT** | warm amber | Bulb emission role, independent consumer |
| Design > Palette | **Crown Blue**, color **CONTRACT** | electric cyan-blue | Blue neon role, independent consumer |
| Design > Palette | Curtain Red, color (optional) | deep velvet red | Separate curtain material role |

**Palette contract:** at least **four real, independent color inputs** under `Design > Palette`. A background control is mandatory if the preset owns a configurable background. The four recommended above have different target groups; one changing must not silently mutate the others. These are authored base colors; automatic performance may add bounded emission changes only, not silently replace selected colors.

**BPM Sync contract:** user-facing `BPM Sync` under `Design > Master Controls` must visibly alter pattern time domains. Sync ON uses shared beat/bar/phrase events for chases and stepped variations; Sync OFF uses an authored free-running clock with deliberate rates, while audio amplitude responses remain active. Do not create a new BPM/beat detector or allow competing host/local toggles to fight.

### 6.2 Exactly 11 shared Trigger options

**Use `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` or its actual canonical successor, rather than hardcoding a second list.** The required shared values and labels are:

| Value | Label | Value | Label |
|---|---|---|---|
| `beat` | Beat | `kick` | Kick |
| `snare` | Snare | `downbeat` | Downbeat |
| `beat2` | Every 2 Beats | `beat4` | Every 4 Beats |
| `bar` | Bar | `bar4` | Every 4 Bars |
| `bar8` | Every 8 Bars | `phrase` | Phrase |
| `drop` | Drop | | |

The actual dropdown must expose the **same eleven** event meanings and canonical enumerated values. Trigger picks *when* to change patterns, never an unrelated shape/style of visual change.

---

## 7. Pattern library: at least six actual theater programs

Unlike a shared generic preset library, these are **suggested native theater-specific designs** that the implementer must render and individually validate. At least six are required; there is **no fixed maximum**. Preserve freedom to refine names/choreography while maintaining genuine differentiation and the required count.

| Pattern | Distinct visible geometry/light programming | Rhythm / authored behavior |
|---|---|---|
| **Opening Night** | All three marquee borders remain softly outlined; front lettering is hero; slow warm perimeter highlights | Low-motion, marquee-first presentation with occasional musical bulb accents |
| **Canopy Cascade** | Progresses aligned rows of the **718 underside bulbs** from facade toward the street edge in visible depth | Kick initiates or intensifies traveling rows; shared BPM Sync governs row cadence |
| **Triple-Face Relay** | Bright signal travels sequentially around **left -> front -> right** marquee trim, emphasizing three physical faces | Beat/bar triggers distinct panel-to-panel transfer; respects face ordering |
| **Tower Call & Response** | Left and right **large-bulb towers** alternate vertically; entry LEDs echo on opposite sides | Snare/beat interplay with left-right spatial contrast and a defined rest state |
| **Neon Crown Rise** | Red/amber stepped crown accumulates light in layered bands while blue center accent traces rise | Build progress enhances geometry-specific staged neon, not a generic overall brightening |
| **Velvet Intermission** | Lighting reduces around architecture but retains readable letterboards; curtain wash and subtle warm bulbs take prominence | Quiet/vocal passages yield negative space, subdued movement and graceful warm accents |
| **Premiere Burst** *(optional seventh)* | Coordinated perimeter reveal, canopy wave, tower strike and restrained road reflections | Drop-driven staged impact with a bounded tail, no uncontrolled strobes |

**Implementation requirement:** each pattern defines (a) active geometry families, (b) ordered animation logic, (c) modulation envelope, (d) idle state, (e) reset/seek behavior, (f) lighting limiter behavior. It must produce a **materially different production-canvas result** from the others. Six aliases of the same sine-wave brightness modulation **fail**.

### 7.1 Manual Pattern / Pattern Change / Trigger authority

Use the updated shared Cinema 2.0 contract, including these exact semantics:

1. Pattern (authored base) changes immediately upon manual selection, whether Pattern Change OFF or ON.
2. **Pattern Change OFF:** hold that pattern, do not advance automatically, hide/disable Trigger as an active Inspector control, but preserve its persisted value.
3. **Pattern Change ON:** advance only on a **new qualifying** event of the chosen shared Trigger; no stale trigger immediate jump; no duplicate events and no accidental consecutive repeats.
4. Manual selection **while Pattern Change ON stays ON**: show the selected pattern now, hold it until the next *new* qualifying trigger, then resume progression.
5. Auto Performance **may temporarily substitute** a build/drop pattern only when that domain is authorized. It cannot mutate the authored Pattern, Pattern Change or Trigger.
6. During temporary override, the underlying auto-switch controller still evolves deterministically on valid events; on override end, reveal the correct underlying currently selected base pattern.
7. A manual Pattern edit must not be immediately canceled by the **same already-active** drop/build event. Future separately qualifying events may start allowed overrides.
8. Pause, seek, loop, track change, parameter edits, or re-entry must reset/reconstruct transitions without stale or double switching.

### 7.2 Suggested pattern runtime state (illustrative, adapt to existing host controller)

```ts
// Pseudocode shape ONLY. Reuse the host's existing pattern controller.
type TheaterPatternState = {
  authoredPatternId: string;       // persist user choice
  runtimeBasePatternId: string;    // advances on new Trigger when enabled
  activeOverride: null | {
    patternId: string;
    reason: 'build' | 'drop';
    eventId: string;
  };
  lastHandledTriggerEventId: string | null;
  triggerArmedAfterEpoch: number;  // prevent prior active event hijacking manual edit
};
// Visible pattern = activeOverride?.patternId ?? runtimeBasePatternId.
// Persist authoredPatternId, toggle, trigger; never persist the transient override.
```

Use shared event IDs/transport epochs and shared resolver semantics, not a custom timing clock that races Cinema 2.0.

---

## 8. Audio Intelligence -> Choreography -> physical output

### 8.1 Ownership separation

- **Audio Intelligence:** shared musical facts (sub/bass/mids/highs, kick/snare/beat/downbeat/bar/phrase, vocal, build, drop, etc.). **No** theater-specific decisions and **no** local beat or drop detector.
- **Visual Director:** broad significance / momentum / build pressure; never addresses theater bulbs by name.
- **Theater native module + Choreography:** maps those facts to scene-group animation targets, with bounded transient operations through the existing target resolver.
- **Authored parameters:** remain the underlying truth. User-hard-disabled lighting zones, camera motion or effects stay off under any choreography.
- **Auto Performance:** can own only expressly permitted temporary variation (e.g., staged build/drop hero patterns, optional phrase-aware camera); cannot overwrite text or manual colors.

### 8.2 Audio routing map (authoring proposal)

| Shared source | Target group | Audible-to-visual meaning | Envelope / ceiling policy |
|---|---|---|---|
| **Sub / bass energy** | `bulbs.canopy`, reflected road warmth | Sustained lower canopy warmth / slow swell, not harsh flicker | Smooth continuous energy; user-controlled strength ceiling |
| **Kick event** | Select canopy row frontward traveling impulse | Clearly visible depth-wise pulse | Short attack, musical decay, duplicate-suppressed |
| **Snare event** | `bulbs.tower` / entrance LEDs | Alternating left-right tower accents | Fast attack, bounded brightness, optional echo to opposite side |
| **High-frequency energy** | `neon.blue`, selective small trim bulbs | Thin crisp shimmer on high end | Filtered/smoothed micro accents, avoid full-scene white flashes |
| **Beat / bar** | `bulbs.marquee` | Advance perimeter chase position or sweep phase | Quantized when BPM Sync ON; free cadence when OFF |
| **Phrase boundary** | Pattern choreography phase, slow color/emission distribution | Transition meaningful *arrangement* within selected pattern | Debounced, no direct authored Pattern mutation |
| **Vocal presence** | Curtain and sign emphasis; accent reduction | More legible/quiet architectural presentation, less density | Bounded negative modulation; never remove signed text |
| **Build progress** | `neon.red`, `neon.amber`, crown staging | Incremental step lighting, anticipation and tension | Progress-sensitive, returns cleanly on exit |
| **Drop** | Canopy, towers, perimeter trim, LEDs, limited facade bounce | Multi-stage coordinated marquee reveal with a bounded impact tail | One authoritative shared drop event; no double trigger |
| **Overall energy** | Bounded global activity/contrast | High-energy sections look more active than quiet sections | Never blindly maps everything to uniform brightness |
| **Visual Director significance** | Pattern intensity/camera restraint/effect ceiling | Contextual scale, not musical re-detection | Limits and source ownership must be explicit |

**Concrete source names differ by app implementation.** Bind to inspected real API fields and events. Document the canonical input, normalization, smoothing, consumer, max/attack/decay, and seek behavior for each implemented route. No hidden parallel analyzer.

### 8.3 Timing and transport lifecycle

| Host condition | Required response |
|---|---|
| No track | Deliberate readable ambient theater scene; no fake beat-driven changes |
| Loaded, paused | Stable authored lighting, no pending pulse replay |
| Start / resume | Resume shared timeline without duplicate past events; smooth visual ramp |
| Seek | Clear stale impulse envelopes, recompute deterministic phase and active transition |
| Loop | Respect host loop epoch; no double-fire at boundary |
| Track change | Clear old analysis/transport state and transient overrides |
| Pause -> resume | No fixture burst from stale queued impulses |
| Preset exit / re-entry | Release subscriptions/resources; restore authored controls and clean runtime state |
| BPM Sync toggle | Switch timebase cleanly; beat-locked and free-running behavior visually distinct |

---

## 9. Authority matrix (required before coding)

**Mode vocabulary:** user-owned (U), user base + bounded intelligence (U+I), intelligence-owned only by explicit opt-in (I). These are proposed ownership choices and must be checked against actual host resolver support.

| Domain | Authored control | Choreography allowed | Visual Director | Auto Performance allowed | Manual edit / hard authorization |
|---|---|---|---|---|---|
| Three text strings | U | **None** | **None** | **Never** | Immediately render and persist exact new text |
| Palette roles | U | Optional bounded emission amplitude only, not color replacement | No direct color edits | No color selection | Manual palette always base truth |
| Master / zone brightness | U+I | Bounded pulse/gain | Bounded meaning scale | May modulate within ceiling | Zero/disabled zone remains zero |
| Pattern | U base | Current pattern responds continuously | Significance only | Temporary build/drop substitution if authorized | Manual selects immediately; Pattern Change remains ON when already ON |
| Pattern Change and Trigger | U | Shared qualifying event advances runtime base when ON | None | Cannot change control values | Retain user settings; Trigger hidden when OFF |
| BPM Sync | U | Changes permitted choreography timebase | None | Cannot silently flip Sync | Host vs preset sync composition documented |
| Crown/LED shape/chase | U+I | Native pattern may animate according to audio | Bounded strength | Optional temporary staging | Manual zone authorization respected |
| Camera View | U | Subtle defined motion only if enabled | May advise significance | Optional explicitly enabled auto camera | Manual view/camera OFF takes precedence |
| Bloom/haze | U+I | Bounded transient only if enabled | May scale authorized amplitude | Optional transient under ceiling | Hard OFF cannot be re-enabled |
| Facade/curtain structure | U | No arbitrary geometry replacement | None | No | Stays source-reference recognizable |

**Implementation requirement:** use host value resolution; do not invent a separate post-resolver system that visually ignores the Inspector value. Record conflict outcomes in production screenshots/tests.

---

## 10. Camera, postprocessing, performance and compatibility

### 10.1 Required cameras

Minimum production viewpoints and captures:

- `CAM_01_front_hero_16x9.png`: approved low-enough front hero; canopy underside, sign crown, entrance all visible.
- `CAM_02_left_three_quarter.png`: correct left sign text and physical depth.
- `CAM_03_right_three_quarter.png`: correct right sign text and physical depth.
- `CAM_04_low_angle_canopy.png`: underside rows are real geometry, not a glow texture.
- `CAM_05_marquee_text_closeup.png`: lettering and red trim readable, no clipping or z-fighting.
- `CAM_06_neon_crown_closeup.png`: thick stepped colored crown, visible construction and controlled glow.

The source GLB contains four cameras, while the Blender builder *proposes* five view cameras. Treat labels above as **required validation outputs**, not guaranteed existing camera IDs. Create/adjust cameras with the app's existing camera system.

### 10.2 Effects

- Tune physically legible emission **before** bloom.
- Bloom, haze, reflection and camera motion must have OFF/default/high comparison captures.
- Prevent lighting from erasing text or overexposing canopy geometry at a drop.
- Keep effect dependencies inside the app's standard render graph. Do not create an incompatible renderer.

### 10.3 Performance and browser constraints

- Target the application's supported WebGL feature level and baseline hardware; record exact target device/GPU/browser before locking FPS budgets.
- Test 1920×1080 production canvas over a sustained real audio interval. Define a **measured target FPS and frame-time budget** with the team; don't invent a universal threshold.
- Minimize draw calls from 1,406 lamp/LED nodes through supported GPU instancing/merged meshes + per-instance data. Preserve accessible instance mapping for patterns and diagnostics.
- Avoid a full expensive point light per bulb; use emissive meshes plus budgeted area/point light proxies and bloom.
- Reuse geometry/materials, update dynamic attributes rather than reallocate objects every frame.
- Generate sign textures **on change**, not on every audio frame; throttle rapid edits and dispose old GPU textures.
- Verify asset loading over Vercel/static hosting conventions, relative URLs, CORS/content type and SSR/client boundaries as relevant to the actual app.
- Browser WebGL failure should be caught with a meaningful error/fallback; do not silently present a photograph and claim the 3D preset is operating.

---

## 11. Implementation stages and stopping conditions

### Stage 0: Repository integration reconnaissance

- [ ] Read latest contract and current real code paths; produce codebase integration map.
- [ ] Identify existing shared 11-option Trigger constant and event timing semantics.
- [ ] Check asset pipeline and permissions for GLB/source material deployment.
- [ ] Confirm renderer, camera, Inspector, parameter bindings, persistence.
- [ ] Establish test scene and release gate.

**Exit:** exact integration map; no invented API.

### Stage 1: Reference-locked geometry and renderer

- [ ] Load GLB in the real Cinema 2.0 production visualizer; test without Audio Intelligence.
- [ ] Preserve/verify root, text nodes, fixture groups and materials.
- [ ] Fix V01–V03; improve V04–V08 afterward.
- [ ] Render 16:9 hero + the three-quarter/low-angle checkpoints.

**Stop ship:** if the recognizable marquee, exposed canopy, or rounded crown differ significantly from approved reference.

### Stage 2: Three-face text and all primary controls

- [ ] Wire front/left/right string fields with separate persistent textures.
- [ ] Add mandatory BPM Sync, at least four real Palette colors and pattern control set in correct groups.
- [ ] Bind lighting zone, camera/effect sliders to visible consumer properties.
- [ ] Capture low/default/high per important continuous control; exercise all important enum states.

**Stop ship:** if any sign is shared, mirrored or not persisted, or a control is visually inert.

### Stage 3: Native authored movement and at least six distinct patterns

- [ ] Implement six or more fully authored theater patterns with genuinely different geometry-specific timing and activity.
- [ ] Test each with no music and deterministic manual pattern selection.
- [ ] Validate actual frame-to-frame movement, not just changing state values.
- [ ] Confirm BPM Sync ON/OFF changes intended time domains.

**Stop ship:** if patterns are aliases or sync has no real visual consumer.

### Stage 4: Shared Audio Intelligence and target resolver

- [ ] Connect continuous, rhythmic and structural shared sources, no alternate detector.
- [ ] Create explicit per-route bounds/attack/decay and consumed target mappings.
- [ ] Test silence, steady groove, vocal, kick, snare, build, drop and phrase changes.
- [ ] Test dropped/duplicate events, pause/resume, seek/loop, track change and re-entry.

**Stop ship:** if only generic overall brightness responds, or transport changes produce stale effects.

### Stage 5: Pattern Change, Trigger and authorized intelligence

- [ ] Wire the **exact shared 11 triggers** and conditional visibility.
- [ ] Verify manual pattern updates while Pattern Change ON keep the toggle ON and hold until next new event.
- [ ] Add strictly temporary, bounded Auto Performance build/drop substitute patterns if enabled.
- [ ] Make underlying base pattern deterministic during overrides, and restore it correctly.
- [ ] Enforce all manual/hard-off priority rules.

**Stop ship:** if automation fights user settings or double-switches on an old event.

### Stage 6: Quality, performance, proof

- [ ] Optimize instancing and realistic limited point light illumination.
- [ ] Add controlled bloom/haze/reflections only now.
- [ ] Run final browser production path and screenshot matrix.
- [ ] Review V01–V08 and T01–T08 against approved references.
- [ ] Complete performance profiling and resource disposal verification.
- [ ] Obtain **human visual acceptance** of the real rendered preset.

**Stop ship:** if only unit tests/mockups pass but the production canvas was not examined.

---

## 12. Production acceptance matrix

The implementer must deliver pass/fail with **a screenshot/video/automated trace**, browser/renderer details, and a reproducible procedure for every check. Initial state of all checks: **NOT EXECUTED**.

| ID | Test | Pass condition |
|---|---|---|
| GEO-01 | Reference hero | V01–V03 corrected; readable three-sided marquee, bright underside and rounded crown |
| GEO-02 | Viewports | Front, both 3/4, low-angle, closeups show real unbroken geometry and correct text |
| TXT-01..08 | Three independent texts | All T01–T08 from visual package pass with correct independence, fitting, persistence and orientation |
| CTRL-01 | Mandatory grouping | All Inspector controls under exactly one of Master Controls / Design / Effects / Palette |
| CTRL-02 | BPM Sync | Correct placement and visibly different locked/free-running timing, lifecycle-safe |
| CTRL-03 | Palette | At least four independent working color inputs under Palette, each distinct output consumer |
| CTRL-04 | Pattern controls | Pattern / Pattern Change / Trigger in that order under Design > Design |
| CTRL-05 | Trigger list | Exactly canonical 11 shared Trigger values and labels; visible only if Pattern Change ON |
| CTRL-06 | Patterns | At least six real native, visually distinct theater programs; every selection perceptible |
| CTRL-07 | Wiring | Min/mid/max values change intended production pixels, not just internal state |
| TRG-01 | Manual + OFF | Authored Pattern remains held, no auto advance, audio modulation continues |
| TRG-02 | Manual + ON | Manual selection immediate; toggle remains ON; next **new** event advances |
| TRG-03 | Event de-duplication | Duplicate stale event cannot double-change; seek/loop/track change safe |
| AUTO-01 | Build/drop override | Override temporary, scoped, never mutates authored Pattern/Trigger, resumes current base |
| AUTH-01 | Hard-off | Disabled camera/zone/effect not re-enabled by drop or Auto Performance |
| AUD-01 | Continuous | Bass/high/overall sources produce intentional spatially distinct output |
| AUD-02 | Events | Kick, snare, beat/bar and drop align with expected groups and timestamps |
| AUD-03 | Structures | Build/phrase/drop affect meaningful theater choreography, not blanket glow |
| LIFE-01 | Idle and resume | Deliberate ambient visual; no stale impulses when audio starts/resumes |
| LIFE-02 | Seek/loop/track | Envelopes/trigger state deterministically recomputed or reset |
| LIFE-03 | Re-entry | All three text strings and authored controls restored; subscriptions/assets clean |
| FX-01 | Effects | Bloom/haze/reflections OFF/default/high each visibly differ without masking geometry |
| PERF-01 | Runtime profile | Agreed target FPS/frame time, no uncontrolled per-frame allocations or GPU leaks |
| FINAL-01 | Human review | Approved reference-based review on actual production render, not only demo or mockup |

### Evidence packet to attach to PR

- All six `CAM_*.png` captures plus one production still at **quiet**, **build**, **drop**.
- At least one short comparison video showing **two genuinely different patterns**, and a second clip showing three independent text updates.
- Filled-in V01–V08 / T01–T08 tables and CTRL/TRG/AUD/LIFE acceptance results.
- Before/after screenshots for each of four palette controls, BPM Sync ON/OFF and one disabled lighting zone during a drop.
- Render settings (canvas dimensions, DPR, GPU/browser, tone mapping, bloom, exposure), benchmark details, known deviations and rationale.
- A concise inventory of added/modified code files and their intended role, with actual source paths.

---

## 13. Failure modes and explicit prohibitions

1. **No picture-as-preset:** do not place a full reference screenshot on a plane and claim 3D fidelity.
2. **No fake editable signs:** all three signs require separate runtime text values/surfaces and genuine persistence.
3. **No shared texture accident:** left/front/right changes must never bleed across faces.
4. **No one-size-fits-all choreography:** six superficially relabeled brightness waves are insufficient.
5. **No alternate musical engine:** do not add another beat/drop/BPM/phrase analyzer or independent transport clock.
6. **No placebo controls:** all visible Inspector parameters need production-canvas proof.
7. **No automatic ownership theft:** Auto Performance cannot silently overwrite manual settings or keep stale pattern overrides.
8. **No effects-as-geometry:** do not make incorrect crown/canopy look acceptable solely via bloom or camera crop.
9. **No world-axis assumptions:** preserve model-space handedness, normals, UVs and browser/Blender axis distinctions.
10. **No GPU disaster:** thousands of named fixture nodes must not automatically become thousands of individually shadow-casting real lights.
11. **No unsupported asset claims:** Blender `.blend` generation and native WebGL runtime must be tested on machines where those paths are available.
12. **No unverified done declaration:** only production render + manual testing + human reference acceptance closes the work.

---

## 14. Implementation handoff: sequence for Codex or Claude Code

> Read the latest Cinema 2.0 Preset Creation Contract, this implementation specification, the approved cleaned PNG, Geometry Blueprint SVG, GLB node manifest, and Visual Validation Package. Inspect the current DRMVYZ repository and first return a codebase integration map identifying the real preset registration, native module, Inspector definitions, parameter targets, audio bridge, choreography resolver, shared trigger options, renderer, camera pipeline and existing test harness. Do not invent paths or create a parallel engine. Then implement this new theater preset in the staged order defined above. Preserve the exact three `marquee.*.TEXT_SURFACE` nodes and provide separate persistent text inputs for front, left and right. Treat the cleaned PNG as the visual authority, correct V01–V03 before audio integration, and build all mandatory Cinema 2.0 controls (BPM Sync, four independent Palette colors, at least six theater-specific Patterns, Pattern Change and canonical Trigger behavior). Wire actual shared Audio Intelligence and deterministic target-resolution choreography, with documented user vs automation authority. Submit production-path screenshots/tests and an honest pass/fail checklist; never report completion from compile success or a static GLB import alone.

### Completion deliverables

- [ ] Native registered Cinema 2.0 theater preset and scene/module renderer.
- [ ] Persistent three-face text Inspector control and runtime text renderer.
- [ ] At least six theater-specific native pattern definitions and correct switching authority.
- [ ] Complete Inspector schema with real parameter consumers, BPM Sync, canonical triggers and four Palette colors.
- [ ] Audio signal-to-target routing, bounded choreography and optional Auto Performance overrides.
- [ ] Lifecycle-safe asset, GPU/material/texture and event ownership.
- [ ] Camera and material/light/reference corrections V01–V08.
- [ ] Browser production-path tests, screenshots, and visual validation findings.
- [ ] Documentation of exact code paths, measured performance and remaining known differences.

---

## 15. Truth-in-delivery and sign-off

This document is a **production-ready implementation specification**, not a completed Cinema 2.0 preset, not a record of a passed WebGL production render, and not evidence of a generated Blender `.blend`. The underlying GLB node names/counts and the approved reference are grounded in delivered assets; **application integration details remain contingent on the live DRMVYZ source code**.

**Sign-off rule:** Visual first, controls next, musical performance third. The preset is only ready when the theater still resembles the approved Art Deco reference **and** every manually authored element, lighting program, text face, trigger and audio response behaves predictably in the production visualizer.
