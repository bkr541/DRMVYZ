# GLASSFALL phase 5 — bounded Visual Director meaning

Scope: enhance the accepted choreography using shared intensity, momentum, build
and impact significance. The global Visual Director remains preset-agnostic.
No Auto Performance, automatic camera, palette replacement or pattern ownership.

## Pipeline and authority

Shared Visual Director -> shared Choreography -> zero-based resolved internal
module targets -> bounded native response gains. Native code never interprets
raw music as a second Director. Choreography owns smoothing and the impact
meaning envelope. The native module only caches sampled meaning during pause.

**Director Influence** is a user-owned 0–1 control, default 0.35. Zero gives the
exact phase-four output at the same pose/input. Choreography OFF forces neutral
meaning gains; Music Reactivity zero removes all musical response. Both controls
remain immediate while paused. No Director route writes authored parameters.

| Meaning source / target | Shared timing | Maximum gain at full influence | Visible consumer |
|---|---|---:|---|
| director.intensity / director-intensity | 200ms smoothing | 1.25× | Existing energy-driven illumination activity |
| director.momentum / director-momentum | 240ms smoothing | 1.25× | Existing highs-driven Prism Trace phase range |
| director.build / director-build | 240ms smoothing | 1.20× | Existing build-driven relief tension |
| director.impact / director-impact | Shared significance rising edge at default threshold 0.5; 15ms attack, 25ms hold, 350ms release | 1.35× | Existing kick/snare/drop accents |

All routes require Choreography ON and the shared significance capability. Input
and consumer bounds are [0,1]; unavailable meaning gives neutral gain. The impact
edge creates a short shared envelope so instantaneous meaning survives long
enough to enhance the existing gesture. It does not extend/replace that gesture's
own envelope or create illumination without an existing musical response.

Combined maximums at Music Reactivity=1 and Director Influence=1:
energy illumination addition 0.375; build relief addition 0.144 of authored depth;
bass+build relief addition 0.324; highs contour offset 0.15 cycles; kick/snare
illumination addition 0.6075; drop illumination addition 0.4725. Final illumination
still clamps to [0,1] before Master Intensity. Relief remains above the panels.

Layout, scale, spacing, palette, camera, saved Pattern, Pattern Change and Trigger
retain their accepted authority. Existing canonical events continue to decide
when Pattern Change advances; Director Influence cannot select a pattern.
Pause holds rendered meaning; manual influence changes still apply immediately.
Source/analysis discontinuities and re-entry clear/reconstruct meaning safely.

## Review and validation

```sh
node scripts/cinema2-assets/accept-glassfall-phase5.mjs --serve
```

The private review harness uses deterministic upstream Music Intelligence
publications through the real bridge, Director, choreography and render graph.
It does not inject fabricated Director values. Outputs are reproducible under
`artifacts/glassfall-phase5/`.

- Fourteen focused geometry, motion, audio, choreography and Director tests passed;
  Director tests reran after the impact envelope correction.
- Production canvas acceptance passed: zero/default/max influence; significant
  section versus restrained section at identical basic audio; impact enhancement;
  pause and paused edits; no extension of drop lifetime; master permission gates;
  manual Pattern, scale, spacing, relief and palette authority; source/analysis
  reset, re-entry, diagnostics and disposal.
- Final default-influence and Director Inspector captures visually inspected.
- TypeScript passed after the final impact-route correction.
- Real-track listening and final human musical acceptance remain pending; no
  production-ready claim is made.

No commit requested or created. All work remains uncommitted. Auto Performance
is phase 6; effects/finishing and full acceptance remain phases 7 and 8.
