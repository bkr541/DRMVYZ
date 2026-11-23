# Starters: how its frame cost was brought down

Starters draws its whole scene (case, three balls, grass, woodland) by **ray marching** one fullscreen fragment shader (`modules/starters/Cinema2StartersRenderer.ts`). It once took about 120 ms a frame on an Apple M3 Pro at the lowest quality, 7x over a 60 fps frame: the app fell to 8 fps and a cast stream with it. It now takes about 6-7 ms at full quality (1157 x 767), measured on the same GPU. The picture is unchanged.

## What was expensive

- The woodland's distance function (about ten 5-octave noise calls) was evaluated on **every step of every ray**, including every shadow, normal and occlusion sample, even where no tree could be near.
- Every ray marched the flat ground in many small steps, though a plane needs none.
- Per-ball rotations (about 50 `sin`/`cos`) were recomputed on every step although they only depend on the controls.
- Shadows marched up to 42 steps from every pixel, even when nothing could shade it.
- Cinema 2.0's quality levels only shrink the render target, and this shader has no quality input, so even `low` stayed far over budget.

## What changed (all exact unless noted)

- **Bounding boxes.** Every surface other than the ground lies in one of three boxes: the case and balls (fitted each frame to the lid angle, ball spread and scale), the rear woodland band, and the left-side clusters. A group is skipped when its box is already farther than the nearest surface found, which cannot change the result.
- **Analytic ground.** The ground hit is the exact plane intersection. Rays march the case/balls and the woodland only through the stretch that crosses their box, and only up to the ground or a nearer hit. The ground's normal is exactly (0,1,0), and its occlusion is exactly 1 unless the point is within 0.3 of an object.
- **Shadows.** A soft shadow is the smallest `13 * distance / travel` along the ray, so a ray that never comes within 1 unit of any box leaves it at exactly 1 and is not marched; one that does is only marched until it has left the last box.
- **Per-pixel constants.** Lid angle, ball positions and each ball's two rotations (as matrices) are computed once per pixel (`prepareScene`), not per step.
- **Leaf edge noise** (not exact, below half a pixel): computed only within 0.3 of a leaf surface and with 3 octaves instead of 5 (the mean is kept).

## Checked

- Real GPU (Apple M3 Pro, Metal), four scenarios including the lid fully open with the balls at their widest and largest: 121-126 ms before, 6-7 ms after, at 1157 x 767.
- Against the old shader, the case and balls are pixel-identical; the only differences are one-pixel silhouette lines and the grass and leaf speckle (the old marcher stopped a few millimetres off the ground at a slightly random spot, and the grass pattern is finer than that). Blurred (sigma 1.5), the mean difference is 0.26 / 255.
- `npm run test:e2e:starters-budget` times the real renderer on the real GPU and fails above 12 ms a frame (it fails by 10x on the old shader). On software WebGL it only checks that every scenario draws. It needs a Vite server for the project root (`PLAYWRIGHT_BASE_URL`, default `http://127.0.0.1:5174`).
