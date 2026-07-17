# LaserDMX Physical Scanner Correction, Patch 3 of 5

## Scope

Patch 3 replaces display-encoded laser energy, screen-space spectral imitation, and shared nonlaser marker geometry with calibrated linear-light laser optics and dedicated fixture render paths. It preserves the ordered scanner and exposure architecture introduced by Patches 1 and 2.

## Laser color model

- Palette and Brand Kit hex colors are decoded from sRGB into linear-light energy before scene and HDR accumulation.
- Beam Matrix RGBW channels use fixture calibration profiles with nominal wavelengths, relative optical power, channel balance, modulation thresholds, maximum output, and camera response.
- Intersections add linear energy. Tone mapping returns the accumulated HDR scene to display output.
- Dim beams retain authored saturation. Pale or white centers are produced only by bounded exposure-dependent highlight whitening.
- Black remains black. Highlight whitening and fixture calibration are bounded.

The built-in calibration profiles are `balancedRgb`, `highPowerGreen`, and `rgbwCamera`. Ordinary fixture authoring continues to use colors and palettes, not wavelength entry.

## Prism, diffraction, spectral separation, and apertures

Scanner optical output is explicit and energy conserving:

- A normal scanner has one instantaneous output.
- Prism outputs are angular copies around the shared origin.
- Line diffraction distributes copies across one angular axis.
- Grid diffraction distributes a bounded two-dimensional copy set.
- Burst diffraction distributes bounded radial copies.
- Multiple apertures use distinct physical origins.
- Restrained red, green, and blue separation is performed per fixture before rasterization.

Total fixture power is divided across all optical and spectral copies. Fullscreen red/blue channel offsets are disabled and no longer impersonate a fixture optic.

## Projector source optics

Laser apertures remain a laser-only pass. Aperture radius is based on physical aperture metadata, scanner exposure energy, source intensity, perspective, and deterministic optical instability. Saturated halos and pale centers follow accumulated energy. Nonlaser fixtures no longer enter this pass.

## View-sensitive atmosphere

Laser haze uses a bounded Henyey-Greenstein-style phase approximation. Scatter intensity includes:

- Beam-to-camera angle
- Linear beam energy
- Local haze and CO2 density
- Camera-relative depth
- Distance and extinction
- Wavelength response
- Foreground veiling
- Quality-scaled depth slices and bounded samples

Haze and CO2 remain local density sources. They do not create room, wall, floor, ceiling, or fullscreen gray geometry.

## Dedicated nonlaser renderers

The WebGL runtime now owns separate programs and instance plans for:

- Moving-head cones with zoom, iris, frost, focus, hotspot, soft field edges, pan/tilt-derived targets, procedural repository-owned gobos, gobo rotation, and distinct prism projections
- PAR and wash fields with broad soft falloff and no laser core
- Strobe and blinder source flashes with broad atmospheric pulses and no scanner persistence
- LED bars and tubes with continuous, segmented, chase, gradient, rotation, stable thickness, and local bloom behavior
- Video surfaces with 16:9 aspect preservation, controlled emissive output, and safe procedural fallback when external media is unavailable
- Haze density sources with direction, spread, drift, output, and dissipation
- CO2 sources with deterministic triggering, expansion, turbulence, bounded lifetime, density decay, depth-aware scattering, and partial beam extinction

The sharp laser renderer and aperture renderer accept laser fixtures only. `universalRibbonFixtureCount` is fixed at zero in the dedicated fixture plan.

## Compatibility and migration

- Show Director schema version is advanced with defaults for diffraction mode, copy count, spectral separation, aperture count, and aperture spacing.
- Existing saved fixtures normalize to a normal single-output scanner with no spectral separation.
- Existing color, palette, and Brand Kit controls remain display-oriented authoring controls and are converted internally.
- Beam Matrix output compatibility is retained.
- Canvas2D remains the safe simplified fallback and continues to use existing compiled fixture approximations.

## Regression coverage

CPU regressions cover:

- sRGB conversion, linear mixing, fixture calibration, white-channel contribution, bounded highlight whitening, and black-floor preservation
- Prism, line, grid, burst, spectral, and multi-aperture copy generation with source-energy conservation
- Scanner integration for every explicit optical mode
- View-sensitive phase response, local haze/CO2 response, depth slicing, extinction, and deterministic transport time
- Moving-head cone properties, gobos, rotation, prism copies, zoom, iris, frost, and focus
- Wash fields, strobe and blinder pulses, LED tube and chase modes, video surface fallback, haze sources, CO2 lifecycle, seek/loop determinism, laser-only persistence, and Canvas2D compatibility
- Removal of the universal highlighter material and fullscreen spectral offset path

Browser-backed WebGL regression coverage compiles and links every production shader program in Chromium WebGL2, including all dedicated fixture programs and the revised atmosphere and photographic passes.

## Deferred to Patch 4

Patch 4 should add the complete scanner and fixture authoring workflow, expose the new diffraction and aperture controls in the Show Director editor, add diagnostics and validation UX for optical budgets, and migrate built-in shows to make intentional use of the new fixture models. Complete reference-show migration and final acceptance remain outside this patch.
