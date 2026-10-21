# 05. Shared Audio Intelligence, bounded choreography, Director and user authority

## Ownership and signal route

- **Audio Intelligence** = shared musical facts (bands, transient events, analyzed rhythm, vocals, build/drop/phrase/section); LIGHTFIELD has no local beat or drop detector.
- **Visual Director** = broad significance (momentum, intensity, build tension and transition weight); knows nothing of tiles or rows.
- **Choreography / Target Runtime** = typed rules that map music into bounded temporary LIGHTFIELD parameter/module targets. Prefer existing `Cinema2ChoreographyRuntime` and target resolver, not a hidden state layer.
- **Parameter State** = persisted base pattern, topology, intensity, colors and motion bounds.
- **Native module** = actual tile indexing, group geometry, pattern evaluation, compositing resolved values, instanced render and safe reset.

## Authored signal-to-visual map (calibrate ranges by visual review)

| Shared input | LIGHTFIELD target and visual outcome | Proposed cap / envelope | Authority |
|---|---|---|---|
| Sub / bass continuous | Scaled central tile lift and primary-bank emission warmth/strength, not just uniform flashing | +0–0.06 world units *within user's Lift Range*; smoothing 110–220 ms | User base + bounded modulation |
| Mid continuous | Staggered grid-row lift bias; slightly shifts spatial wave contrast | ±0.025 world units; 120–200 ms | User base + bounded modulation |
| High/air continuous | Thin panel/rim sparkle on deterministic sparse indices | +0–0.20 normalized emission; 60–120 ms | User base + bounded modulation |
| Overall music energy | Applies bounded pattern-wave emphasis (not unbounded movement speed) | Up to +25% of authored reactive amplitude; 160 ms | User base + bounded modulation |
| Vocal presence | Pulls secondary-bank brightness and geometric transients down, leaves grid and authored pattern intact | −0–20% emission; −0–15% transient travel; 150–300 ms | User base + bounded modulation |
| Kick event | One expanding lift/emission impulse, spatially patterned from center or active pattern anchor | 0.10–0.22 s attack+decay; no additional actual lift above user's cap | Transient action/envelope |
| Snare event | Short diagonal or alternate checker accent independent from kick | ~0.16–0.28 s decay; Accent Hits palette channel | Transient action/envelope |
| Beat/downbeat | Small propagation advance + slightly stronger center accent on downbeat | ≤0.06 normalized extra emphasis | Event accent; no duplicate clocks |
| Phrase / section | Optional bounded variation reset or structural direction inversion *within current Pattern* | Transition ≤0.45 s; **not** hidden pattern change | Structural and Auto Performance-scoped |
| Build progress | Contract/rise into center without changing tile count or persisted Pattern | Up to 15% available lift envelope; 250 ms smoothing | Director-significance gated |
| Drop event | Controlled release: whole-grid wave from center/edge, short Accent Hits burst | Peak emission ≤ user Master Intensity; ≤user Lift Range; decay 0.25–0.60 s | Event with bounded Director gain |

**These caps are proposed tuning targets, not preexisting hardcoded runtime limits.** Use one combined cap per channel so adding sub+kicks+build cannot exceed safe lift or intensity. Do not feed every music signal into the same brightness multiplier.

## Required choreography-rule record for implementation

Each rule in actual code review must state: `{shared source path/capability, target kind/ref/property, operation (bounded add/multiply), strength, smoothing or attack+decay, qualifying conditions, ownership, clamping, reset}`. Create a table adjacent to code or tests rather than only writing prose. An event-driven module `handleAction` must validate action name, payload, event ID and dedupe identity; an actual manifest route must dispatch it. Never claim actions are wired merely because a handler exists.

## User / intelligence authority matrix

| Property | User input | Music modulation | Visual Director | Auto Performance (OFF by default) | Manual edit behavior |
|---|---|---|---|---|---|
| Row/column counts | Hard authoritative | None | None | None | Immediate rebuild; persists |
| Tile size/gap/thickness | Hard authoritative | None | None | None | Immediate bound geometry change; persists |
| Palette (5 independent roles) | Hard authoritative | Intensity mod only, never Hue/role replacement | No direct color ownership | None | Immediate; persists |
| Master Intensity | Hard output cap | Within cap only | Scales authorized fraction only | Within cap only | Zero blocks all emission until changed |
| Motion Amount / Lift Range | Authored upper bounds | Inside cap | Can scale allowed fraction | Can scale allowed fraction | 0 means geometry stays still despite drops |
| Pattern | Authored base selection | No hidden pattern choice | Never directly owns | **No v1 Pattern override** | Immediate base even while Pattern Change ON |
| Pattern Change | Boolean manual | Selected Trigger advances only when ON | None | Does not silently toggle | Manual selection leaves toggle unchanged |
| Trigger | Manual enum, conditionally shown | A new qualifying shared event advances base | No semantics change | No ownership | Change waits for next new event |
| BPM Sync | Manual boolean | Shared clock only when ON | None | May not override | Immediate coherent phase; OFF runs authored seconds |
| Hit Strength / Audio Sensitivity | Hard upper bounds | Transients within allowed bounds | May scale within cap | May scale within cap | Edit reflects immediately under active audio |
| Idle Glow / Bloom | Authored effect setting | Within capped gain if allowed | Bounded finishing significance | Cannot switch disabled effect ON | Bloom 0/OFF stays off |
| Camera Motion | Hard boolean OFF by default | None unless ON | Bounded drift if ON | Only if ON | OFF immediately removes camera movement |

### Deterministic composition order

1. Read **authored user state** and authorization toggles.
2. Resolve Pattern base + new qualified Trigger events (Pattern Change ON only); manual edit consumes stale event.
3. Resolve steady phase (BPM Sync policy) and pure native per-tile pattern geometry.
4. Apply transient audio envelopes / Director significance as **bounded additive or multiplicative** overlays routed through shared target paths.
5. Clamp combined displacement against user Lift Range and engine hard bounds; clamp emission against Master Intensity, respect hard OFFs, apply resolved Palette roles.
6. Render with current host camera/resources; reset envelopes and event identities on discontinuities.

## Auto Performance deliberately limited

V1 Auto Performance **does not cycle Pattern**, does not modify saved controls and does not change tile count/color. When ON, it may choose *temporary* structural emphasis (e.g., 0.8–1.25× reactive movement inside authored Lift Range, drop wave weight, and small camera emphasis only with Camera Motion ON) using Visual Director significance. When OFF, these auto-only extra envelopes vanish without muting ordinary audio-reactivity or Trigger-driven Pattern Change. On user edit of any separately auto-owned field, manual ownership must win by default; avoid introducing such fields in v1 where unnecessary.

If a future version lets Auto Performance temporarily substitute a build/drop Pattern, implement current §9 precedent: manual edit visible immediately, existing active event cannot undo it, underlying Pattern controller continues, override ends predictably and restores current base without altering Pattern/Pattern Change/Trigger persisted settings.

## No-source, pause, discontinuity and safety

- No source: defined static/resting tableau or faint authored drift, not fake beat events. Zero Audio Sensitivity yields no music-based reactive overlays.
- Pause: prevent phase/envelope advance per host semantics, discard duplicates, freeze pose; don't run an external timer.
- Seek, loop, track or analysis change, context generation change: reset/reconstruct envelopes, prior source identity, remembered trigger, stateful beat phase and optional director transition safely.
- Preset switch away/back: release GL resources, clear event queues, rebuild default or persisted authored state, no stale envelope.
- Bounded numerical inputs: sanitize non-finite values, clamp all shader attributes, prevent negative colors, invalid matrices, too-bright frame impulses or >144 tiles.
