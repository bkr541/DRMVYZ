# HUD | Native Cinema 2.0 review candidate

## Visual specification and ownership

An enhanced interpretation of the three radial HUD recordings: a centered, dark-core reactor with physical beveled segmented rings, recessed luminous channels, white directional chevrons, small blue radial meters, orbital satellites, angular brackets and quiet background details. Preserve negative space and a mostly perpendicular view with subtle shared camera sway. No text, external assets, simulated beat detector, custom Inspector or parallel render surface. Native world geometry writes scene depth; the shared render graph supplies HDR bloom, atmosphere, grade and AA. The shared camera fits narrow viewports. Metallic faces are shaded by their geometric normals; channels sit inside raised rims. The palette is independent: primary arcs, meter bars, indicators, metal, satellites and background.

## Controls / authority / output

The standard four Design parent groups are used. All editable controls persist and reset through the native manifest. Auto Performance is off by default. With it on, the shared Inspector locks Master (except BPM Sync and Auto Performance), Design and Effects, leaving Palette editable. Numeric controls receive baseline-relative bounded drives; no saved values are written. With it off, the saved values are authoritative, with only bounded additive music gestures scaled by Audio Reactivity. Zero motion, zero reactivity and camera disable are respected. Pattern Change and Trigger use shared mood policy and event identity. Pattern edits do not disable Pattern Change. No temporary pattern override is used: structural gestures temporarily transform the current base geometry instead.

| Group | Control | Visible role / authority |
|---|---|---|
| Master Controls | Master Intensity | emissive gain, user base + mood |
| Master Controls | Audio Reactivity | scales continuous and event choreography, user base |
| Master Controls | Motion Amount | phase travel and spatial motion, user base + mood |
| Master Controls | BPM Sync | shared beat clock vs 120 BPM reference, user owned |
| Master Controls | Auto Performance | authorizes shared mood drives and trigger choice |
| Master Controls | Camera Motion / Intensity | shared camera sway, user base + mood |
| Design | Pattern / Pattern Change / Trigger | base program / enable / canonical 11 event choices; shared policy when Auto is on |
| Design | Motion Rate | speed multiplier, user base + mood |
| Design | Ring Separation | physical Z spacing, user base + mood |
| Design | Light Coverage | illuminated arc width, user base + mood |
| Design | Satellite Amount | satellite and bracket scale / prominence, user base + mood |
| Design | Shutter Travel | independent aperture mechanism travel, user base + mood |
| Design | Meter Travel | radial bar extension, user base + mood |
| Effects | Bloom / Atmosphere Density / Vignette | shared HDR glow, subtle depth haze, lens falloff, user base + mood |
| Palette | Primary / Meters / Indicators / Metal / Satellites / Background | distinct visual targets, user owned |

## Pattern library

| Program | Geometry and movement |
|---|---|
| REACTOR (default) | assembled layered reactor, independent ring speeds and chase |
| RADAR | narrow radial scanning sector, trailing meter illumination |
| COUNTER SPIN | alternating rotational directions and interlocking banks |
| ENERGY PULSE | outward radial wave, successive rings and Z travel |
| ORBITAL | reduced reactor silhouette and orbiting satellite arrays |
| SEGMENT CHASE | stationary housings with stepped traveling LED bands |
| COLLAPSE | rhythmic contraction to a central dot, progressive reassembly |
| LOCK ON | angular quadrant alignment, contracting shutters and targeting brackets |
| OVERLOAD | widened meter travel, offset alternating banks and dense illumination |

Program transitions interpolate matching primitive roles; paused/manual selection is immediate. No separate beat grid. When sync is on and the host permits it, `Cinema2BeatClock` follows the shared BPM/grid; otherwise it free-runs at the reference tempo. No-source idle remains animated; paused playback freezes phase. Seek, track change and context generation reset transient state. Shared event IDs are consumed once, including across manual changes and resume.

## Audio mapping

Continuous shared choreography resolves sub to radial expansion, bass to meter length, mid to satellite orbital displacement, high/air to indicator activity, spectral flux to localized light activity, vocal to reduced accents, build to shutter compression; Director intensity/build/impact supply bounded macro changes. Shared event envelopes: kick outward pulse, snare alternating bright banks, beat indicator chase accent, downbeat shutter accent, bar bracket accent, phrase alignment, section satellite shift, drop radial expansion and all-layer accents. Beat-grid rules use not-silent; drop is not gated. Mood drives span Design and Effects: see the explicit drive table in the manifest; each factor multiplies the authored value, is scaled by Audio Reactivity and clamped by the target range. Silence reduces motion and emission.

## Acceptance / release

Reference catalog role until actual production canvas and human visual acceptance. Test the three recordings against default, radar, orbital and collapse; review all nine patterns, each palette role, min/max controls, idle, pause, seek, reset, re-entry, 16:9 and portrait, all 11 triggers, manual selection during cycling, no stale event, global/local BPM sync, silent stop and drop, Auto on/off saved values and Inspector lock/readouts. Verify production preview and casting share the existing native output path. Do not promote to keeper solely on compile/test success.

Validation of this patch: native compiler and first-party authoring validator reported no diagnostics; six focused regression cases passed via a local TypeScript assertion runner. Full Vitest, application build and production-browser acceptance remain pending: dependency installation was blocked by registry DNS, and Chromium could not establish a usable WebGL context in the review environment. On a configured development machine, run:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2HudPreset.test.ts
npm run test:e2e:cinema2-hud
```

Review the rendered output before authorizing a keeper promotion.
