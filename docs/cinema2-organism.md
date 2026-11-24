# ORGANISM — Living geometric intelligence

## Authored specification and acceptance boundary

Native world-space, selectable first-party reference preset, inspired by the supplied shadow-chamber recording and the approved ORGANISM concept render. Mandatory: suspended non-humanoid neural sculpture, solid angular metal trusses with open negative space, a luminous core, breathing branched tendrils, multiple live geometry-derived shadow projections, curved charcoal chamber with ribs, wide/orbit/macro compositions. The concept's photographic texture, exact tendril positions and reflective floor are inspirational rather than pixel targets. No video, imported mesh, humanoid, full-screen shader or second audio clock.

One central cage and core, twelve primary branches with two child branches each, sixteen chamber bays, two independent moving near-field projection fixtures. Broad slow breathing at idle; growth and increasing interwoven light in builds; bounded expansion and strong shadows on drops; quieter branch movement and selective illumination on vocals. Standard 11 shared triggers, manual base pattern, temporary build/drop overrides only with Auto Performance, no persistence writes. Camera stays inside the room and uses the shared path/orbit rig with lockoff and a separate macro path. Shared effects: depth-aware haze, HDR bloom, cinematic finish. No separate UI or output path.

## Authority / visible output map

| Domain / controls | Manual base / permission | Ordinary audio / Director | Auto Performance / manual behavior |
|---|---|---|---|
| Master intensity, music reactivity, motion amount, motion safety, flash accents | Gain, response, spatial movement and permission | Gain and motion scale bounded envelopes; motion safety and flash permissions absolute | Shared mood drives; numeric controls locked in Auto, BPM and Auto remain editable |
| BPM Sync | Native Beat Clock requires preset and dock sync; shared camera follows its existing preset tempo control | Confirmed tempo and phase; authored free-running 100 BPM without sync | Editable, never overwritten |
| Pattern, Pattern Change, Trigger | Immediate authored choice, default OFF, trigger conditional | Shared qualified event identity advances runtime only | Shared resolver and temporary build/drop override, restored on expiry or takeover; saved values untouched, locked during Auto |
| Reach, bend, growth, motion rate, strand thickness, core scale | Branch reach, curl, child extension, phase rate, actual solid width, cage size | Sub/bass breath, mids branching, kick travel, snare contraction, Director build/impact | Shared mood contributions; locked during Auto |
| Projection intensity, light distance, projection speed, shadow softness | Fixture energy, magnification, orbital drift, PCF radius | Phrase and downbeat accent, bounded impact | Shared mood contributions; locked during Auto |
| Camera mode/motion/speed/amount/FOV | Shared path/orbit/macro and hard motion gate | Shared camera tempo/Director FOV accent | Shared mood contributions; locked during Auto |
| Bloom, haze, atmosphere mix, finish mix, contrast, vignette | Shared effect parameters | No private post-process | Shared mood contributions; locked during Auto |
| Background, wall, metal, strand, core, haze tint | Independent background, wall material, structural truss, emissive truss, core, atmosphere colors | No automatic color replacement | All independently editable |

## Patterns

| Pattern | Native choreography |
|---|---|
| Respiration | Radial breathing; broad reach, gentle curling |
| Synaptic | Short light pulses propagate from core to tip; more restrained motion |
| Bloom | Child branches unfurl and fan outward; silhouette spreads |
| Vortex | Long rotating spirals and asymmetric curl |
| Pulse | Strong radial travelling expansion wave |
| Entangle | Twisted branches cross in interleaved directions |
| Colossus | Projection fixtures approach, broader shadows and widened organism |
| Dormancy | Compact structure and subdued light with slow drift |

## Musical mapping and ownership

Shared choreography continuous channels: sub (breath), bass (reach), low mids (curl), mids (branching), high (strand pulse), air (tip light), flux (pulse width), energy (gain), vocal presence (restraint), Director intensity/momentum/build/impact/variation (motion and lighting). Shared discrete envelopes: beat (breath), kick (outward wave), snare (recoil), downbeat (projection accent), bar (phase emphasis), phrase (projection travel), section (growth), drop (expansion). No unavailable signal is synthesized. On seek, source/analysis replacement, loop or context generation reset, discard held event identities and restart phase. Pause freezes phase and no stale event advances. Auto Performance uses shared mood policy, transient target drives and catalog auto coverage; silence attenuates movement, core and projections. All pattern changes remain runtime-only.

Authored mood drives: reach 1.0, mood.build ×1.20 (runtime limit 1.25); growth .8, mood.complexity +.15 (0–1); rate .7, mood.momentum ×1.40 (0–1.5); projection intensity .85, mood.peak ×1.25 (0–1.6); intensity 1, mood.silence ×.12 (0–1.6); bloom .55, mood.peak ×1.25 (0–1); haze .018, mood.tense ×1.35 (0–.06). Catalog's shared coverage supplies bounded remaining numeric drives, no custom exemptions. Hard permissions and palette are not overridden.

## Acceptance checkpoints

Use actual Cinema2Runtime and Inspector, not a detached demo. Review static camera, wide orbit, macro approach, all eight patterns, each control OFF/default/max, all 11 trigger options, manual takeover, duplicate trigger, play/pause/seek/loop, source replacement, Sync ON/OFF at non-reference BPM, calm/build/drop/vocal/silence, Auto ON/OFF and saved state, four parent groups and live values, resize 16:9/portrait, low/medium/high and re-entry. Record GPU and visual captures and inspect against the supplied concept. Do not promote to keeper until real production canvas and human visual acceptance pass.

## Implementation validation record

- Authoring validator and native compiler passed (both authored and shared Auto-covered manifest, no diagnostics); shared coverage reported no skipped targets.
- Offline pure-domain checks passed for eight distinct bounded pattern signatures and all eleven shared trigger IDs, including duplicate, manual edit and reset handling. Tests were exercised with the existing source modules through the available TypeScript transpiler, not a GPU or mock canvas.
- Added `Cinema2OrganismPreset.test.ts` and the actual production-runtime browser acceptance harness `scripts/run-cinema2-organism-browser.mjs`. With dependencies installed, run `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2OrganismPreset.test.ts` and `node scripts/run-cinema2-organism-browser.mjs` (Playwright Chromium required). Browser captures go under `artifacts/cinema2-organism/acceptance/`.
- The provided archive has no node_modules, and the package registry could not be reached (EAI_AGAIN). Full typecheck/build, Vitest, production WebGL captures, visual fidelity, performance, and human acceptance remain unverified. The preset stays a selectable reference, not a keeper. The two moving projectors illuminate opposite wall regions concurrently and sweep the circumference over time; this is not four simultaneous full-wall projectors. No shared engine or other preset behavior was intentionally changed.
