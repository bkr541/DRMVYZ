# 03. Inspector Control Specification, Bindings and Palette

## Placement is mandatory

All primary design controls appear within the preset's schema-driven **Design tab**, under one of the four generic parent IDs: `master-controls`, `design`, `effects`, `palette`. Use `designParentGroup` to assign the parent; `group` is the optional subgroup. Do not special-case CANOPY in the shared React Inspector. Every public parameter gets a real rendering/effect consumer and min/default/max or discrete-option screenshot checks.

## Proposed primary control matrix

| Parent > subgroup | Label / Type | Proposed default and range/options | Authored target and visible proof |
|---|---|---|---|
| Master Controls > Output | **Master Intensity** / float | 0.78; 0–1 | Scales all lit diffusers and washes; 0 eliminates emitted light (physical dark fixtures remain) |
| Master Controls > Timing | **BPM Sync** / **boolean** | **ON** | Changes pattern motion phase between shared beat-grid timing and smooth unsynced time, without suppressing kick response |
| Master Controls > Performance | **Auto Performance** / boolean | OFF | Enables only documented transient structural/camera enhancement domains; manual controls still win |
| Design > Pattern | **Pattern** / **enum** | Waterfall; six options in `04` | Immediately alters rod formation + motion in visible canvas |
| Design > Pattern | **Pattern Change** / **boolean** | **OFF** | OFF locks base; ON permits advances at new selected canonical Trigger |
| Design > Pattern | **Trigger** / **enum** | `bar4`; canonical 11 choices | Conditional `visibleWhen`: Pattern Change true; controls *when* pattern advances |
| Design > Structure | Rows / integer | 8; 4–12 | Actual row count, renderer instance count; guard max total |
| Design > Structure | Columns / integer | 8; 4–12 | Actual column count, renderer instance count; guard max total |
| Design > Structure | Row Spacing / float | 1.0; 0.75–1.4 | Real front-back spacing with safe framing |
| Design > Structure | Column Spacing / float | 1.08; 0.75–1.4 | Real left-right spacing |
| Design > Structure | Rod Length / float | 1.45; 0.6–2.1 | Physical length of each diffuser, not just glow |
| Design > Structure | Length Variation / float | 0.22; 0–0.65 | Visible authored per-rod deterministic variation |
| Design > Motion | Motion Amount / float | 0.55; 0–1 | Upper bound on vertical lift/physical pattern motion; at 0 freezes geometric motion |
| Design > Motion | Motion Speed / float | 1.0; 0.3–2.0 | Pattern phase period, BPM-aware if Sync ON |
| Design > Motion | Height Range / float | 0.45; 0–0.8 world units | Max physical offset; clamped to safe tip/cap bounds |
| Design > Motion | Symmetry / boolean | ON | Mirrors selected spatial formations; OFF permits asymmetrical pattern variants |
| Effects > Light | Idle Glow / float | 0.28; 0–0.6 | Minimum per-fixture emissive output with no events |
| Effects > Light | Accent Strength / float | 0.55; 0–1 | Scales bounded hit-related intensities/physical nudge |
| Effects > Light | Bloom Amount / float | 0.20; 0–0.6 | Must wire to supported engine-owned HDR bloom effect; visible OFF/default/max |
| Effects > Camera | Camera Motion / boolean | OFF | Hard authorization: camera animation NEVER occurs if off |
| Palette > Roles | **Background** / **color** | `[0.012,0.016,0.025,1]` | Native preset environment backdrop; distinct from rod body |
| Palette > Roles | **Primary Rods** / **color** | `[0.3,0.91,1,1]` | Primary emitter group color (e.g. even banks) |
| Palette > Roles | **Secondary Rods** / **color** | `[0.55,0.4,1,1]` | Secondary emitter group color (odd banks) |
| Palette > Roles | **Accent Hits** / **color** | `[1,0.76,0.47,1]` | Color for event-highlighted fixtures and temporal accents |
| Palette > Roles | **Mounting Structure** / **color** | `[0.11,0.17,0.21,1]` | Physical cap/grid body; independently visible even without music |

Numbers and colors are proposed, not observed defaults. Choose actual `Cinema2Color` values and use schema-compliant `type: 'color'` for all five roles. **Four are required; five are proposed** to give a truly independent non-emissive structure role. Do not let “Color Mode” or a gradient replace those controls.

## Mandatory controls specifics

### Pattern / Pattern Change / Trigger

1. Define `Pattern` (type `enum`) with the six CANOPY options from `04_PATTERN_AND_TIMING.md`; no fixed maximum rule.
2. Define `Pattern Change` (type `boolean`), `defaultValue:false`.
3. Define `Trigger` (type `enum`), `defaultValue:'bar4'`, import `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` from the existing Afterhours preset (or its shared canonical successor).
4. Use exact position/order together under `designParentGroup:'design'`, `group:'Pattern'`.
5. For Trigger, use the schema's `visibleWhen` condition that tests `Pattern Change === true`; it remains persisted when hidden.
6. Changing Pattern while Pattern Change ON **does not toggle it OFF** and **does not immediately cycle** due to a stale event.
7. Do not copy old Afterhours `Pattern Change` enum or legacy `metadata.userEditSetParameters` behavior that disables Auto Performance for Pattern edits; the new contract is more precise.

### BPM Sync

- Type **boolean** under `designParentGroup:'master-controls'`, subgroup Timing.
- ON: selected procedural motion uses shared analyzed beat timing (or documented shared fallback); OFF: deliberately authored unsynced 120-BPM-equivalent/free-run seconds. Changes between ON/OFF must be perceptible at a non-120 BPM fixture.
- Should keep rhythmic impulse accents active even with Sync OFF; Sync controls motion clock, not all audio reactivity.
- Compose with global Audio Dock BPM Sync explicitly; recommended: preset switch controls this preset's motion independently using accepted Audio Intelligence/transport values (`requireHostSync:false` path is available in `Cinema2SyncedMotionClockResolver`), but verify UX policy with host and use one consistent rule.

## Parameter wiring protocol

For *every* parameter record:

- stable `Cinema2ParameterId`, correct primitive `type`, `section:'Design'`, `designParentGroup`, `exposure`, `persistence`, `reset`, optional `group`, label, order;
- matching default in `module.parameters` for module-owned property, unless controlled through environment/effect/camera;
- `module.parameterBindings.<property> = cinema2Ref(PARAMETER_ID)` for each module consumed value;
- document final `parameters.get(property)` consumer or final compositor/environment binding;
- capture minimum/default/maximum behavior on production canvas;
- for hard disables, test that Director/Auto can't override them.

If a control such as `Bloom Amount` cannot bind to an available effect property in the current branch, **do not ship it as a fake knob**. Either implement a fully valid effect binding in the approved phase or remove the unimplemented optional control. Required shared controls and palette roles may not be removed.

## Recommended default hierarchy

```text
Design
  Master Controls
    Output: Master Intensity
    Timing: BPM Sync
    Performance: Auto Performance
  Design
    Pattern: Pattern > Pattern Change > Trigger (conditional)
    Structure: Rows, Columns, Row/Column Spacing, Rod Length, Length Variation
    Motion: Motion Amount, Motion Speed, Height Range, Symmetry
  Effects
    Light: Idle Glow, Accent Strength, Bloom Amount
    Camera: Camera Motion
  Palette
    Roles: Background, Primary Rods, Secondary Rods, Accent Hits, Mounting Structure
```

## Perceptual acceptance examples

- Rows 4 → 12 visibly changes depth and geometry count without clipping; Columns 4 → 12 clearly changes width.
- Rod Length 0.6 → 2.1 visibly changes physical LED length; Height Range 0 → 0.8 changes maximal vertical travel, not light intensity.
- Primary Rods red / Secondary Rods green visibly affect independent banks; Accent Hits yellow changes only accented fixtures; Mounting Structure cyan changes actual caps/rail, not rod emission; Background blue changes only background.
- BPM Sync toggle at 150 BPM changes rate/phase as documented while pulse accents still occur.
- Pattern Change OFF and Trigger hidden: stable selected pattern, even through musical events.
