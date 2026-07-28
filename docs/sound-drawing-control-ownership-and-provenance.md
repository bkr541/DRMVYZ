# Sound Drawing Control Ownership and Preset Provenance

This contract defines the user-facing and runtime meaning of Sound Drawing controls after the Patch 2 control-ownership correction.

## Pro Scope size and signal calibration

`oscillatorSettings.pathScale` remains the canonical persisted presentation scale. In Pro Scope it is exposed as **Trace Size** and is the primary immediate visual-size control.

`scope.signalConditioner.gainX` and `gainY` remain canonical persisted signal-domain values. They are exposed under Advanced Signal Conditioning as **Post Auto-Gain Trim**, with independent **X Trim** and **Y Trim** controls. Conditioner gain remains smoothed by `ScopeSignalConditioner`; Trace Size remains immediate.

The settled geometric scale before viewport fitting is approximately:

```text
settled X factor = Trace Size × conditioned X gain
settled Y factor = Trace Size × conditioned Y gain
```

Auto Gain is a separate dynamic normalization stage. The advanced diagnostics show the static settled factors and explicitly identify Auto Gain as additional runtime behavior. Existing `gainX`, `gainY`, and `pathScale` values are not migrated or rewritten, so historical projects retain materially equivalent geometry.

### Linked axis semantics

`scope.axisGainLinked` is authoring metadata, not a third gain value.

- Equal gains plus `axisGainLinked: true` display **Linked**.
- Unequal gains, or an explicit unlink, display **Custom X/Y**.
- Editing X or Y changes only that canonical axis and unlinks the pair.
- The linked master is disabled while custom.
- **Relink X/Y at Average** is the explicit destructive action that writes both axes.
- Waveform modes disable X Trim because horizontal position is timebase-driven and waveform amplitude uses Y gain.

Scope state version 6 adds only `axisGainLinked`. Earlier states derive it from whether `gainX` and `gainY` already match, preserving both values and rendered geometry.

## Trigger Stability macro

**Stability Macro** is a UI macro over two independent trigger-selection costs:

- `trigger.continuityWeight`: preference for staying near the previous within-window trigger position.
- `trigger.periodAssist`: preference for an integer-period phase match in absolute capture coordinates.

The macro displays **Linked** only while the values match. Moving it intentionally writes both values. Editing **Continuity** or **Period Assist** changes only that algorithm and produces **Custom** status. Presets with unequal values remain unequal and truthful.

## Preset provenance

Preset IDs are stable provenance and are not cleared by manual edits, Track Map cues, automation, save/reload, or deterministic playback.

### Pro Scope presets

Scope provenance is derived by comparing the normalized current scope state against the complete installed source preset, excluding only schema version and `presetId`.

- **Exact**: all preset-owned values match.
- **Modified from _Preset_**: provenance exists, but one or more values differ.
- **Custom**: no preset provenance exists.
- **Unknown legacy preset**: the saved ID is retained but is not installed.

Reset resolves the complete source preset. Returning all values exactly to the source recipe automatically restores Exact.

### Generic React presets

Generic React provenance compares the active preset against:

- Intensity
- Motion
- Glow
- Bass React
- Trail Decay
- Fog Density
- Particle Density
- Engine-authored fields present in the preset, including Sound Drawing oscillator settings
- Existing engine-specific modified state, including Cinematic Worlds overrides

The shared preset card receives a derived Modified state and describes the card as source provenance rather than claiming its description is the exact current result. Selecting the source card again restores its exact preset-owned controls. Stable IDs remain available to Track Map and automation.

## Sound Drawing ownership domains

`SoundDrawingOwnership.ts` is the centralized resolver. Components must not invent independent ownership rules.

Every affected domain resolves to one of:

- **Manual**: the visible manual value is the resolved runtime input.
- **Program**: an authored show fully shadows the manual value; the control is disabled.
- **Locked**: the manual value is protected and remains a valid authored input; the control stays editable.
- **Mixed**: manual and authored values both contribute; the control stays editable.
- **Unavailable**: the current mode or show does not consume the value; the control is disabled.

The resolver covers source, base geometry, motion, topology, echo count, glow, trails, reaction, Pro Scope, performance intensity, and presentation. Trace Size, Motion, Bass React, Glow, Intensity, and Trail Decay remain editable when they are mixed into authored output. Render Mode, mirror symmetry, duplicate traces, rotation presentation, and Pro Scope signal controls disable only when the authored runtime fully replaces them. Matching locks promote eligible rows to Locked ownership. The resolver supplies consistent labels, reasons, and accessibility descriptions, so Auto Performance never blanket-disables the interface.

## Trail composition and lock compatibility

Trail lock semantics use their own contract version. The React persistence document advances to version 56 so historical locked shows are normalized explicitly before merge.

### Version 1: legacy recipe lock

Historical saved projects with `locks.trail: true` and no trail contract normalize to:

```ts
{ version: 1, mode: 'legacyRecipe', snapshot: null }
```

This preserves the historical authored recipe. It does not claim to protect the visible manual Trail Decay. The UI labels it **Legacy Performance Trail Recipe** and offers an explicit upgrade action.

### Version 2: corrected manual trail protection

New projects use:

```ts
{ version: 2, mode: 'manualResolved', snapshot }
```

Enabling **Protect Manual Trail State** snapshots the visible manual Trail Decay plus the Auto Section and Living Ribbon context present at capture time. The captured Trail Decay owns the final fade alpha and is not replaced by the authored recipe. While protection remains enabled, edits through the canonical Trail Decay store action, including preset and automation changes, update the protected snapshot and deterministically reset the trail buffer.

Auto Section mode and Living Ribbon persistence are capture-context diagnostics, not additional aliases for Trail Decay. Ribbon Trails, source-trail strength, and feedback remain intentionally separate domains. They may still shape generated-layer afterimages and authored source behavior, but they cannot replace the version 2 final fade alpha. The dedicated **Ribbon Trails** lock continues to own Living Ribbon persistence.

### Trail equation and precedence

Without corrected manual protection, the historical authored equation remains:

```text
authoredPersistence = clamp(
  globalTrailPersistence × 0.78
  + activeSourceTrail × 0.16
  + feedbackAmount × 0.12,
  0,
  0.98
)

fadeAlpha = clamp(
  ((1 - authoredPersistence) × 0.28 + manualTrailDecay × 0.04)
  / livingRibbonTrailDetail,
  0.02,
  0.32
)
```

With version 2 manual protection:

```text
fadeAlpha = frame-rate-independent manual Trail Decay alpha
```

Trail Intensity and Trail Decay remain distinct. Trail Intensity changes authored persistence demand; Trail Decay changes fade speed. Deterministic tests pin both paths, legacy compatibility, and final-lock precedence.
