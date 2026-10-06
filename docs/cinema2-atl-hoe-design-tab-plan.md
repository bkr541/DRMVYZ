# ATL HOE: Design tab and audio-reactive controls

**Status:** Implemented (uncommitted at the time of writing); owner decisions recorded at the end. The sections below are the approved proposal; the Implementation notes section records where the build differs from it. It covers the owner's requested controls, the proposed four Sign Patterns, how each control maps onto the scene, and the open decisions. It follows the approved static frame (see `cinema2-atl-hoe-visual-fidelity-plan.md`, Phase 9).

## Owner answers already received

- Sign Patterns: Claude proposes, the owner approves (below).
- Music, Kick, Transient and Drop sliders: mimic the Electric Storm preset's behaviour (below).
- Camera Movement: subtle drift, default 0, so the approved frame is unchanged at the default.
- Architecture Color: recolors all lit architecture (windows including the cyan ones, street lights, crowns and spires). The red aviation beacons stay red.

## Controls

### Master Controls

| Control | Type and default | Behaviour |
|---|---|---|
| Master Intensity | slider 0–1.5, default 1.0 | Scales the brightness of every lit part (sign faces, windows, street lights, crowns and spires) and the strength of all audio reactions. 1.0 is the approved look. |
| BPM Sync | toggle, default on | Locks pattern timing, flicker rhythm and camera drift to the analysed or Audio Dock tempo instead of raw elapsed time (same meaning as Electric Storm). |
| Camera Movement | slider 0–1, default 0 | Slow sway and parallax that grows with the slider. At 0 the camera is locked. |
| Music Reactivity | slider 0–1, default 0.8 | Electric Storm meaning: how strongly the continuous music energy (the "director" signals: intensity, build, impact) drives the scene. Here it scales the rate and depth of the sign pattern, window brightness swell and atmosphere breathing. |
| Kick Reactivity | slider 0–1, default 0.72 | Strength of the response to each kick event (a pulse on the sign and street lights). |
| Transient Reaction | slider 0–1, default 0.58 | Strength of the response to each transient (window sparkle, star twinkle, small spire flashes). |
| Drop Reaction | slider 0–1, default 0.92 | Strength of the response when a drop arrives (whole-city blaze and, in Thunderstorm, a hero strike). |

The four reaction defaults are Electric Storm's own defaults. They apply only when audio is playing; with no audio the scene is the static approved frame.

### Design: Lighting

1. **Sign Pattern** (dropdown, four patterns, proposed below). It choreographs the WAFFLE HOUSE sign, the skyscraper windows, the street lights and the skyscraper spires together.
2. **Sky Pattern** toggle, default off (the current gradient sky with its fixed stars). When on, a **Sky Pattern** dropdown appears with two options:
   - **Stars:** stars that react to the music: transients make groups of stars twinkle, kicks brighten the field slightly, drops flare it briefly.
   - **Thunderstorm:** a darker storm sky with lightning, thunder flash and atmosphere borrowed from Electric Storm (see the Thunderstorm section for the approach and risk).

### Effects

1. **Flicker** slider 0–1, default 0: failing-neon flicker on the WAFFLE HOUSE sign (cells drop out and stutter at random).
2. **City Atmosphere** slider 0–1: haze and mist in front of the sign, between the sign and the city, and through the skyscrapers (drives the atmosphere effect's mist and density, and the depth fog). The default keeps the approved look.

### Palette

1. **Sign Color:** the sign's face color (default yellow).
2. **Letter Color:** the sign's letters (default black).
3. **Architecture Color:** windows (amber, cyan and glass), street lights, crowns and spires. The red beacons are excluded. See open decision 1.

## The four Sign Patterns (proposed)

Each pattern drives four groups together: **Sign** (the eleven cell faces), **Windows** (the skyscraper windows), **Lights** (the street lamps) and **Spires** (the crowns, rims and masts). All respect BPM Sync. Reactivity and Drop sliders scale them.

1. **Marquee.** The sign cells light one after another along the top row, then the bottom row, one cell per beat, with a bright head and a short fading tail, like a theatre marquee. Windows twinkle in bands that climb the towers on each bar. Street lights step left to right on the beat. Spires brighten on the downbeat. Drop: every cell lights at once.
2. **Pulse.** The whole scene breathes with the music. The sign swells on every kick, the windows brighten and dim with the bass energy, the street lights pulse together, and the spires flash on the downbeat. Quiet or vocal passages dim the windows and street lights and leave the sign and spires. Drop: a full-city blaze.
3. **Cascade.** A wave of light crosses the scene from left to right on every phrase: first the sign cells, then the left-hand buildings, the towers and the right-hand buildings, with the street lights following along the road and the spires cresting last. Between phrases the scene rests at a steady glow. Drop: two waves in quick succession.
4. **Neon Fault.** A failing-neon feel. On transients, random sign cells and window groups drop out and stutter back; street lights flicker one by one; spires blink slowly out of phase. Kicks snap the sign to full brightness. Drop: everything steadies and blazes for a bar, then the faults return.

## How it would be built

- **Parts.** The model is one mesh per material today, so lit things cannot be animated separately. The generator needs to split them: the sign faces into 11 cell parts; the windows into per-building groups (about 8); the street lights into about 4 groups along the road; the spires into about 4 (Bank of America roof, Westin rim, Truist cap, mast tips); the stars into about 6 groups. That is roughly 35 more parts, with no change to the geometry.
- **Controls.** Palette and Master Intensity bind to the existing per-part color and emissive parameters of the three-scene module. Reactions are choreography rules (kick, transient, downbeat, phrase, drop and the continuous director signals) that add, multiply or envelope those same per-part parameters, the way Electric Storm drives its own module.
- **Patterns.** Each of the four patterns is a set of choreography rules over the part groups, switched by the Sign Pattern dropdown. Patterns that need a travelling or random element (Marquee, Cascade, Neon Fault) are built from one rule per part, staggered by beat offsets.
- **Camera Movement.** Uses the existing camera motion support (tempo sway and kick push), scaled by the slider, with the default 0.
- **City Atmosphere and Flicker.** City Atmosphere binds to the atmosphere effect's mist and the environment fog. Flicker needs a small runtime addition to the three-scene module (per-part random dropout, modelled on the segment lighting's flicker) or an equivalent rule set.
- **Tests.** Each control gets a preset-contract test (parameters, defaults, bindings), plus a render check of each pattern at one visual time.

## Thunderstorm: approach and risk

Electric Storm's lightning is a procedural full-screen module with its own background. ATL HOE's sky is opaque 3D geometry behind the city, so a full-screen lightning layer cannot sit behind the skyline without covering or being covered by it. Proposed approach: **pre-generate about 12 bolt shapes at build time** (using Electric Storm's own strike generator), place them in the sky behind the skyline as emissive geometry, and flash them from choreography on kick, transient and drop events; the storm sky is a darker gradient; thunder is a sky-wide flash plus a short exposure and haze swell (Electric Storm's Flash Intensity, Duration and Decay behaviour); atmosphere is rain-free haze. The bolts are therefore fixed shapes chosen from a set, not freshly generated each strike. If fixed bolts are not acceptable, the alternative is a deeper engine change so the procedural module can render into the scene behind opaque geometry. That would be a separate, larger task.

## Proposed build order

1. Part splitting in the generator, with no visual change at the defaults (verify by capture).
2. Palette controls and Master Intensity.
3. Camera Movement, City Atmosphere, BPM Sync.
4. Reactions and the four Sign Patterns, with Flicker.
5. Stars sky pattern.
6. Thunderstorm sky pattern.
7. Preset tests, plan updates, and a capture of every pattern.

## Open decisions (resolved)

1. **Default Architecture Color.** The approved frame mixes amber and cyan windows and gold crowns. One color setting recolors all of them, so the default cannot reproduce the mixed look as a single value. Options: (a) default to the authored mixed colors, with the color picker overriding all of them once the owner picks a color; (b) default to amber, so the cyan windows become amber at the default.
2. **Thunder.** Visual only (flash and haze), with no sound, assumed.
3. **Thunderstorm bolts.** Fixed pre-generated bolt shapes (recommended) or the larger engine change.
4. **Defaults.** Sign Pattern default Pulse, Flicker 0, City Atmosphere at the current look, Sky Pattern off.

Resolved by the owner: (1) the default Architecture Color keeps the authored mixed colors until a color is picked; (2) thunder is visual only; (3) Thunderstorm uses twelve defined bolts; (4) the proposed defaults stand.

## Implementation notes

Files: `presets/Cinema2AtlHoeDesign.ts` (controls, palette bindings, choreography), `presets/atlHoeParts.json` (the part groups, shared with the generator), `presets/atlHoeBolts.json` (written by the generator: each idle bolt's colour), `scripts/cinema2-assets/generate-atl-hoe.mjs` (part splitting, bolts), and tests `Cinema2AtlHoeDesign.test.ts` and `Cinema2AtlHoeBehavior.test.ts`. The default frame is unchanged: it differs from the approved capture only by faint outline traces of the idle bolts (under 0.2% of pixels, at most a few levels except on thin aliased branch edges).

Where the build differs from the proposal:

- **Master Intensity** is a multiplier that is exactly 1 at its default (so a missing rule can never dim the scene): 8% at 0, 1.46 at 1.5. Reactions add to a part's brightness before the multipliers, so Master Intensity also scales how hard the music pushes the scene.
- **BPM Sync** works as in the other presets: on, everything that keeps time (the Marquee chase, the Cascade wave, the stepping street lights, the spire blinks, Flicker, the Thunderstorm strikes, and the camera sway) locks to the loaded track's BPM and beat grid through the shared beat clock; off, it all runs at a steady 120 BPM. Kick, transient and drop hits always follow the music itself. This needed a third small engine addition: a choreography manifest can name a `tempoSyncParameter`, and its beat, bar and phrase events, beat counters and beat lengths then come from the shared beat clock (the track's tempo when on, 120 BPM when off) instead of raw audio events.
- **Camera Movement** uses the shared camera motion (drift, weave, lens breath), default 0; Kick Reactivity does not move the camera.
- **Architecture Color** is one visible color driving the windows directly and nine hidden groups (crowns, piers, street lights, halos, Westin and Truist windows, glass, rims, masts) through a new `metadata.mirrorParameters` feature of the parameter state, so editing it overrides all of them; resetting it returns the windows (and, because the hidden groups mirror it, all groups) to amber, not to the mixed authored colors. Beacons are never bound.
- **Sign Color** and **Letter Color**: the sign face and letter base colors are now white in the model and tinted by parameters.
- **Sign Patterns** are sets of choreography rules switched by a new `enabledWhen` condition on choreography rules (a rule runs only while parameter conditions hold). Pulse is the default and the authored look; Marquee, Cascade and Neon Fault sit at lower rest levels between hits.
- **Flicker** is a beat-triggered, per-cell stepped dropout, so it needs a beat grid to act. **City Atmosphere** multiplies the haze (mist, density, fog) and is exactly 1 at the middle of the slider.
- **Stars** brighten (x1.6), twinkle in random groups on transients, swell with kick and energy, and flare on a drop. **Thunderstorm** darkens the sky and haze, snuffs the stars, strikes one of the twelve bolts on the first beat of every bar in turn (a stronger flash then a weaker one, with a thunder flash on the exposure) and brings eight bolts on a drop.
- Three small engine additions, all tested: `enabledWhen` on choreography rules, `metadata.mirrorParameters` on parameters and `tempoSyncParameter` on the choreography manifest. The capture harness also gained a development-only `--params` option for rendering Design-tab values.

Verification and limits: the real manifest is run through the choreography runtime with synthetic audio (default brightness, Master Intensity, kick, pattern rest levels and the Marquee chase, Flicker, Stars and Thunderstorm strikes) and the Design tab layout is checked through the inspector model. Static renders confirm the palette and the Thunderstorm look (with bolts lit for the check). It has not been run against a real track in the app, so the feel (strike rate, hit strengths, how often transients fire) is untuned. Idle bolts leave a very faint outline in the sky.
