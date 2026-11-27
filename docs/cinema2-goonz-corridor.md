# GOONZ CORRIDOR: fixture performance and media programming

The existing GOONZ user-preset ID, media slot, geometry, camera, native module and local parameter IDs remain unchanged. The system Corridor keeps its original six patterns and phrase-based pool cadence. No catalog or database changes are required by this patch.

## Programming

The shared Cinema2BeatClock and pattern controller supply beat progress and selection; GOONZ interprets beat progress in four eight-beat movements, with directional variations over a longer cycle. Pause holds the routine; source/seek or pattern entry resets it. Auto Performance gates canonical kick, snare, downbeat, phrase, section, build and drop contributions; it does not own saved parameter values. Motion zero holds routine progress. No new audio analyzer or event detector is introduced.

| Pattern | Movement vocabulary | Program pool cadence |
| --- | --- | --- |
| Night Transit | Isolated distant islands, alternating banks, sweep, darkness | Phrase |
| Relay | Forward/reverse packet, wider packet, double chase | 2 beats |
| Counterflow | Opposing packets, crossing accent, reversal | 4 beats |
| Shaft | Ceiling/floor alternation, quicker response, sidewall impact | Bar |
| Signal Fault | Stable islands, controlled interruptions, stagger, restoration | 2 beats |
| Gate | Moving ring, double ring, compression and release | Bar |
| Ricochet | Sequential bank hops and trailing responses | 2 beats |
| Helix | Rotating spiral, compression and reverse | Bar |
| Pressure Chamber | Converging fronts, suspension, expansion | 4 bars |
| Impact Matrix | Alternating groups and subdivisions | Bar |
| Afterimage | Moving front, diminishing trail and release | Phrase |
| Overload | Quarter/eighth/sixteenth subdivisions and sparse blackout | 2 beats |

Explicit Pool Trigger overrides program cadence. The same existing pool leases up to three feeds. Channel assignments can change independently of media reloads; unavailable channels fall back to a ready feed, and a wholly unavailable pool falls back to fixture rendering. Screen power, hero hold, contained content motion and CRT interference do not change underlying source assets. The media-protection alpha convention and postprocessing remain intact.

## Lighting and controls

The rectangular perimeter approximation uses the same deterministic fixture shape as the vertex shader. It samples the current and adjacent bays and neighboring banks, computes falloff in physical corridor coordinates, and shades backing, casing and rail spill separately. This is a local analytic light approximation, not a global illumination or ray-traced shadow solution. No extra render pass or decoder is allocated. The existing inspector exposes all controls under its four canonical parent groups. Existing saved brightness values are not overwritten; Reset restores the updated authored defaults.

## Production acceptance checklist (pending on target hardware)

- With an isolated active fixture, verify visible localized wall illumination above/below/beside the housing; inactive areas stay dark. Toggle Wall Spill to compare. Verify casing reflection on inactive adjacent panels and rail illumination at each corner.
- Record all twelve patterns for at least 16 bars at 120 and 150 BPM; confirm each has perceptible movement and direction changes, including pause, seek, manual selection and automatic pattern change.
- Validate build subdivisions, suspension and drop release with real analyzed music. Inspect snare, downbeat, phrase and section accents; Auto Performance off must remove these contributions.
- Exercise no source, single PNG/SVG/video, and 1/2/3+ pool items, delayed decode and explicit pool cadence. Verify contain behavior and dark logo readability, including cast output.
- Compare original Corridor captures and controls before/after. Check HDR and RGBA8 fallback at target resolution and quality, GPU frame time, dropped frames, resource cleanup, and long-running transport. Tune spill strength/reach, exposure and brightness against reference screenshots on actual hardware; avoid large-field flashing.
