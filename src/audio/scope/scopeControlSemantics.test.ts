import { describe, expect, it } from 'vitest'
import { ScopeSignalConditioner } from './ScopeSignalConditioner'
import { resolveScopePresetState } from './scopePresets'
import {
  relinkScopeAxisGains,
  resolveScopeAxisGainLinkState,
  resolveScopePresetProvenance,
  resolveScopeSettledScaleDiagnostics,
  resolveScopeStabilityMacro,
  scopeSignalModeUsesXGain,
} from './scopeControlSemantics'
import { normalizeSoundDrawingScopeState } from './scopeStateNormalization'
import { DEFAULT_SOUND_DRAWING_SCOPE_STATE } from './scopeTypes'

describe('Pro Scope control semantics', () => {
  it('detects equivalent settled conditioner-gain and Trace Size geometry', () => {
    const base = normalizeSoundDrawingScopeState(DEFAULT_SOUND_DRAWING_SCOPE_STATE)
    const renderSettled = (gain: number, traceSize: number) => {
      const conditioner = new ScopeSignalConditioner()
      conditioner.setSettings({ ...base.signalConditioner, coupling: 'dc', gainX: gain, gainY: gain })
      conditioner.snapParameters()
      const x = Float32Array.from([0.25, -0.5, 0.75])
      const y = Float32Array.from([-0.75, 0.5, -0.25])
      conditioner.process(x, y, x.length, 48_000)
      return {
        x: Array.from(x, value => value * traceSize),
        y: Array.from(y, value => value * traceSize),
      }
    }
    const a = renderSettled(0.5, 2)
    const b = renderSettled(1, 1)
    expect(a.x).toEqual(b.x)
    expect(a.y).toEqual(b.y)

    const diagnosticsA = resolveScopeSettledScaleDiagnostics(2, {
      ...base,
      signalConditioner: { ...base.signalConditioner, gainX: 0.5, gainY: 0.5 },
    })
    const diagnosticsB = resolveScopeSettledScaleDiagnostics(1, base)
    expect(diagnosticsA.settledXFactor).toBe(diagnosticsB.settledXFactor)
    expect(diagnosticsA.settledYFactor).toBe(diagnosticsB.settledYFactor)
  })

  it('keeps independent gains canonical and requires explicit relink', () => {
    const scope = normalizeSoundDrawingScopeState({
      ...DEFAULT_SOUND_DRAWING_SCOPE_STATE,
      axisGainLinked: false,
      signalConditioner: { ...DEFAULT_SOUND_DRAWING_SCOPE_STATE.signalConditioner, gainX: 0.7, gainY: 1.3 },
    })
    expect(resolveScopeAxisGainLinkState(scope)).toMatchObject({ linked: false, mixed: true, linkedValue: null })
    const relinked = relinkScopeAxisGains(scope)
    expect(relinked.signalConditioner.gainX).toBeCloseTo(1)
    expect(relinked.signalConditioner.gainY).toBeCloseTo(1)
    expect(resolveScopeAxisGainLinkState(relinked).linked).toBe(true)
  })

  it('persists linked and unlinked state without rewriting axis values', () => {
    const restored = normalizeSoundDrawingScopeState({
      ...DEFAULT_SOUND_DRAWING_SCOPE_STATE,
      axisGainLinked: false,
      signalConditioner: { ...DEFAULT_SOUND_DRAWING_SCOPE_STATE.signalConditioner, gainX: 0.8, gainY: 1.2 },
    })
    expect(restored.axisGainLinked).toBe(false)
    expect(restored.signalConditioner).toMatchObject({ gainX: 0.8, gainY: 1.2 })
  })

  it('truthfully reports X trim as unavailable in waveform modes', () => {
    expect(scopeSignalModeUsesXGain('left')).toBe(false)
    expect(scopeSignalModeUsesXGain('dualWaveform')).toBe(false)
    expect(scopeSignalModeUsesXGain('stereoXY')).toBe(true)
    expect(scopeSignalModeUsesXGain('monoDelayXY')).toBe(true)
  })

  it('treats Stability as a macro while preserving unequal algorithms', () => {
    const scope = normalizeSoundDrawingScopeState({
      ...DEFAULT_SOUND_DRAWING_SCOPE_STATE,
      trigger: { ...DEFAULT_SOUND_DRAWING_SCOPE_STATE.trigger, continuityWeight: 0.35, periodAssist: 0.8 },
    })
    const macro = resolveScopeStabilityMacro(scope)
    expect(macro).toMatchObject({ linked: false, mixed: true, label: 'Custom' })
    expect(scope.trigger.continuityWeight).toBe(0.35)
    expect(scope.trigger.periodAssist).toBe(0.8)
  })


  it('round-trips presets that intentionally author unequal trigger costs', () => {
    const preset = resolveScopePresetState('scope-slow-bass')
    expect(preset.trigger.continuityWeight).toBe(0.85)
    expect(preset.trigger.periodAssist).toBe(0.9)
    expect(resolveScopeStabilityMacro(preset)).toMatchObject({ linked: false, mixed: true, label: 'Custom' })
    expect(resolveScopePresetProvenance(preset).status).toBe('exact')
  })

  it('derives exact, modified, restored, and unknown legacy preset provenance', () => {
    const exact = resolveScopePresetState('scope-laboratory-green')
    expect(resolveScopePresetProvenance(exact).status).toBe('exact')
    const modified = { ...exact, beam: { ...exact.beam, coreWidthPx: exact.beam.coreWidthPx + 0.1 } }
    expect(resolveScopePresetProvenance(modified).status).toBe('modified')
    expect(resolveScopePresetProvenance(resolveScopePresetState('scope-laboratory-green')).status).toBe('exact')
    expect(resolveScopePresetProvenance({ ...exact, presetId: 'retired-scope-v0' }).status).toBe('unknownLegacy')
  })
})
