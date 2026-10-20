# Attribution and licensing notes

The prepared files include third-party models provided by the user from Sketchfab. Original model metadata identifies each as **Creative Commons Attribution 4.0 (CC BY 4.0)**, subject to the publisher's actual license terms.

**Can model:** *energy banks*, by **igor.rizaev00**. Original: https://sketchfab.com/3d-models/energy-banks-119bf6e735414700913cb45a1af86ec1 . License: https://creativecommons.org/licenses/by/4.0/ . **Modifications:** split branded/plain meshes into separately loadable GLBs, normalized each pivot and physical scale to 168 mm, replicated and artistically enlarged instances inside the BWC factory.

**Machinery model:** *Sci-fi Assembly Line*, by **meeww**. Original: https://sketchfab.com/3d-models/sci-fi-assembly-line-d30366ad73af49f6b7279923fe89faee . License: https://creativecommons.org/licenses/by/4.0/ . **Modifications:** added normalized parent transform, adapted source cyan emissive material factors to green, included a scaled static source-derived copy in the larger factory. The separate prepared GLB retains animation and its original glass extension.

**Can emblem:** `Claw_Marks_Filled.svg` is the three-claw emblem printed on the BWC cans, supplied by the project owner as the master vector with its correct colours (black outline, three grey claw interiors, transparent background). The preset reads its path data from `src/components/vyzualz/cinema2/modules/bwc/Cinema2BwcEmblem.generated.ts`, which is generated from this file and checked against it by `Cinema2BwcEmblem.test.ts`. The same trademark caution as above applies to the emblem.

**Creature:** `Ultra_White_Plush_Creature_Cinema2.glb`, supplied by the project owner, is the plush creature that fills the right-hand conveyor. The preset rebuilds its body, lid, arms, feet, eyes and smile as analytic distance fields in `Cinema2BwcCreatureModel.ts` (checked against the GLB's vertices by `Cinema2BwcCreatureModel.test.ts`) and wraps its embedded label texture, shipped as the `cinema2-bwc-creature-label` asset, around the body. The same trademark caution as above applies to the label.

**Example credit for documentation or published builds:**

> Contains modified assets from “energy banks” by igor.rizaev00 and “Sci-fi Assembly Line” by meeww, licensed under Creative Commons Attribution 4.0. Source URLs and modification descriptions are documented in `BWC_Asset_Attribution.md`.

CC BY requires attribution, a link to the license, and an indication of modifications. This license **does not necessarily grant trademark or other third-party rights**. Monster Energy and its branding are trademarks of their respective owners; this independent visualization is not represented as brand-authorized. Verify branding use and licensing for the product's intended release.
