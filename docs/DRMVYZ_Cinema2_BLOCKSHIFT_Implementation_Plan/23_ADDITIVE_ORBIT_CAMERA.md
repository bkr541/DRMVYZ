# BLOCKSHIFT — Additive orbit camera

2026-10-22. User-requested camera/control refinement after Phase 5. Preset revision 11; fifteen-object field retained. This does not begin Phase 6.

## Controls and behavior

- Camera Motion remains in Master Controls. With it ON, **Design > Motion** exposes **Orbit Camera**, default OFF.
- With Camera Motion and Orbit Camera both ON, **Orbit Intensity** appears directly below Orbit Camera. It is a speed control, range 0–1 (0–100%), default 0.35: **0–24 degrees/second**, default 8.4 degrees/second.
- Orbit rotates the existing floated position and look direction around the observer's base position. The camera stays inside the cube field and looks around it; the existing float continues independently. It does not move to an outside view or fit all objects into frame.
- Orbit Intensity changes are integrated over subsequent engine frames, so editing speed does not rescale phase or jump the camera. Zero holds the current orbital heading while float continues. Orbit Camera OFF also holds the reached heading and stops orbital progression, allowing float to continue smoothly. Re-enabling resumes from that heading.
- Camera Motion OFF, Camera Motion Intensity zero or Master Motion Amount zero restore the existing authored base view and clear orbit phase. Camera Motion OFF hides both orbit controls without discarding their saved values. Turning it back on restores those authored choices and starts orbit from the forward heading.
- Pause holds the camera exactly; source/seek/context resets and preset re-entry clear transient orbit phase. Movement runs under the existing playback/animation gate. Orbit speed is independent of Float Speed/BPM; the slider directly controls angular rate. No audio-driven camera choreography is added.

## Implementation and safety

The shared camera manifest gains opt-in `motion.orbit` and typed `orbitMotionEnabled` / `orbitMotionSpeed` parameter bindings. Compiler validation requires finite authored angular speed in 0–90 degrees/second, correct parameter types and a declared additive-orbit consumer. Existing outside orbit-rig controls retain their original requirements. No Inspector preset-name special cases or competing camera loop were added.

The shared runtime composes **existing float → additive orbit → safety/smoothing → camera matrices**. BLOCKSHIFT retains its static observer-centered base rig, ±[0.65, 0.4, 0.65] camera-position safety, less-than-one-unit observer displacement and 2.5-unit geometry exclusion. Look-target bounds now explicitly allow the view to turn through all 360 degrees; this broadens direction, not camera travel. The fifteen cubes, native patterns, audio overlay, scale and spacing controls are unchanged.

## Validation

Focused tests cover conditional controls in the actual Inspector model, ordering under Motion, retained hidden/saved values, 4× angular-rate contrast, speed-zero and orbit-OFF heading hold, float independence, a complete turn with rear visibility, position/target/matrix safety, pause, parent/master disables, seek reset and malformed authoring rejection. Existing shared camera and tempo regressions are included.

**42/42 focused tests PASS** across BLOCKSHIFT Controls/Motion and shared CameraRuntime/CameraTempo. **Focused ESLint PASS**. Scoped TypeScript reports **zero changed-file diagnostics** and the same nine unrelated dependency diagnostics. **Fresh production browser PASS:** conditional toggle/slider visibility, saved values after parent hiding and preset re-entry, fifteen-object wide/square/portrait output, GL/resource lifecycle, actual orbit pixels/matrices through a complete turn, rear-field views, zero speed with float continuing, orbit-OFF heading hold, exact pause and parent OFF. The browser uses software Chromium ANGLE SwiftShader, so no hardware performance claim is made. The browser sequence uses a controlled host clock and synthetic silence publications through the normal shared audio bus; no private camera renderer is substituted. Known unrelated repository TypeScript failures are outside this change; no broad rebuild/typecheck is required. All changes remain uncommitted, with no commit requested. Human visual review and final preset release acceptance remain outstanding.

[Actual orbit recording](evidence/orbit-camera/orbit-camera.webm) · [Rear view](evidence/orbit-camera/orbit-8s.png) · [Orbit results](evidence/orbit-camera/orbit-acceptance.json) · [Normal-workspace/control acceptance](evidence/orbit-camera/acceptance.json). The normal Inspector screenshot shows Master Controls; the new orbit controls sit farther down under Design > Motion.

Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --orbit`. Source/diff and the production captures were reviewed, and `git diff --check` passed. **Implemented for user review; uncommitted.** No Phase 6 behavior or release sign-off is claimed.
