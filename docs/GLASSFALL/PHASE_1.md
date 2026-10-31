# GLASSFALL phase 1 review

Current revision: all slots contain the supplied GLB triangle (user direction,
2026-10-31). Static geometry retains the reference paired bands, bevels, mounting
posts, raised black panels, separate rear surface and cast shadows. No musical
performance is implemented in this static study.

```sh
node scripts/cinema2-assets/accept-glassfall-phase1.mjs --serve
```

Open the printed review URL. Diagnostic browser-console helpers:

```js
glassfallStudy.depth(false)
glassfallStudy.depth(true)
glassfallStudy.oblique(true)
glassfallStudy.oblique(false)
```

Geometry lives under `src/components/vyzualz/cinema2/modules/glassfall/`.
Private registration: `Cinema2GlassfallPhase1Preset.ts`. Nothing is catalog-listed
as a completed preset. Earlier captures with a second motif are superseded.
Current acceptance outputs can be regenerated in `artifacts/glassfall-phase1/`.
See `BEHAVIOR.md` for authoritative geometry, depth, ownership and asset credit.
All work remains uncommitted; no commit was requested.
