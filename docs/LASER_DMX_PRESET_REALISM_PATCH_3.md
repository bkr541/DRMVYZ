# LaserDMX Show Director Preset Realism, Patch 3

Patch 3 re-authors every bundled Show Director performance program on top of the finite-cue runtime and shared physical-scanner renderer introduced by Patches 1 and 2.

## Canonical authoring model

All first-party presets pass through `authorLaserDmxBuiltInPerformanceProgram`. The authoring factory now produces a deterministic 64-beat section cycle divided into four one-bar cue cells. Every cue has an explicit attack, movement, hold, release, blackout interval, maximum run duration, completion behavior, and parameter-ownership contract. Default loop mode is `none`; finite circle rotation is limited to one authored turn followed by a hold or blackout.

The common section arc is intentionally musical:

- Intro and verse use restrained banks, stable motifs, and long black gaps.
- Build recruits banks progressively and expands finite patterns at phrase scale.
- Pre-drop collapses to a held focus and then an explicit shutter-closed blackout.
- Drops alternate groups, reserve the full laser rig for brief accents, and withdraw after impact.
- Breakdown returns to sparse pairs and long holds.
- Second drop changes group order and motif vocabulary rather than simply multiplying intensity.
- Outro progressively withdraws fixtures and terminates in complete blackout.

Preset profiles retain distinct identities by selecting different palettes, macro families, fixture roles, and support-fixture choreography. Lasers, moving heads, LED fixtures, strobes, blinders, haze, wash, and CO2 are balanced by section-specific output ceilings rather than one permanent global glow.

## Music Intelligence hierarchy

Transient sources only create short accents. Beat and bar sources replace or hand off bounded cues. Phrase events recruit fixtures and develop motifs. Section classification chooses the broad show arc. Raw audio is not allowed to drive unbounded pattern phase, target orbit, or renderer-local geometry.

## Authoring diagnostics

The Show Director runtime panel exposes the active finite cue, trigger, quantization, lifecycle durations, blackout behavior, start and destination state, finite rotation, repeat and maximum duration, fixture groups, ownership, completion behavior, scanner-frame motion, fixture motion, intensity, and shutter state. Realism warnings appear in the same inspector.

## Realism validator

`validateLaserDmxShowDirectorPresetRealism` integrates with the existing performance-program validation surface. It reports structural errors and realism issues including unbounded rotation or orbit, renderer-time phase, continuous-on violations, missing section blackout, excessive simultaneous fixture or animation activity, prolonged full-rig use, ownership conflicts, linked scanner and fixture movement, shutter/output contradictions, excessive scanner or rotation speed, permanent full brightness, missing group alternation, missing section development, renderer-dependent choreography, missing stable holds, and an outro that does not end black.

`auditLaserDmxShowDirectorBuiltInPresets` compiles and audits every bundled program. The test suite also verifies deterministic intro-through-outro reconstruction after seek, backward seek, loop, pause/resume, renderer switch, preset switch, and track completion.

## Visual acceptance coverage

The WebGL visual reference manifest now includes ten finite-cue acceptance identities: stable fan, upward sweep, circle hold, one-turn circle hold, tunnel pulse to blackout, alternating groups, build recruitment, pre-drop blackout, drop full-rig withdrawal, and end-of-track blackout. These identities reuse the production renderer review frames, so they guard semantics without creating a renderer-specific choreography path.
