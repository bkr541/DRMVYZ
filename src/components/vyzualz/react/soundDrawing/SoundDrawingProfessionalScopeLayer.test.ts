import { describe, expect, it } from 'vitest'
import {
  professionalScopeCaptureFrames,
  professionalScopeConfigurationIdentity,
  professionalScopeSignalIdentity,
  resolveProfessionalScopeLayerSettings,
} from './SoundDrawingProfessionalScopeLayer'

describe('authored Professional Scope layer contract', () => {
  it('normalizes presets and requests a real synchronized capture window', () => {
    const resolved = resolveProfessionalScopeLayerSettings({
      presetId: 'scope-stereo-phase',
      signalMode: 'stereoXY',
      trigger: { hysteresis: 0.04 },
    })
    expect(resolved.state.enabled).toBe(true)
    expect(resolved.state.signalMode).toBe('stereoXY')
    expect(resolved.state.trigger.hysteresis).toBe(0.04)
    expect(professionalScopeCaptureFrames(resolved.state, 48_000)).toBeGreaterThan(0)
  })

  it('keeps measurement and creative signal modes explicitly distinct', () => {
    expect(resolveProfessionalScopeLayerSettings({ signalMode: 'midSideXY' }).measurementSafe).toBe(true)
    expect(resolveProfessionalScopeLayerSettings({ signalMode: 'monoDelayXY' }).measurementSafe).toBe(false)
  })

  it('resets DSP for signal changes but not phosphor history for continuous presentation automation', () => {
    const base = resolveProfessionalScopeLayerSettings({ presetId: 'scope-stereo-phase' }).state
    const animated = {
      ...base,
      beam: { ...base.beam, coreWidthPx: base.beam.coreWidthPx + 0.4 },
      phosphor: { ...base.phosphor, persistenceSeconds: base.phosphor.persistenceSeconds + 0.3 },
    }
    expect(professionalScopeConfigurationIdentity(animated)).toBe(
      professionalScopeConfigurationIdentity(base),
    )
    const signalChanged = { ...base, signalMode: 'midSideXY' as const }
    expect(professionalScopeSignalIdentity(signalChanged)).not.toBe(professionalScopeSignalIdentity(base))
    expect(professionalScopeConfigurationIdentity(signalChanged)).not.toBe(
      professionalScopeConfigurationIdentity(base),
    )
  })
})
