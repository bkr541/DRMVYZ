# GLASSFALL — phases 6–8 handoff

The all-triangle preset is integrated into the normal Cinema 2.0 module/preset
registries under `drmvyz.cinema2.glassfall`, displayed as **GLASSFALL**. It is a
reference/review entry, not a keeper: final human visual and musical acceptance
has not been granted. The implementation and automated acceptance cover the
remaining phases; that human judgment remains an explicit release gate.

## Phase 6: Auto Performance

Auto Performance defaults OFF. Its sole auto-owned domain is temporary pattern
substitution: a fresh build performs Dark Windows for at most 4 seconds (ending
earlier if the build ends); a fresh drop performs Prism Relay for 1.2 seconds.
Drop takes priority when both moments qualify. The canonical base Pattern Change
controller continues progressing while the substitute is visible; its current
base resumes afterward. No saved Pattern, Pattern Change or Trigger is overwritten.

A manual Pattern edit immediately clears the current override, including a
same-value edit. The already-active build/drop cannot undo it. Only a subsequent
separately qualifying event can authorize another temporary performance. Auto
OFF, source/analysis reset, seek/loop and re-entry clear overrides. Paused time
does not advance their expiration; manual OFF while paused restores base at once.

Choreography, Music Reactivity, Pattern Change and Auto Performance are separate
permissions. Choreography OFF removes modulation; it does not silently change
explicit Auto Performance or Pattern Change settings. Colors, geometry, camera,
brightness ceilings and finishing remain user-owned in every mode.

## Phase 7: finishing

- Shared HDR bloom on a float scene target: Bloom 0–0.45, default 0.18. Zero is an
  exact bypass. Threshold 0.8, knee 0.25, intensity 1.2, spread 0.45, four levels,
  clamp 4. The actual triangle cores, shadows and panel separation remain visible.
- Reflection Strength 0–1, default 0.35, changes black-panel material roughness
  and metalness. Zero is matte; maximum retains the physical panel/triangle gaps.
- No automation changes either finishing control. Fixed camera remains approved.

## Phase 8: acceptance

Final review uses the production registry and render graph, not private registry
injection. Pure phase definitions were separated from their registry factories
so production registration has no recursive catalog initialization.

Validation covers:

- 19 focused tests across real GLB geometry, six native programs/timing, shared
  audio authority, choreography, Director, Auto Performance and production wiring.
- Actual canvas differences for primary controls and five independent palette
  roles; six native patterns; motion/zero holds; BPM Sync; pause/seek/re-entry;
  portrait/square/landscape; all 11 canonical triggers and manual takeover.
- Auto build/drop substitution, continuing base progression, correct restoration,
  manual edit protection and immediate paused OFF behavior.
- Finishing OFF/default/max, shared Inspector and portaled dropdowns.
- Low/medium/high render quality, no failed render/effect/module diagnostics,
  switching through the foundation preset, and zero retired/disposed leases.
- A final check found and fixed the no-track clock: ambient decoration now uses
  capped wall-time deltas while the host freezes its musical clock without audio.

The real-audio path was also exercised using audio extracted from the user's
Glassfall.mov, through browser decoding, offline analysis, live analyser pumping,
AudioFeatureBus and the actual shared bridge. The 10.665-second excerpt produced
available energy/bass and rhythm events; playback changed rendered pixels. It did
not yield confirmed BPM or significant highs in this short run. Deterministic
shared-input fixtures cover tempo, highs, vocals, builds and drops. This is not a
claim of full-song listening or human musical acceptance.

The initial final acceptance run passed control/pattern/timing/automation checks
and reached the no-track idle check. After fixing that isolated branch, the
`--late-only` pass verified real audio, idle, quality tiers and Inspector/disposal
without repeating the already-passed early checks. See the script and local
capture/report outputs for reproducibility. Final production build (TypeScript and Vite) passed after the idle-clock fix;
the triangle GLB is present in the bundled assets. The build emits its existing
large-chunk advisory. Focused lint passed after removing two unused global
declarations in test scripts.

## Review commands and outputs

```sh
node scripts/cinema2-assets/accept-glassfall-final.mjs --serve
```

Open the printed URL. It uses the normal preset registry; `?live=1` enables the
review clock and Inspector. A local audio/video picker can exercise another track
without uploading it. In the app, select GLASSFALL within Cinema 2.0.

Acceptance commands:

```sh
node scripts/cinema2-assets/accept-glassfall-final.mjs
node scripts/cinema2-assets/accept-glassfall-final.mjs --late-only
npm run build
```

The browser script expects `artifacts/glassfall-final/reference.wav`; regenerate
from the provided reference if needed:

```sh
ffmpeg -i /Users/kodyrobinson/Desktop/Glassfall.mov -vn -ac 2 -ar 22050 -y artifacts/glassfall-final/reference.wav
```

Ignored reproducible outputs: `artifacts/glassfall-final/` contains pattern/aspect
captures, auto build/drop checkpoints, real-audio frames, quality tiers, Inspector
captures and `report-late.json`. Source GLB is bundled by Vite. Triangle asset
credit and license remain in BEHAVIOR.md, preset metadata and the review page.

All source/doc changes remain uncommitted. No commit was requested. Remaining:
human visual/musical review before changing the catalog role from reference to
keeper. No additional implementation phase is silently started or required for
that review.
