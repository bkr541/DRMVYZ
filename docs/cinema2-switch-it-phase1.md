# Switch It — Phase 1 static visual core

The initial static checkpoint was accepted after the supplied Demon Mask replacement and a 22% enlargement. Subsequent user requests now supersede its original opaque skull/hybrid styling: the mask is another 30% larger, solid and textured over an intact character, softly shadowed, and has no white divider or replacement eye orbs.

Current rendering policy, controls, validation and review artifacts are documented in [Phase 2](cinema2-switch-it-phase2.md). Asset provenance remains in `assets/cinema2/switch-it/phase1-geometry.json` and `demon-mask-provenance.json`.

The static review script still runs through the native engine using private registries:

```sh
node scripts/cinema2-assets/accept-switch-it-phase1.mjs
```

It captures Human, Skull overlay, Hybrid reveal and Crown overlay, confirms deterministic static output/re-entry, checks that the character eyes remain visible, and verifies resource disposal. Outputs go to ignored `artifacts/switch-it-phase1/`. `--serve` opens an interactive local diagnostic preview at the printed URL; Ctrl+C stops it. The current native motion/control preview and latest comparison are in the Phase 2 artifacts.

The human source is the shipped CC0 MakeHuman hm08 mesh, extracted to a 2,100-triangle flat-shaded bust by `generate-switch-it-human.mjs`. The intact base remains visible; optional fragments use a separate copy of that geometry. The supplied mask is the 5,686-triangle **Demon Mask** by [egorova.e](https://sketchfab.com/silentegor), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), sourced from the user’s local GLB. Its geometry, normals, UVs and three material maps are retained; maps are resized to 1024px for the bundled preview. It has no separately invented lower jaw, procedural replacement skull, eye disks or dark eye fillers.

The engine still owns camera, render targets/depth and resource leases. The supplied mesh, solid surface materials and feathered reveal edges and projected silhouette shadow are all module-owned resources released on disposal. The shared Three renderer remains owned by its existing host. No finished catalog preset has been published. Changes remain uncommitted.
