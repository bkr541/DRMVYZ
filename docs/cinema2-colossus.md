# COLOSSUS | Articulated mechanical stage

Status: first-party selectable reference, human review pending. This is not a keeper promotion or release acceptance. Original procedural design, no third-party model or runtime asset download. Artwork is an authored blueprint, not a production capture.

## Scene and ownership

`Cinema2ColossusPreset` declares a native world layer, one camera, lighting, HDR scene/depth and atmosphere/bloom/finish output graph. `Cinema2ColossusNativeModule` owns the resource lease, shared Three bridge and private model slot; `ColossusScene` owns procedural geometry/materials; `ColossusPerformance` owns transient phase and pattern state; `ColossusGeometry` is the pure pose program. Registry/catalog and blueprint artwork use existing seams. No new dependency, storage format, global renderer, audio analyzer, clock, Inspector or cast workflow. Authored values persist through the current native workspace. The shared Audio Intelligence, Visual Director, Mood Conductor and choreography runtime supply resolved values; the native module does not infer tempo or musical structure independently.

World coordinates are right-handed, Y up, origin at hero pivot, camera toward negative Z. Unitless authored stage units. Four diagonal shoulder stations lead through elbow/tool pivots; elongated chamfered segments and connected telescoping pistons, recessed channels, twin towers, repeated octagonal ribs, bulkhead, floor and two segmented floor tracks. Emblem uses original extruded shape with cutout and separate face/side materials. Floor top is -4.15; rear depth varies with Bay Depth. Shared meshes/geometry and limited real lights; no per-frame mesh construction. Floor and metal use existing environment response, not a planar mirror. Shadow control changes the shadow-casting spot intensity, not a separate shadow-opacity pass. Material Mode edge is instance-local surface emission plus rim lighting, not a dedicated edge shader. UVs are the primitive/extrusion defaults; imported UVs are retained.

Camera starts at (0,.7,9.8), FOV 44 degrees, near .12, far 65; shared minAspect 16:9 expands the frustum at narrow aspects. Authored camera safety limits bound translation and FOV; camera motion and amount use shared controls. The fixed conservative hero volume is not a separately computed per-model camera rig. Portrait composition, editor-rail independence and selected production aspect still require actual browser verification.

## Private model workflow

Use existing Model Manager and Source selector; the hidden `colossus-model` binding retains the versioned model reference. Existing slot owns async loading, cancellation, account invalidation and leases; bridge clones instance-local materials and removes prior instance. Fallback is the authored emblem while no model is attached. No remote URL is authored. World bounds include transforms; uniform fit limits radius to 2.85, width to 5.7 and height to 4.8 before user scale. Pivot uses world bounds center. Offsets limited to .4 units per axis; scale max 1.2; 15% conservative exclusion includes rotation, offsets and float. Arm link centerlines and tools are constrained outside it; sampled tests verify centerline clearance, not exhaustive mesh collision detection. Original material mode restores stored standard-material metalness, roughness and emissive properties; maps remain intact. Nonstandard materials remain unchanged. Real imported assets, rapid load changes and account transitions require production validation.

## Authority and visible controls

Stable IDs use `colossus-` prefix. Values, steps, ranges, conditions and bindings are authoritative in the manifest. Manual edits save authored bases; shared lock and live markers apply through existing UI, not preset-specific controls. `None` means no authority; `Resolved` means temporary bounded modulation only, never saved writes. Source is outside the four Design parents. Shared Quality is in Advanced.

| Property / visible consumer | Manual control | Audio modulation | Director | Auto Performance | Manual edit behavior |
|---|---|---|---|---|---|
| Auto Performance | toggle | None | None | permission | immediate authority |
| BPM Sync | toggle | shared clock | None | None | host + preset gate |
| Master Intensity / route and impact | .75 | resolved strength | indirect | resolved | base retained |
| Music Reactivity / rule strength | .75 | authority only | None | None | base retained |
| Motion Safety / travel | reduced | None | None | None | hard motion gate |
| Pattern | Assembly | event cycle | None | temporary choices | immediate saved choice |
| Pattern Change | off | event authority | None | effective gate | saved gate retained |
| Trigger | bar4 | shared event ID | None | effective ladder | saved trigger retained |
| Camera Motion | on | shared clock | None | None | hard gate |
| Camera Amount | .25 | shared camera | None | resolved multiplier | base retained |
| Model source | versioned reference | None | None | None | Source selection |
| Model Visible | on | None | None | None | hard visibility |
| Model Scale | 1 | None | None | None | uniform fit |
| Model X | 0 | None | None | None | safe offset |
| Model Y | 0 | None | None | None | safe offset |
| Model Z | 0 | None | None | None | safe offset |
| Model Yaw | 0 | None | None | None | authored orientation |
| Model Pitch | 0 | None | None | None | authored orientation |
| Model Roll | 0 | None | None | None | authored orientation |
| Material Mode | Original | None | None | None | local material restore |
| Hero Motion | .20 | energy float | None | resolved multiplier | base retained |
| Hero Emission | .20 | None | None | resolved multiplier | base retained |
| Arm Reach | .50 | bass/kick/build | build | resolved | base retained |
| Arm Articulation | .50 | bass/kick | build | resolved energy | base retained |
| Piston Travel | .40 | mids | None | resolved | base retained |
| Jaw Opening | .40 | pattern movement | None | resolved | base retained |
| Motion Rate | 1 | shared clock | None | resolved momentum | base retained |
| Bay Depth | 1 | None | None | resolved | base retained |
| Route Density | .55 | routed accents | None | resolved build | base retained |
| Route Rate | 1 | shared clock | None | resolved | base retained |
| Pulse Width | .20 | None | None | resolved | base retained |
| Drop Release | .65 | drop envelope | impact multiplier | resolved | base retained |
| Bloom | .25 | None | None | resolved peak multiplier | zero stays zero |
| Atmosphere | .10 | None | None | resolved tension multiplier | zero stays zero |
| Reflection Strength | .25 | None | None | resolved energy multiplier | zero stays zero |
| Shadow Strength | .55 | None | None | resolved tension multiplier | zero stays zero |
| Light Spill | .30 | energy scaling | None | resolved shock multiplier | zero stays zero |
| Cinematic Finish | .20 | None | None | resolved energy multiplier | zero stays zero |
| Background | #080B10 | None | None | None | far backdrop |
| Structural | #343D46 | None | None | None | metal arm surfaces |
| Primary Energy | #00D8E5 | None | None | None | feed/towers |
| Secondary Energy | #FF8739 | None | None | None | return channels/floor |
| Accent | #EAF7FF | None | None | None | rim/track accents |
| Quality | shared | None | None | None | detail reduction |

Auto Performance coverage exemptions protect numeric fit/alignment and reactivity. All color roles remain independent. Shared UI lock behavior is inherited, not browser-tested here.

## Patterns and timing

| Program | Native pose and route |
|---|---|
| Assembly | Paired inward approach and sequential joint chase |
| Articulation | Opposing phase sweeps and counter-motion |
| Suspension | Retracted stance and gentle motion |
| Mechanical Bloom | Outward arc and spreading energy |
| Separation | Wider diagonal framing with rear depth |
| Impact | Coordinated inward accent and rebound |

Shared trigger identity, resolver, deterministic pattern cycle and Auto Performance helper are reused. Saved Pattern Change controls Trigger visibility. Manual pattern edits suppress stale events; timing discontinuity resets the transient controller. Mood candidates: calm Suspension/Assembly, drive Articulation/Assembly, tense Separation/Assembly, peak Mechanical Bloom/Impact; shared temporary Assembly/Impact overrides restore base. Shared beat clock uses host and preset BPM flags, reference free tempo 90; arm and route phase are separate integrations from the same clock. Idle advances slowly; pause holds phase. No fixed track timeline.

## Choreography and mood

All shared signal targets start at zero; reactivity scales rules. Continuous source operation is replace into normalized signal slots, smoothed as below; event operation is restartable envelope/replace and once-per-event. Continuous and non-drop event rules use shared not-silent; drop is ungated. Pose and light functions consume bounded resolved signals. No saved setting is written by music.

| Signal | Smoothing or attack/hold/release (seconds) | Destination |
|---|---|---|
| sub/bass | .16/.12 smoothing | safe reach and articulation |
| mids | .15 smoothing | joint/piston movement |
| highs/air | .10/.125 smoothing | channel emission |
| overall energy | .18 smoothing | spill and hero float |
| vocal presence | .22 smoothing | restraint of arm motion |
| director build | .20 smoothing | inward tension |
| director impact | .15 smoothing | bounded release scale |
| kick | .03/.025/.24 | pair accent |
| snare | .02/.02/.18 | return route |
| downbeat | .055/.05/.38 | floor ring |
| phrase | .15/.10/.80 | floor accent plus shared trigger |
| drop | .17/.10/1.23 | outward release |

Mood drives use the shared authoring helper, Auto gate, Music Reactivity and declared ranges. The exact rule bounds are in the manifest and geometry implementation. To preserve hard-zero effects, requested additive effect increases are expressed as equivalent-at-default multipliers rather than additive increases at zero.

| Target | Base | Source | Operation/max factor |
|---|---|---|---|
| Arm Articulation | .50 | mood.energy | +.20 |
| Route Density | .55 | mood.build | +.20 |
| Motion Rate | 1 | mood.momentum | ×1.35 |
| Bloom | .25 | mood.peak | ×1.40 |
| Light Spill | .30 | mood.shock | ×1.40 |
| Atmosphere | .10 | mood.tension | ×1.80 |
| Reflection | .25 | mood.energy | ×1.25 |
| Shadow | .55 | mood.tension | ×1.20 |
| Finish | .20 | mood.energy | ×1.20 |
| Hero Motion | .20 | mood.momentum | ×1.20 |
| Hero Emission | .20 | mood.peak | ×1.25 |
| Master Intensity | .75 | mood.silence | -.35 |

Other eligible numeric controls use repository Auto Coverage. Zero reactivity gates authored mood/event contributions; exact complete production Auto ON/OFF comparison remains pending.

## Quality and verification

Low quality removes alternating channel/floor cells and far ribs before hero or arm geometry. Bridge reports estimated resource bytes; resource lease disposes scene-owned geometry/materials and private model slot. No measured frame-time, draw-call, decoder or memory benchmark is available; 60 fps remains a target, not a result. Scene is not yet verified under actual WebGL context loss/recovery.

Source validation: `node scripts/check-cinema2-colossus-source.cjs` (requires TypeScript available; this environment used `NODE_PATH="$(npm root -g)"`). Actual repository authoring validator and compiler passed for authored and auto-covered manifests. 4,608 pose cases with segment sampling passed conservative clearance assertions. Manual pattern, pause and track reset assertions passed. This is a source execution harness, not a browser/render test or complete typecheck. Focused Vitest cases are included. Dependency install blocked: `npm ci --offline --ignore-scripts --no-audit --no-fund` returned ENOTCACHED (zustand tarball); registry connectivity unavailable. No production captures, real asset fixture run, output/casting/recording verification, all-trigger regression, full Inspector lock/live marker measurement, typecheck/build or performance acceptance claimed. Complete the full gate matrix in the supplied preset brief on a dependency-installed machine. Human visual acceptance remains pending.
