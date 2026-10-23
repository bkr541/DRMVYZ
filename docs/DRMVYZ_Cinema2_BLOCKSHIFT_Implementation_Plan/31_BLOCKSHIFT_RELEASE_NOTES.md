# BLOCKSHIFT — candidate release notes

**Candidate:** preset revision 17. **Status: internal Preview; not approved for production release.** The [release gate](09_RELEASE_GATE.md) records the remaining requirements.

BLOCKSHIFT adds an immersive Cinema 2.0 field of fifteen supplied 3D cube models, with six physical movement patterns, segmented audio-reactive LED bars and colored atmospheric glow. Size and Spread controls support large nearby cubes throughout the surrounding space. Optional varied cube spin and an additive float/orbit camera make the field evolve around the observer.

The preset uses shared Audio Intelligence, geometry-aware choreography and Visual Director signals. Pattern Change offers the canonical eleven musical triggers. Optional Auto Performance adds temporary build/drop movement while preserving saved settings and manual control. Bloom, atmosphere, camera motion and musical reactivity each have working user controls.

Acceptance corrected idle Pattern switching without a track and a queued-frame/context-loss timing race in the shared runtime. The current production browser matrix passes, with 66 BLOCKSHIFT tests and 101 affected shared/neighboring tests passing in Phase 8; Phase 9 refreshed the 11-test preset/compiler/disposal check. [User guide](30_BLOCKSHIFT_USER_GUIDE.md) · [acceptance evidence](28_P8_PRODUCTION_ACCEPTANCE_REPORT.md).

The user approved the reviewed visuals and behavior during Phase 9. Production promotion remains pending resolution or explicit release disposition of the repository's existing type/build/test failures. Fresh GPU timing samples were unavailable during the current profiling window; recorded CPU measurements and allocation estimates are local observations.

No additional feature work is approved by this phase. Release follow-up consists of addressing the listed validation blockers and validating an identified committed candidate before any promotion from Preview. Repository-wide remediation, GPU telemetry changes or additional visual features require separate scope decisions.
