# Auth page animation

Login, signup, password recovery and password completion share a centered,
two-panel authentication card: form on the left and animated canvas on the right.
The animation is non-interactive and hidden from assistive technology. At phone
widths (640px and below), the animation panel is hidden to keep the form usable.

The current engine name appears once, centered in the animation panel, with
its scene-specific decoding transition. Sound Drawing uses a rotating perspective-projected 3D curve with
depth-sorted, shaded segments; a moving particle volume adds depth to all scenes.
Reduced-motion mode displays the same layout as a static composition.

HEADLINER depicts a headphone-wearing DJ with a shaped face/hair silhouette,
a jacket with fabric folds, tapered sleeves and articulated hands behind two perspective turntables and
a central mixer. Hands scratch the left platter and adjust mixer controls while
the head and shoulders move. Four delayed cyan/magenta silhouette echoes flank
the DJ; spinning platter markers and level meters animate with the synthetic
pulse. The scene is procedural and does not use a camera or tracking models.

The decorative canvas is capped at 30 fps and 1.25 device-pixel ratio. The scope
uses one batched glow pass rather than hundreds of per-segment blurs. Hidden
mobile panels and background documents stop rendering; ResizeObserver restarts
the animation when the panel becomes visible. Reduced-motion mode draws once.

Local Chromium profiling at 1440×900 and DPR 2 over a 1.6-second scope window
measured 192 canvas draws / 61,107 blurred strokes before optimization and
49 draws / 49 blurred strokes afterward. Backing pixels dropped from 1,060,488
to 414,328. These are local work counts, not device-wide latency guarantees.
Browser checks also verified idle hidden-mobile/background/reduced-motion
states, visibility resumption, editable login fields and animated DJ poses.
Profiling receipts are retained in ignored `artifacts/auth-performance/`.
