# 03. Inspector, Parameter Bindings, Palette and User Authority

## Mandatory hierarchy

All user-visible Design Inspector parameters must appear under **exactly one** of the generic top-level parents: `master-controls`, `design`, `effects`, `palette` (UI: Master Controls, Design, Effects, Palette). Nesting is permitted. Keep shared Inspector code preset-agnostic.

The following is an **implementation specification**, not a claim these parameters already exist. Values are proposed for P1 sign-off; calibrate visually while preserving every required control and consumer.

## Inspector matrix

| Parent > subgroup | Label | Type / proposed values | Default | Actual consumer / rendered result |
|---|---|---|---|---|
| Master Controls > Playback | **BPM Sync** | Boolean | ON | Switches actual formation motion/transition phase between analyzed grid sync and free-run phase; tested ON/OFF |
| Master Controls > Performance | Master Intensity | Float 0–2 | 1.0 | Multiplicative edge/scene emission, never forces disabled effect on |
| Master Controls > Performance | Auto Performance | Boolean | OFF | Enables only documented temporary build/drop macro overrides |
| Master Controls > Performance | Motion Amount | Float 0–1 | 0.55 | Scales all autonomous translations/rotations and authorized camera impulses; zero freezes physical motion |
| Master Controls > Performance | Audio Reactivity | Float 0–1 | 0.80 | Multiplies audio-driven envelopes; zero removes audio-reactive change but retains manual pattern |
| Design > Pattern | **Pattern** | Enum **Stack, Orbit, Stagger, Split, Wave, Collapse** | Stagger | Immediately selects underlying manual base geometry/animation |
| Design > Pattern | **Pattern Change** | **Boolean toggle** | **OFF** | Allows new selected Trigger event to advance underlying pattern; never altered by manual Pattern selection |
| Design > Pattern | **Trigger** | Enum **exact 11 canonical options** | Every 4 Bars (`bar4`) | Visible only when Pattern Change ON; selected event identity controls *when* pattern advances |
| Design > Blocks | Block Size | Float 0.70–1.20 | 0.90 | Actually changes face/edge mesh scale and safe layout spacing |
| Design > Blocks | Spread | Float 0.50–1.80 | 1.0 | Physical distance among blocks; post-clamped for positive clearance |
| Design > Blocks | Depth | Float 0–1 | 0.45 | Separation in z, visible to shared perspective camera |
| Design > Blocks | Rotation Range | Float 0–45 degrees | 16° | Bounds pattern twists and beat/snare rotation accents |
| Design > Motion | Motion Rate | Float 0.25–2 | 1.0 | Continuous pattern phase/free-run speed; beat-multiplier when BPM Sync ON |
| Design > Motion | Transition Length | Enum 0.5 / 1 / 2 / 4 beats or equivalent documented values | 1 beat | Actual interpolation envelope with safety; maps consistently when unsynced |
| Effects > Scene | Bloom | Float 0–1 | 0.30 | Existing HDR bloom effect; zero must truly disable its influence |
| Effects > Scene | Atmosphere | Float 0–1 | 0.12 | Existing atmosphere/haze if manifest-supported; omit entirely if unimplemented |
| Effects > Camera | Camera Motion | Boolean | OFF | When ON permits bounded standard camera drift/drop accent; OFF hard-disables movement |
| Effects > Camera | Camera Motion Amount | Float 0–1, conditional on Camera Motion ON | 0.15 | Only camera runtime control; omit if camera motion cannot be wired safely |
| Palette > Materials | **Primary Edge** | Color | cool cyan | Primary edge instances |
| Palette > Materials | **Secondary Edge** | Color | blue-violet | Opposing banks and rear/far edges |
| Palette > Materials | **Impact Accent** | Color | near-white warm | Transient beat/drop edge accent (preview even with audio off) |
| Palette > Materials | **Block Body** | Color | charcoal | Solid cube faces, directly visible with bloom OFF |
| Palette > Materials | **Background** | Color | dark navy/black | Backdrop/clear color; different consumer from body |

**Baseline count:** five independent color controls (required minimum is four). If an optional Effects control lacks a working runtime consumer, remove the optional control rather than shipping a placebo. Mandatory controls cannot be removed.

## Shared pattern control rules (normative)

- Order: **Pattern → Pattern Change → Trigger**, all under **Design > Design**, optionally nested under a Pattern subgroup.
- `Pattern Change` is a **boolean** and defaults OFF. Do not imitate old enum-style Afterhours Pattern Change.
- Use imported `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` unchanged, not a retyped local option list.
- Conditional Trigger visibility: `visibleWhen: [{ kind: 'parameter-equals', parameterId: PATTERN_CHANGE_ID, value: true }]` or identical supported manifest syntax. Its authored value survives hiding.
- Manual Pattern selection while Pattern Change ON immediately changes the underlying pattern, **leaves Pattern Change ON**, and arms only the *next new* qualifying Trigger. Any event already present on the edit frame is consumed/ignored.
- Auto Performance may temporarily overlay an authorized build/drop formation but may not mutate authored Pattern, Pattern Change or Trigger. A user Pattern edit must be seen first and cannot be immediately undone by a stale build/drop condition.

### Exactly 11 canonical options

| Value | Label |
|---|---|
| `beat` | Beat |
| `kick` | Kick |
| `snare` | Snare |
| `downbeat` | Downbeat |
| `beat2` | Every 2 Beats |
| `beat4` | Every 4 Beats |
| `bar` | Bar |
| `bar4` | Every 4 Bars |
| `bar8` | Every 8 Bars |
| `phrase` | Phrase |
| `drop` | Drop |

## Wiring invariants and persistence

- Every authored parameter must be declared through `Cinema2NativePresetManifest` and bound via `module.parameters` / `parameterBindings` using real IDs and supported `cinema2Ref` syntax. Runtime values must be read through `context.parameters.resolve` / `get` where appropriate, not captured as one-time defaults.
- The geometry/compiler can expose internal resolved modulation channels, but only real user controls count toward the required Inspector design.
- Persist authored defaults and overrides with existing Cinema 2.0 parameter state. Internal performance offsets live in ephemeral module runtime and **never overwrite persisted values**.
- Palette test: set Primary to red, Secondary to green, Impact to white, Body to purple and Background to neutral gray. Each color must change an **identifiable, independent** visible region, including with audio stopped; Accent should have a baseline preview group or deliberate static accent so it is never audio-only.
- Test min/default/max or each enum under fixed time; if only the Inspector widget changes and pixels do not, that's a release blocker.
- Hard disables: Motion Amount = 0 must block geometric auto motion; Audio Reactivity = 0 blocks music modulation; Camera Motion OFF remains OFF even under Auto Performance. Editing a manual geometry or color base must take visible effect immediately.

## Future enhancements excluded from v1

Live block-count adjustment, arbitrary grouping UI, per-cube custom colors, editable 3D model imports, physics strength controls and shader palette modes. If added later, they need their own independent wiring and acceptance tests.
