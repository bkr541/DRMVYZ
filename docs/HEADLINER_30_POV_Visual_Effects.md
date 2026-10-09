# HEADLINER Engine — 30 POV Visual Effects

## Overview

This document defines 30 visual effects for the **HEADLINER** engine, designed specifically around a **front-facing / POV camera view of the DJ**. The core idea is that the DJ is not simply a video source: their **body movement, face position, silhouette, motion velocity, and temporal history** become the visual material.

The priority number is intended as a build-order recommendation, with **1 = highest priority** and **30 = lowest priority**.

---

## 1. Motion Echo
**Priority:** 1 / 30

### What it should do
Retain several previous frames of the DJ and composite them behind the current live image. As the DJ moves their head, shoulders, hands, or arms, older body positions remain visible as semi-transparent copies.

The result should feel like the DJ is leaving **temporal clones** of themselves in space rather than producing ordinary motion blur.

### Reference
- Trails & Frame Delays — TouchDesigner  
  https://www.youtube.com/watch?v=6Kj8HFEBcTA
- Retro Trail Demo — Resolume  
  https://www.youtube.com/watch?v=ajoA5veVNeg

---

## 2. Ghost Trails
**Priority:** 2 / 30

### What it should do
Create softer, longer-lasting trails from the DJ's movement. Unlike Motion Echo, individual historical poses should gradually dissolve into translucent streaks and vapor-like silhouettes.

Fast arm movements should create long trails while a mostly stationary DJ remains relatively clean.

### Reference
- Trails & Frame Delays — TouchDesigner  
  https://www.youtube.com/watch?v=6Kj8HFEBcTA
- Twisted Ghost — Resolume FX  
  https://www.youtube.com/watch?v=um06cjF0lpk

---

## 3. Velocity Smear
**Priority:** 3 / 30

### What it should do
Use the direction and speed of the DJ's movement to stretch pixels along the motion vector.

If the DJ throws an arm to the right, that arm should smear horizontally to the right. Head movement, shoulder movement, and hand gestures should each create directional distortion based on their actual movement.

### Reference
- Video + Optical Flow + ParticlesGPU  
  https://www.youtube.com/watch?v=WvSAVdj-pCU
- Interactive Particles with Optical Flow  
  https://www.youtube.com/watch?v=xODS0pZ6CEo

---

## 4. Motion Melt
**Priority:** 4 / 30

### What it should do
Turn actively moving portions of the DJ into fluid, melting image regions while leaving stationary areas comparatively intact.

Motion should create liquid displacement, dragging, stretching, or flowing deformation. Strong movement should create heavier melting.

### Reference
- Twisted Ghost — Resolume FX  
  https://www.youtube.com/watch?v=um06cjF0lpk
- Video + Optical Flow + ParticlesGPU  
  https://www.youtube.com/watch?v=WvSAVdj-pCU

---

## 5. Freeze Ghost
**Priority:** 5 / 30

### What it should do
Capture the DJ's pose on a trigger and leave that pose frozen in the scene while the live DJ continues moving.

Multiple captures should build a group of frozen DJ silhouettes or full-frame clones around the current live performer.

### Reference
- Freeze Frame Clone Trail  
  https://www.youtube.com/watch?v=1a2swOUSK6c
- Trails & Frame Delays — TouchDesigner  
  https://www.youtube.com/watch?v=6Kj8HFEBcTA

---

## 6. Strobe Clone
**Priority:** 6 / 30

### What it should do
Capture a new DJ clone only on selected musical events instead of continuously.

Example behavior:
- Kick = capture new clone
- Snare = alternate clone style
- Downbeat = clear or reset clones
- Build = increasingly frequent captures

This should create a rhythmic, pose-by-pose duplication effect.

### Reference
- Freeze Frame Clone Trail  
  https://www.youtube.com/watch?v=1a2swOUSK6c
- Retro Trail Demo — Resolume  
  https://www.youtube.com/watch?v=ajoA5veVNeg

---

## 7. Clone Spread
**Priority:** 7 / 30

### What it should do
Isolate the DJ and duplicate them into multiple copies arranged horizontally, vertically, radially, or symmetrically.

Copies can animate outward from the center, collapse back together, or shift position on musical events.

### Reference
- Freeze Frame Clone Trail  
  https://www.youtube.com/watch?v=1a2swOUSK6c
- 5-Minute Kaleidoscope  
  https://www.youtube.com/watch?v=UG7ThepTvUc

---

## 8. RGB Ghost
**Priority:** 8 / 30

### What it should do
Create separate red, green, and blue temporal copies of the DJ, with each color channel using a slightly different frame delay or movement offset.

Rather than simple chromatic aberration, the RGB separation should happen **across time**.

### Reference
- Trails & Frame Delays — TouchDesigner  
  https://www.youtube.com/watch?v=6Kj8HFEBcTA
- Retro Trail Demo — Resolume  
  https://www.youtube.com/watch?v=ajoA5veVNeg

---

## 9. Face Warp
**Priority:** 9 / 30

### What it should do
Track the DJ's face and apply distortion specifically to the facial region.

Possible behaviors include:
- stretching
- bulging
- twisting
- liquifying
- displacement
- prism distortion
- beat-reactive deformation

The rest of the frame should remain more stable.

### Reference
- Face Tracking Prism  
  https://www.youtube.com/watch?v=ath64YOxds8
- Face Tracking Perspectives  
  https://www.youtube.com/watch?v=AxP6wLoo3-U

---

## 10. Face Echo
**Priority:** 10 / 30

### What it should do
Keep the DJ's body relatively normal while creating multiple delayed copies of only the head or face.

The copies should follow the motion of the DJ's head with different temporal offsets, producing a surreal multi-face effect.

### Reference
- Face Tracking Prism  
  https://www.youtube.com/watch?v=ath64YOxds8
- Trails & Frame Delays — TouchDesigner  
  https://www.youtube.com/watch?v=6Kj8HFEBcTA

---

## 11. Aura
**Priority:** 11 / 30

### What it should do
Segment the DJ from the background and create an expanded glowing silhouette around the performer.

The aura can pulse, breathe, bloom, change thickness, or develop layered shells around the body.

### Reference
- Background Removal + Custom Webcam Effects  
  https://www.youtube.com/watch?v=qCCMGFXmm2w
- Edge Feedback Concert Visuals  
  https://www.youtube.com/watch?v=DkZ8dJlO6yg

---

## 12. Energy Outline
**Priority:** 12 / 30

### What it should do
Reduce the DJ to a bright animated contour or edge treatment.

The outline should follow the real body shape and can use glow, bloom, flicker, noise, or color modulation to create an energized neon silhouette.

### Reference
- Edge Feedback Concert Visuals  
  https://www.youtube.com/watch?v=DkZ8dJlO6yg

---

## 13. Outline Echo
**Priority:** 13 / 30

### What it should do
Combine temporal echo with edge detection.

Instead of storing full historical images of the DJ, store only the outlines of previous poses. This should leave several glowing contour silhouettes behind the live performer.

### Reference
- Edge Feedback Concert Visuals  
  https://www.youtube.com/watch?v=DkZ8dJlO6yg
- Trails & Frame Delays — TouchDesigner  
  https://www.youtube.com/watch?v=6Kj8HFEBcTA

---

## 14. Particle Body
**Priority:** 14 / 30

### What it should do
Convert the DJ's visible body or silhouette into a particle representation.

Particles should reconstruct the performer while also being able to drift, explode, collapse, or react to music.

The effect should support transitions between:
**normal video → partial particles → full particle body → normal video**

### Reference
- 3D Particle GPU Interactive Camera  
  https://www.youtube.com/watch?v=P9chF6Ih1LI
- Image / Video to Particles  
  https://www.youtube.com/watch?v=TbM2_Cvygww
- Transform Any Video to Particles  
  https://www.youtube.com/watch?v=_FSuwMFDLs8

---

## 15. Particle Shed
**Priority:** 15 / 30

### What it should do
Keep the live DJ visible while emitting particles from moving parts of the body.

Fast hand movement should throw particles outward. Head movement can release smaller trails. Optical-flow velocity can determine particle direction and speed.

### Reference
- Reactive Particles + Webcam + Optical Flow  
  https://www.youtube.com/watch?v=haeEIPgieLQ
- Interactive Particles with Optical Flow  
  https://www.youtube.com/watch?v=xODS0pZ6CEo

---

## 16. Spark Skeleton
**Priority:** 16 / 30

### What it should do
Track key body points or visible feature points and connect them with animated lines, sparks, nodes, or geometric structures.

The DJ becomes a living electronic constellation or skeletal network.

### Reference
- Body Tracking Plugin — No Kinect Required  
  https://www.youtube.com/watch?v=83StND-y4fY
- Graphic Lines Body Tracking  
  https://www.youtube.com/watch?v=ve4Ykf_2tSk

---

## 17. Digital Silhouette
**Priority:** 17 / 30

### What it should do
Remove the internal camera detail from the performer and replace the DJ with a clean silhouette.

The silhouette can be filled with:
- animated gradients
- shaders
- noise
- album artwork
- video
- textures
- audio-reactive patterns

The surrounding environment can remain visible or be independently processed.

### Reference
- Background Removal + Custom Webcam Effects  
  https://www.youtube.com/watch?v=qCCMGFXmm2w
- Edge Feedback Concert Visuals  
  https://www.youtube.com/watch?v=DkZ8dJlO6yg

---

## 18. Portal Body
**Priority:** 18 / 30

### What it should do
Use the DJ's segmented body as a window into another visual layer.

The normal camera environment remains outside the silhouette, while the inside of the DJ reveals another video, shader, particle system, tunnel, texture, or generated world.

### Reference
- Background Removal + Custom Webcam Effects  
  https://www.youtube.com/watch?v=qCCMGFXmm2w
- Kaleidoscope Tiling Tunnel  
  https://www.youtube.com/watch?v=3Az0WbSF-hw

---

## 19. X-Ray
**Priority:** 19 / 30

### What it should do
Transform the camera image into a high-contrast alternate representation of the DJ.

Possible modes:
- monochrome inversion
- false-color thermal
- edge-only rendering
- negative image
- posterized luminance
- scan-style contour imaging

The transition can pulse on beats or appear temporarily on transients.

### Reference
- Edge Feedback Concert Visuals  
  https://www.youtube.com/watch?v=DkZ8dJlO6yg
- Simple Motion Visualisation  
  https://www.youtube.com/watch?v=QGuquFiInqY

---

## 20. Posterize Pulse
**Priority:** 20 / 30

### What it should do
Reduce the live DJ feed to a limited number of color or luminance bands.

For example:
- normal = 16 levels
- beat = 8 levels
- strong bass = 4 levels
- drop hit = 2 levels

The image can then smoothly recover to full color.

### Reference
- Glitches, Pixel Sorting & Datamoshing  
  https://www.youtube.com/watch?v=pZ94V-YAo-8
- Glitch Surveillance Camera Effect  
  https://www.youtube.com/watch?v=u-beHfSt9Yo

---

## 21. Databent DJ
**Priority:** 21 / 30

### What it should do
Apply controlled digital corruption to the DJ camera feed.

Possible behaviors:
- horizontal tearing
- pixel displacement
- block shifting
- RGB channel offset
- frame slipping
- simulated datamoshing
- pixel sorting
- scanline corruption

The effect should be event-driven rather than purely random.

### Reference
- Glitches, Pixel Sorting & Datamoshing  
  https://www.youtube.com/watch?v=pZ94V-YAo-8
- Datamoshing in TouchDesigner  
  https://www.youtube.com/watch?v=w8c33t2CgtA
- Glitch Surveillance Camera Effect  
  https://www.youtube.com/watch?v=u-beHfSt9Yo

---

## 22. Slice Delay
**Priority:** 22 / 30

### What it should do
Divide the camera image into vertical, horizontal, or radial slices.

Each slice displays the DJ from a slightly different moment in time. One side of the performer may be live while the opposite side shows the DJ several hundred milliseconds earlier.

### Reference
- Slit Scan + Time Machine  
  https://www.youtube.com/watch?v=Wf6hk1-89UA
- Slitscan — TouchDesigner Tutorial  
  https://www.youtube.com/watch?v=jOcMCGtclBs
- Easy Slitscan  
  https://www.youtube.com/watch?v=1ACBmGYB8uw

---

## 23. Time Wave
**Priority:** 23 / 30

### What it should do
Create a continuous temporal distortion field rather than discrete slices.

The amount of frame delay across the image can be controlled by:
- sine waves
- radial gradients
- noise
- audio waveforms
- distance from the DJ
- bass or build intensity

Different parts of the DJ therefore exist at different moments in time.

### Reference
- Slit Scan + Time Machine  
  https://www.youtube.com/watch?v=Wf6hk1-89UA
- Slitscan — TouchDesigner Tutorial  
  https://www.youtube.com/watch?v=jOcMCGtclBs

---

## 24. Mirror Army
**Priority:** 24 / 30

### What it should do
Multiply the DJ through mirrored and kaleidoscopic symmetry.

The center performer can remain readable while additional mirrored DJ copies expand outward into geometric formations.

### Reference
- 5-Minute Kaleidoscope  
  https://www.youtube.com/watch?v=UG7ThepTvUc
- Audio-Reactive Kaleidoscope  
  https://www.youtube.com/watch?v=BiamWUjnBoY

---

## 25. Tunnel DJ
**Priority:** 25 / 30

### What it should do
Repeat the DJ camera feed recursively into depth, creating a tunnel made from smaller versions of the performer.

The tunnel can:
- zoom inward
- surge toward the viewer
- twist
- rotate
- pulse with bass
- collapse on a drop

### Reference
- Kaleidoscope Tiling Tunnel  
  https://www.youtube.com/watch?v=3Az0WbSF-hw
- Feedback & Lens Distort  
  https://www.youtube.com/watch?v=Q510XDohlaE

---

## 26. Feedback Portal
**Priority:** 26 / 30

### What it should do
Feed the processed DJ camera frame back into itself recursively.

Small scale, rotation, displacement, or perspective changes on every feedback pass should create infinite spirals, recursive portals, trails, and collapsing image structures.

### Reference
- Feedback & Lens Distort  
  https://www.youtube.com/watch?v=Q510XDohlaE
- Feedback Techniques  
  https://www.youtube.com/watch?v=88GuBq_Y1ns
- Feedback TOP + Displacement Ripples  
  https://www.youtube.com/watch?v=h7l7VO1jUC8

---

## 27. Freeze Shatter
**Priority:** 27 / 30

### What it should do
Capture a frozen image of the DJ and break that captured pose into fragments.

Fragments can:
- explode outward
- rotate
- drift
- dissolve
- fall
- reverse back into the original pose

After the shatter, the engine should return to the live camera feed.

### Reference
- Freeze Frame Clone Trail  
  https://www.youtube.com/watch?v=1a2swOUSK6c
- Transform Any Video to Particles  
  https://www.youtube.com/watch?v=_FSuwMFDLs8

---

## 28. Pixel Explosion
**Priority:** 28 / 30

### What it should do
Disintegrate the DJ into blocks, pixels, or small image fragments.

The body should appear to break apart into digital debris and then reconstruct.

This can work as a transient effect on drops, impacts, or section changes.

### Reference
- Transform Any Video to Particles  
  https://www.youtube.com/watch?v=_FSuwMFDLs8
- Glitches, Pixel Sorting & Datamoshing  
  https://www.youtube.com/watch?v=pZ94V-YAo-8

---

## 29. Body Displacement Field
**Priority:** 29 / 30

### What it should do
Use the DJ's own motion as a distortion source for the surrounding image.

Hand movement can push the image away from the hand. Fast body movement can generate ripples or waves that travel through the frame.

The DJ effectively becomes a live displacement emitter.

### Reference
- Feedback TOP + Displacement Ripples  
  https://www.youtube.com/watch?v=h7l7VO1jUC8
- Interactive Particles with Optical Flow  
  https://www.youtube.com/watch?v=xODS0pZ6CEo
- Directional Motion Detection Using Webcam  
  https://www.youtube.com/watch?v=ju4F1cGhE6Q

---

## 30. Motion Heatmap
**Priority:** 30 / 30

### What it should do
Visualize where and how strongly the DJ is moving.

Stationary regions remain subdued while moving regions become brighter or change color according to velocity.

Possible mapping:
- slow movement = subtle
- medium movement = bright
- fast movement = white-hot / highly saturated

This can be used as either a standalone effect or as a diagnostic-style motion visualization.

### Reference
- Simple Motion Visualisation  
  https://www.youtube.com/watch?v=QGuquFiInqY
- Directional Motion Detection Using Webcam  
  https://www.youtube.com/watch?v=ju4F1cGhE6Q
- Video + Optical Flow + ParticlesGPU  
  https://www.youtube.com/watch?v=WvSAVdj-pCU

---

# Suggested HEADLINER Effect Families

### Temporal
Motion Echo, Ghost Trails, Freeze Ghost, Strobe Clone, RGB Ghost, Slice Delay, Time Wave

### Motion / Optical Flow
Velocity Smear, Motion Melt, Particle Shed, Body Displacement Field, Motion Heatmap

### Tracking
Face Warp, Face Echo, Spark Skeleton

### Segmentation / Silhouette
Aura, Energy Outline, Outline Echo, Digital Silhouette, Portal Body

### Particles / Destruction
Particle Body, Particle Shed, Freeze Shatter, Pixel Explosion

### Glitch / Stylization
X-Ray, Posterize Pulse, Databent DJ

### Multiplication / Spatial
Clone Spread, Mirror Army, Tunnel DJ, Feedback Portal

---

# Recommended First-Pass Build Set

If HEADLINER is initially implemented with a smaller group of effects, the first ten should be:

1. Motion Echo
2. Ghost Trails
3. Velocity Smear
4. Motion Melt
5. Freeze Ghost
6. Strobe Clone
7. Clone Spread
8. RGB Ghost
9. Face Warp
10. Face Echo

These establish the engine's core identity around **the DJ's movement, temporal history, camera presence, and body/face tracking** before expanding into heavier segmentation, particles, recursive feedback, and destruction effects.

---

# Implementation status

Built as Headliner presets (Presets tab), each with its own Design tab (Master Controls, Design, Effects, Palette):

| # | Effect | Status |
|---|---|---|
| 1 | Motion Echo | Implemented |
| 2 | Ghost Trails | Implemented |
| 3 | Velocity Smear | Implemented |
| 4 | Motion Melt | Implemented |
| 5 | Freeze Ghost | Implemented |
| 6 | Strobe Clone | Implemented |
| 7 | Clone Spread | Implemented |
| 8 | RGB Ghost | Implemented |
| 9 | Face Warp | Implemented |
| 10 | Face Echo | Implemented |

This completes the recommended first-pass build set (effects 1–10).

How they work (all on the 2D program canvas):

- **Motion Echo** keeps a history of recent camera frames and layers them over the live picture. Clones are captured on a beat division (BPM Sync on) or a millisecond delay (off). Optional "Motion Only" masks the clones to what is moving.
- **Ghost Trails** is a feedback buffer: only the moving parts of the picture are deposited, then the buffer fades, floats, blurs and can shift colour as it ages. Fast movement lengthens the trail; stillness stays clean.
- **Velocity Smear** estimates a block-matching motion field on a 128x72 copy of the picture and stretches the moving cells along their motion vector, ahead of, behind, or both ways.
- **Motion Melt** turns moving cells to liquid: movement accumulates into a field that drags, drips and spreads, then settles back at a rate set by Viscosity. Still areas stay intact.
- **Freeze Ghost** captures the picture on a Capture Pose button press and keeps it in the scene while the live picture continues. Repeated captures build a group of ghosts; Clear Ghosts removes them.
- **Strobe Clone** captures a clone only on musical events (kick, snare, downbeat, build, or a beat division). Kicks add clones, snares add an alternate-style clone, a downbeat of the chosen bar clears them, and a build-up makes captures more frequent.
- **Clone Spread** duplicates the performer into several copies laid out horizontally, vertically, radially or mirrored, and spreads, collapses or shifts them with the music.
- **RGB Ghost** rebuilds the picture one colour channel at a time from different moments: the first channel of the chosen order is live, the second lags one step and the third two. The step is a beat division (BPM Sync on) or milliseconds (off), grows with movement speed and Master Intensity, and the lagging channels can also drift in space. A still picture looks normal; whatever moves gets red, green and blue fringes. Custom Channels filters the three copies through colours of your choice instead. It keeps at most one second of history at 30 pictures per second.
- **Face Warp** tracks the face and bends only an oval region around it, with the rest of the frame left exactly as the live camera. Styles: Bulge, Pinch, Twist, Stretch, Liquify, Prism and Wobble. It runs as a small WebGL pass over a patch around the face (at canvas resolution), so cost follows the size of the face. Beat Pulse swells the warp on every beat and kick; Palette tints the warped area. With no face found, or if WebGL is unavailable, it shows the plain camera.
- **Face Echo** keeps the body untouched and cuts out only the head (an oval that follows the face outline and its tilt, with a soft edge). A head is captured on each beat division or millisecond delay, and the newest copies are drawn back as echoes. Spread 0% leaves each echo where the head was; higher values fan them out beside the live head, alternating right and left. Echoes can shrink or grow, be mirrored, be tinted, and the real head is drawn back on top by default so it is never hidden.

Shared behaviour: every preset's Master Controls hold Master Intensity (0 is the clean camera), BPM Sync (the track's BPM and beat grid when on, a steady 120 BPM when off), Music Reactivity and Kick Reactivity. The shared code lives in `src/components/vyzualz/react/headliner/` (`HeadlinerEffectCatalog.ts` for the controls, `HeadlinerEffects.ts`, `HeadlinerCloneEffects.ts`, `HeadlinerTemporalEffects.ts` and `HeadlinerFaceEffects.ts` for the renderers, `HeadlinerMotion.ts` for motion analysis, `HeadlinerIsolation.ts` for the clone effects' performer isolation, `HeadlinerTiming.ts` for the clock).

Face tracking (`HeadlinerFaceTracking.ts`, shared by Face Warp and Face Echo): a MediaPipe Face Landmarker (`@mediapipe/tasks-vision`) runs on the camera picture up to 30 times a second, GPU first with a CPU fallback, and is turned into one pose (centre, size, tilt). The pose is smoothed per effect (the Face Follow Smoothing control); a face that is lost is held for about a third of a second and then fades out. The model and the WebAssembly runtime ship in `public/mediapipe/` (about 17 MB, Apache-2.0, see `public/mediapipe/NOTICE.txt`), so tracking works offline. It loads the first time a face effect is active and is released when none is.

Effects 11–30 are not started. Those that need the body (Aura, Energy Outline, Portal Body, Particle Body and similar) will need a person-segmentation model; MediaPipe, now in the project, also offers one (Image Segmenter) that could serve them.
