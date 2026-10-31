# GLASSFALL behavior contract

Current direction (2026-10-31): triangles in every slot. The user removed the
French Bulldog element. Its runtime geometry, asset dependency and Inspector
controls are removed. Current state: phases 6–8 implementation and automated acceptance completed;
human visual/musical acceptance pending. See FINAL_HANDOFF.md for Auto
Performance, finishing, production integration and final validation. PHASE_5.md
and PHASE_4.md specify the underlying meaning/choreography bounds.

## Reference layout and geometry

Reference: `/Users/kodyrobinson/Desktop/Glassfall.mov`, approximately 11.1 seconds,
712 × 1006 portrait. Preserve the paired/interleaved triangle bands, cyan/violet/
white lighting, dim physical contours and layered dark installation.

World coordinates: +x right, +y up, +z toward a near-frontal fixed camera. Vertical
framing approximately 3.1 units. Column pitch 1.04; inverted slots offset
(+0.52,+0.26); like-oriented band pitch 1.10. Uneven vertical intervals preserve
the reference layout. Resize reveals/crops columns without stretching triangles.

The supplied `modules/glassfall/triangle.glb` provides actual beveled geometry.
Use its mesh-local coordinates (excluding export-camera transforms), rotate it
+90° around z, center and normalize occupied bounds to 0.78 × 0.68 × 0.12.
Inverted instances rotate 180° around their occupied center.

## Physical depth

Symbol center +0.23, back +0.17. Black panel front -0.035, thickness 0.10.
Separate rear front -0.42, thickness 0.06. Mounting posts connect each triangle to
its panel. Panel-to-rear clearance is 0.285. Open panel seams expose that gap.
Panels are 0.505 × 0.525 boxes at 0.52 × 0.55 pitch. Geometry casts/receives real
shadows. Bright front materials, darker sidewalls and cyan/violet fill reveal
bevels and elevation. No camera animation or postprocessing effects.

Native Three rendering follows the shared host/state guard path used by
Backstreet. The manifest owns camera and depth24 scene target. Module resource
leases retire geometry, materials and shadow resources, not the shared renderer.
Lazy GLTF loading aborts/cleans up safely; failures surface diagnostics.

## Manual controls and visible consumers

| Parent | Controls |
|---|---|
| Master Controls | BPM Sync; Master Intensity (emission ceiling) |
| Design | Pattern / Pattern Change / Trigger; Field Scale; Spacing; Fall Speed; Sequence Speed; Relief |
| Palette | Background; Triangle Cyan; Triangle Violet; Triangle Highlight; Panel Color |

Each color independently affects its named visible role. In the phase 3 review, Pattern Change and Trigger are active. Trigger is
conditional on Pattern Change. The canonical 11 options are reused unchanged.
Music Reactivity independently controls bounded audio responses. Phase 4 adds
a hard Choreography permission and shared smoothing/event envelopes. Phase 5
adds user-owned Director Influence without automatic pattern/camera/color control.
Auto Performance and finishing are now implemented; FINAL_HANDOFF.md defines
their scope and authority. The entry remains explicitly available for review.

## Six native lighting programs

Every program keeps the reference geometry and physical depth:

1. Glassfall: coherent descent and staggered illumination.
2. Cascade: lighting waves across paired bands.
3. Split Current: offset column lighting progressions.
4. Prism Trace: traveling contour emission.
5. Dark Windows: moving dim regions with surviving physical form.
6. Prism Relay: light relays between upright and inverted triangle slots.

The animated field recycles six complete bands outside visible bounds. Panels
scroll consistently with the installation. Zero speed holds its timing domain.

## Timing and authority

BPM Sync ON maps shared transport/grid position to descent and illumination.
OFF uses authored seconds-based rates; host Sync does not veto the preset toggle.
No local beat detector or competing musical clock. No-track idle is deliberately
slow. Loaded pause holds the pose. Speed/Sync edits preserve current phase;
seek, track/analysis changes and re-entry reconstruct deterministic canonical
phase and clear obsolete state.

Manual controls and colors are authored truth. Future musical modulation must be
bounded around that base through the shared target resolver/choreography system.
Visual Director supplies broad significance only. Pattern Change defaults OFF.
When connected, fresh selected events may advance the runtime base without
persisting over authored Pattern. Manual Pattern edits apply immediately and
hold until a subsequent fresh event. Temporary build/drop performance requires
explicit later Auto Performance permission and must restore the current base.
Hard OFFs remain permissions; automation cannot re-enable them.

## Acceptance and provenance

Focused tests exercise actual GLB occupied bounds, reference spacing, extrusion
and both background gaps; timing tests cover synchronization, continuity, holds,
reconstruction and six native programs. Production browser acceptance checks
visible controls/palette, patterns, motion, pause/seek/re-entry, aspect ratios,
Inspector controls and resource disposal. Human review remains required.

Embedded GLB metadata: **Triangle by LTPman**, CC BY 4.0.
https://sketchfab.com/3d-models/triangle-b7386fe62a554a39b12212c4992975bf
https://sketchfab.com/LTPman · https://creativecommons.org/licenses/by/4.0/
Source GLB is unchanged. Runtime modifications: mesh-local orientation,
normalization, material assignment and instancing. Attribution appears on review
pages and must accompany distribution.
