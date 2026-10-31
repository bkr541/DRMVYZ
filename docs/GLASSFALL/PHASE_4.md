# GLASSFALL phase 4 — bounded shared choreography

Scope: replace the phase 3 direct observation windows with shared target-resolved
continuous smoothing and authored event envelopes. The all-triangle reference
layout, palette bases, fixed camera and canonical Pattern Change controller remain.
Visual Director enhancements, Auto Performance and finishing are not implemented.

## Ownership and permissions

`Cinema2GlassfallChoreography.ts` authors eight routes. The engine's
Cinema2ChoreographyRuntime owns smoothing, event deduplication, attack/hold/release,
pause, route cancellation and discontinuity reset. Each route writes only a
zero-based internal module target named `choreo-*`; no saved/manual parameter is
replaced. The native module consumes final resolved targets, clamps them to 0–1,
and creates no local envelope or alternate audio detector.

**Choreography** defaults ON and is a hard permission for all eight routes. OFF
removes shared contributions and immediately renders the authored base, including
while paused. Re-enabling cannot replay an already-consumed held event.
**Music Reactivity** scales the visible modulation once (0–1); zero restores the
manual visual. Pattern Change is an independent permission and continues to use
the previously accepted manual/fresh-event authority rules.

## Rule map

Continuous rules use shared available signals, `replace` composition into their
internal zero base, [0,1] source and consumer bounds, and engine-owned exponential
smoothing. Listed milliseconds are smoothing time constants, not event envelopes.

| Shared source | Internal target | Smoothing | Visible maximum at Reactivity=1 |
|---|---|---:|---|
| audio.features.overallEnergy | choreo-energy | 180ms | +30% illumination activity, capped at master ceiling |
| audio.bands.bass | choreo-bass | 120ms | +18% authored relief |
| audio.bands.high | choreo-high | 90ms | Prism Trace contour phase offset up to 0.12 cycles |
| audio.features.vocalPresence | choreo-vocal | 250ms | Up to 40% illumination restraint |
| audio.features.buildProgress | choreo-build | 200ms | +12% authored relief |

Bass and build may combine for at most +30% relief. Mounting-post lengths track
that relief. No palette, spacing, scale, pattern or camera replacement occurs.

Event rules use shared musical events, once-per-event suppression, minimum
confidence 0.45, `envelope` with `replace` composition into the zero internal base,
value 1 and `restart` on a distinct fresh event. Routes require Choreography ON.

| Shared event / target | Attack | Hold | Release | Visible maximum |
|---|---:|---:|---:|---|
| Kick / choreo-kick | 12ms | 18ms | 250ms | +0.45 upright-slot illumination |
| Snare / choreo-snare | 8ms | 12ms | 200ms | +0.45 inverted-slot illumination |
| Drop / choreo-drop | 25ms | 60ms | 600ms | +0.35 broad impact illumination |

The final illumination is bounded [0,1] before Master Intensity. Event duration
uses shared transport seconds; BPM Sync continues to govern descent and program
phase, while these fixed-second envelopes remain responsive with Sync OFF.
Every envelope returns to zero, restoring the user's current authored base.
Unavailable signals fail closed; source/analysis discontinuities clear stale state.

## Review

```sh
node scripts/cinema2-assets/accept-glassfall-phase4.mjs --serve
```

The printed URL runs the private phase 4 preset. Test publications use the existing
Ifrit fixture through AudioFeatureBus and the real Audio Intelligence bridge;
fixture code does not enter the production module. Current captures/report:
`artifacts/glassfall-phase4/`.

## Validation

- Eleven focused geometry, motion, audio-authority and choreography tests passed.
- Production-canvas check passed: real resolved-channel peaks and visible pixels;
  tails after the source event; return to the exact manual visual base; all five
  continuous routes and release; pause; hard OFF/re-enable; Reactivity zero;
  manual value preservation; seek/loop and track/analysis resets; independent
  Pattern Change; manual Pattern selection; re-entry, diagnostics and disposal.
- TypeScript passed.
- Final kick peak/restored and Choreography Inspector captures visually reviewed.

This remains a private review checkpoint. Real-track listening and human musical
acceptance remain pending. No commit requested or created; all work is uncommitted.
