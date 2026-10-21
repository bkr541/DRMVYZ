# 03. LIGHTFIELD Inspector, persistent parameters and five-color Palette

## Required placement (current root contract §9)

All public parameters appear in the schema-generated **Design tab** under **exactly one** top-level parent: `master-controls`, `design`, `effects`, or `palette`. Nested `group` headings are permitted. Do not special-case React Inspector for LIGHTFIELD. Control label/enum type/actual runtime consumer are release requirements, not placeholders.

## First-release public control matrix

**Numbers below are proposed authored ranges**, to be calibrated during P1 after inspecting real-world camera bounds. Use the correct existing schema type and controls.

| Design parent / subgroup | Exact label, type | Default / range | Target + observable behavior |
|---|---|---|---|
| Master Controls / Output | Master Intensity, float | 0.78; 0–1 | Scales emitted tile panel/rim output; 0 cannot be overridden by events or Auto Performance |
| Master Controls / Timing | **BPM Sync, boolean** | ON | Synced moving-pattern phase uses shared musical time; OFF uses deliberate authored free-run; kick/snare events remain live |
| Master Controls / Performance | Auto Performance, boolean | OFF | Enables only limited macro amplitude/energy/optional camera significance; never rewrites tile count, colors or Pattern |
| Master Controls / Output | Audio Sensitivity, float | 0.65; 0–1 | Bound multiplier for reactive envelopes; at 0 static authored patterns may keep decorative motion but reactive overlays vanish |
| Design / Pattern | **Pattern, enum** | Checker Pulse; exact six choices in `04` | Changes native geometric mask/trajectory immediately |
| Design / Pattern | **Pattern Change, boolean** | **OFF** | OFF holds manual pattern; ON advances at qualifying trigger; choosing Pattern while ON does **not** turn it off |
| Design / Pattern | **Trigger, enum** | `bar4`; 11 canonical values | Visible only when Pattern Change true; controls event frequency/identity, never pattern identity |
| Design / Grid | Rows, integer | 8; 4–12 | Real physical instance count + layout; preserves stable row-major address semantics |
| Design / Grid | Columns, integer | 8; 4–12 | Real physical instance count + width |
| Design / Grid | Tile Size, float | 0.78; 0.55–0.95 | Opaque slab width and inset size change together |
| Design / Grid | Tile Gap, float | 0.10; 0.05–0.20 | Visible separation; no intersections at min gap with allowed tilt |
| Design / Grid | Tile Thickness, float | 0.12; 0.08–0.22 | Real sidewall geometry depth, inspect low-angle camera |
| Design / Motion | Motion Amount, float | 0.55; 0–1 | Bounds all geometric wave amplitudes; 0 freezes geometric choreography only |
| Design / Motion | Lift Range, float | 0.14; 0–0.22 world units | Per-tile max displacement, with hard absolute safety bounds |
| Design / Motion | Motion Rate, float | 1.0; 0.25–2.0 | Changes selected pattern sweep rate, obeying Sync ON/OFF contract |
| Design / Motion | Wave Focus, float | 0.55; 0–1 | Changes width of row/radial/diagonal spatial envelopes, not brightness alone |
| Effects / Illumination | Idle Glow, float | 0.18; 0–0.50 | Resting emissive panel illumination; no fabricated audio beats at idle |
| Effects / Illumination | Hit Strength, float | 0.55; 0–1 | Caps kick/snare transient lift or accent intensity, strictly under max safety |
| Effects / Finishing | Bloom Amount, float | 0.20; 0–0.55 | Real supported engine HDR bloom consumer, three-state visual proof |
| Effects / Camera | Camera Motion, boolean | OFF | Hard disables all camera drift when OFF, including Auto Performance |
| Palette / Roles | **Background, color** | dark charcoal RGBA | World/clear ambient background, not tile bodies |
| Palette / Roles | **Tile Surface, color** | near-black slate RGBA | Opaque physical bases and edge material |
| Palette / Roles | **Primary Panels, color** | cool blue RGBA | Emissive panel bank A; visible simultaneously with bank B |
| Palette / Roles | **Secondary Panels, color** | violet RGBA | Emissive panel bank B; independent from bank A |
| Palette / Roles | **Accent Hits, color** | pale warm-white RGBA | Selected accent outlines/event-highlight channels |

**Optional:** Camera Angle / Camera Distance only if generic camera binding with safe clamps and noticeable visual output are confirmed; avoid more controls for the sake of showing a large Inspector.

## Mandatory pattern trio

Declare three schema parameters together in `designParentGroup: 'design'`, nested `group: 'Pattern'`, ordered exactly:

1. `Pattern` / `enum`: six LIGHTFIELD-specific values and labels from `04_PATTERN_AND_TIMING.md`.
2. `Pattern Change` / `boolean`, default false. **Not an enum**.
3. `Trigger` / `enum`, default `bar4`, `options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`, and conditional visibility using the schema's supported `visibleWhen` `{ kind:'parameter-equals', parameterId: PATTERN_CHANGE_ID, value:true }` (verify signature from types).

Never add `metadata.userEditSetParameters` that automatically disables Pattern Change when a user manually chooses Pattern. Manual selection while ON is the expressly permitted exception. Trigger value persists while hidden and comes back when ON. Trigger option selection must not itself fire the pattern.

## Palette wiring: independence acceptance

| Color | Renderer/environment consumer | Independent test |
|---|---|---|
| Background | Host environment/clear color or validated module-controlled background target | Set cyan: empty surrounding space changes, tile surface/panel colors don't |
| Tile Surface | Instanced opaque tile material | Set red with bloom OFF: sidewalls change red but luminous panel banks do not |
| Primary Panels | emissive array with deterministic bank A addresses | Set green: only bank A changes |
| Secondary Panels | emissive array with deterministic bank B addresses | Set yellow: only bank B changes |
| Accent Hits | tile outlines or dedicated accent masks during deterministic snare/drop fixture | Set magenta: visible accents change without recoloring primary/secondary panels |

All five must use native `type: 'color'`, independent parameter IDs, independent bindings and independent output consumers. A Palette swatch that only affects an inactive pattern does not count as validated. Capture a scene where all five roles have visible and meaningful contributions. Color `alpha` behavior should match current renderer; don't silently double-apply opacity.

## Wiring / perceptual test protocol

For every float/integer control: choose stable camera/time, set **min → default → max**, capture production render and compare relevant cropped region; document visual outcome, not merely state values. For each discrete control: test OFF/ON or each option. Geometry changes must be visible with bloom disabled. After the full audio phase, test controls again with Auto Performance ON and loud fixture to prove manual base remains authoritative. If any optional control can't show a meaningful and safe visible difference, **remove that UI control instead of shipping a placebo**.

## Priority / authority semantics

- Authoritative tile topology, tile size, tile gap, palette and intensity ceiling come from user state. No intelligent system may change those automatically.
- Motion Amount, Lift Range, Hit Strength and Audio Sensitivity are bounds for allowed reactive modulation; events **cannot exceed** them.
- `Master Intensity = 0` is hard OFF for emission; `Motion Amount = 0` hard OFF for geometric displacement; `Camera Motion = OFF` hard OFF for camera changes.
- Auto Performance may act only on explicitly declared transient amplitude/significance domains. Manual edits to any separately auto-owned domain must reclaim that property (unless documented Pattern exception, which does not auto-disable Pattern Change).
