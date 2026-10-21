# 05. Audio Intelligence, Choreography, Director, Auto Performance and Authority

## Existing shared flow

The preset must consume current `Cinema2AudioIntelligenceBridge` output (audio bands, rhythm event identities, analyzed structure) and `Cinema2VisualDirector` significance. Wire temporary target changes through the manifest's `choreography` rules and `Cinema2TargetRuntime` resolver, following the Afterhours/Depth examples. Do not create a new local detector, BPM engine, semantic classifier, independent beat clock, or direct modifications to persistent `Cinema2ParameterState` for musical changes.

## Musical-to-visual map

| Source and source tier | Physical / visual consumer | Operation + limit (proposed) | Envelope / gating | Audible/visual proof |
|---|---|---|---|---|
| `audio.bands.sub` continuous | Crown/bowl amplitude on center rods | Multiplier 0–0.18 of available Height Range | 90–160 ms smoothing | Sub-heavy section makes physical sculpture breathe |
| `audio.bands.bass` continuous | Row wave depth + modest diffuser emission | Add ≤0.18 world unit equivalent and ×≤1.18 glow ceiling | 80–150 ms smoothing | Bass-heavy content makes 3D movement more pronounced |
| `audio.bands.mid` continuous | Alternate row/column movement tension | Add ≤0.08 height/tilt equivalent | 100–180 ms smoothing | Mid-focused musical sections visibly favor alternating banks |
| `audio.bands.high` / `air` continuous where available | Micro-shimmer of lit rod intensity, **not** strobe | ±≤0.10 intensity | >80 ms smooth | Higher-frequency passages change shimmer, not geometry chaos |
| `audio.features.overallEnergy` continuous | Overall formation movement envelope | Multiply authored motion by 0.85–1.15 | 110–200 ms | Quiet vs energetic movement profiles distinguishable |
| `audio.features.vocalPresence` continuous | Visual occupancy/brightness restraint | Reduce selected bank emission no more than ~25%, preserve user minimum | 130–250 ms | Vocal passage creates breathing negative space |
| `audio.features.buildProgress` / director build continuous | Slowly compress vertical range and stage tension | Up to 25% range compression, no base pattern rewrite | 150–350 ms | Build visibly narrows/organizes canopy |
| `music.rhythm-events` `kick` event | Front-to-back row lift and accented fixture set | Short additive lift ≤0.14 world unit; emission pulse ≤0.35 | Attack 20–40 ms, decay 180–260 ms | Specific rods visibly move on kick |
| `music.rhythm-events` `snare` event | Opposing diagonal / checker subset | Lift/tilt ≤0.10 unit; Accent Hits hue pulse | Attack 20–45 ms, decay 180–300 ms | Alternate bank reacts on snare, unlike kick |
| `music.downbeat` event | Wider first-row + outer-bank accent | Extra physical displacement ≤0.16 and emission lift | Attack ≤50 ms, decay ≤400 ms | Downbeat visibly larger than ordinary beat |
| `music.phrase` event | Pattern internal direction/easing change **without** changing authored Pattern | Transient macro variation, never persistent parameter rewrite | 100–600 ms | Phrase boundaries reorganize within selected formation |
| `music.section` event | Reset trails if used, short structural settle | Return envelopes to safe authored region; bounded spatial release | 100–500 ms | Clear section distinction and clean restart |
| `music.drop` event | Synchronized physical drop-release; optional temporary Downpour performer | Movement gain ≤1.3 authored bound, emission gain ≤1.35 | 80–700 ms, no indefinite override | First drop impact is spatially unmistakable |
| `director.intensity/impact` | Performance significance multipliers | Clamp after authored base and event envelopes | Existing Director frame | Hard kicks with high significance read stronger |

Actual capabilities and paths must be verified against `Cinema2ChoreographyRuntime` and `Cinema2AudioIntelligenceBridge`. Treat missing optional `air` or similar signals as absent, not fabricated data. The numerical limits above are design proposals; tune in actual production visuals.

## Choreography rule structure

For each rule record:

- unique stable rule/action IDs;
- `source` signal type and declared capability;
- target of supported `kind:'module'` with a real module property (or valid camera/effect target);
- additive or multiplicative bounded modulation rather than uncontrolled `replace` against authored parameters;
- explicit maximum amplitude, smoothing/attack/decay, priority, gate conditions, hard-disable policy;
- a real native module consumer for the final resolved target;
- deterministic reset on discontinuities.

**Use the engine's existing orchestration APIs, not a self-built bypass.** Pattern sampling can be preset-local because it is visual choreography; musical event detection cannot.

## Authority matrix (mandatory before coding)

| Property/domain | User base | Choreography / Audio | Visual Director | Auto Performance | Manual edit behavior |
|---|---|---|---|---|---|
| Rows/Columns/Spacing | Absolute user choice | No count/topology override | No | Never | Immediate rebuild within limits; user stays owner |
| Rod Length | User base | ≤bounded lift/length ratio, no topology rewrite | May scale within clamp | Never permanent | Immediate visible length change |
| Height Range/Motion Amount | User hard ceiling | Add/modulate within ceiling | May scale bounded fraction | Can temporarily pick intensity profile | 0 motion hard stops physical movement |
| Master Intensity | User level and hard zero | Short pulse only within authored allowed ceiling | Scale within envelope | Cannot force light when user set 0 | Set 0 means physically unlit |
| Idle Glow | User base | Events temporarily add but decay | No persistent replacement | Does not rewrite | Immediate |
| Colors (5 roles) | **User owned** | Transient luminance/accent mixing, not saved palette | No arbitrary hue changes | Never | Chosen colors persist |
| Pattern (authored) | User base selection | New Trigger advances runtime base only when Pattern Change ON | Doesn't alter persisted field | Optional **temporary** build/drop performer | Immediate base switch; Pattern Change remains ON if ON |
| Pattern Change | User boolean | Enables/disables trigger advancement | No | Cannot toggle | Manual choice remains authoritative |
| Trigger | User one of 11 | Defines WHEN next advance happens | No | Cannot swap | Trigger edited: no stale-event switch |
| BPM Sync | User switch | Chooses shared beat-locked vs free-run motion clock | No | Cannot override | Immediate phase-safe switch |
| Camera Motion enable | User hard authorization | Bounded camera movement only if ON | May provide significance for allowed motion | Only if ON | OFF guarantees static camera |
| Bloom Amount | User limit | Bounded temporary effect gain if permitted | Optional | Never force ON when 0 | OFF keeps bloom OFF |
| Accent strength | User ceiling | Event accents ≤ceiling | May scale within ceiling | Never exceed | Immediate |

## Auto Performance specification

Default OFF. When ON it may temporarily choreograph **only** (a) build-specific compression profile; (b) drop-specific physical release / optionally a temporary Downpour performing view; (c) camera significance if Camera Motion also ON; (d) bounded bloom/impact if Bloom Amount > 0. **Never** change saved Pattern/Trigger/Palette/Rows/Columns/Motion hard zero. Temporary performer overrides are keyed to a *new* musical event; manual Pattern selection must remain visible and may only be superseded by a **subsequent separate** qualifying event. The underlying Pattern Change controller continues to maintain valid base progression and is restored when override expires.

A simpler first release can keep Auto Performance ON limited to bounded build/drop/camera multipliers **without changing pattern selection**. This reduces complexity and is fully consistent with the contract (temporary pattern override is allowed, not required). If no pattern override is implemented, test its absence explicitly and don't promise it in UI copy.

## Reset / transport matrix

| Transition | Required state response |
|---|---|
| Fresh activation/no track | Initialize deterministic layout, authored base pattern and idle glow; no synthetic impulses |
| Play | Activate canonical shared timing and real received event envelopes |
| Pause | Hold motion, no new pattern trigger, no elapsed-time drift |
| Resume | Continue valid time phase, no catch-up flash/event |
| Seek forward/backward | Drop old envelopes and transition identity; recompute phase deterministically |
| Loop wrap | Reset local previous-time comparison; prevent stale events |
| New track ID or audio analysis generation | Reset active runtime pattern, trigger guard and envelopes; no stale drop |
| BPM Sync toggle | Rephase without jump or explicitly bounded transition |
| Pattern Change/Trigger edit | Invalidate current event as a candidate for immediate advancement |
| New preset/re-entry | Dispose GPU resources and controllers; retain authored state via normal persistence |
| Context generation change/WebGL recovery | Reacquire GL resources, rebuild layout with current controls |

## False-positive traps

- Value changes in logs, but rod coordinates do not change: **fail**.
- Sub/bass/kick/snare all change only brightness: **fail**.
- Auto Performance picks a different pattern every frame on a sustained build: **fail**.
- Pattern selected manually then instantly undone by stale event: **fail**.
- Hard OFF controls re-enabled by Director: **fail**.
- A local timer discovers beats independently of shared transport: **fail**.
