import { describe, expect, it } from 'vitest'
import { createSilentPixGridAudioFrame } from '../PixGridAudioRouting'
import { applyPixGridPresetSettings } from '../PixGridState'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { compilePixGridGroupMask, createPixGridGroup } from '../PixGridGroups'
import {
  PIX_GRID_PERCEPTUAL_HISTORY_LIMIT,
  PixGridPerceptualResponseTracker,
  resolvePixGridTruthfulReactivityStatus,
  type PixGridPerceptualResponseMetrics,
} from '../PixGridPerceptualResponse'
import type { PixGridLogicalFrame } from '../PixGridCompositor'
import type { PixGridUnifiedRuntimeDiagnostics } from '../PixGridUnifiedPerformanceRuntime'

function logicalFrame(value: number): PixGridLogicalFrame {
  const width = 8
  const height = 8
  const pixels = new Uint8Array(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = value
    pixels[offset + 1] = value
    pixels[offset + 2] = value
    pixels[offset + 3] = 255
  }
  return { width, height, pixels, visibleLayerCount: 1 }
}

function fullMask() {
  const runs = Array.from({ length: 8 }, (_, row) => [row, 0, 8] as const)
  return compilePixGridGroupMask(createPixGridGroup({
    name: 'Full audit mask',
    source: 'manualSelection',
    mask: { kind: 'runs', runs },
    runs,
  }), 8, 8)
}

function canonicalState() {
  const preset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
  return applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
}

function runtimeFixture(overrides: Partial<PixGridUnifiedRuntimeDiagnostics> = {}): PixGridUnifiedRuntimeDiagnostics {
  return {
    audioInputStatus: 'active',
    activeAssignmentCount: 1,
    fallbackRoutesActive: false,
    sceneTransitionActionCount: 0,
    autonomousAnimationCount: 0,
    routeActivity: [{
      routeId: 'audit-route',
      name: 'Audit route',
      source: 'kick',
      target: 'brightness',
      targetScope: 'group',
      targetId: 'audit-group',
      state: 'active',
      value: 1,
      effectiveAmount: 0.75,
      confidence: 1,
      usingFallback: false,
      envelopePhase: 'attack',
      affectedGroupIds: ['audit-group'],
      rawSourceValue: 1,
      adjustedSourceValue: 1,
      threshold: 0.2,
      curveOutput: 1,
      capabilityFallback: 'energy',
      bassReactivityApplied: false,
      compiledTargetCellCount: 64,
      visibleAffectedCellCount: 64,
      expectedPerceptible: true,
      suppressionReason: null,
      reason: 'active',
    }],
    ...overrides,
  } as PixGridUnifiedRuntimeDiagnostics
}

function visibleMetrics(overrides: Partial<PixGridPerceptualResponseMetrics> = {}): PixGridPerceptualResponseMetrics {
  return {
    sampleSequence: 2,
    changedVisibleCellCount: 32,
    changedVisibleCellPercentage: 0.5,
    meanBrightnessDelta: 48,
    peakBrightnessDelta: 72,
    meanPerceptualColorDistance: 48,
    localizedGroupChangePercentage: 0.5,
    currentAudioOnsetStrength: 1,
    recentOnsetToPixelCorrelation: 0.7,
    activeEnvelopeCount: 1,
    sceneTransitionActivity: 0,
    silenceBaselineDifference: 16,
    visibleCellCount: 64,
    affectedGroupCellCount: 64,
    ...overrides,
  }
}

describe('PixGrid live perceptual response tracking', () => {
  it('measures actual logical-frame changes and keeps correlation history bounded', () => {
    const tracker = new PixGridPerceptualResponseTracker()
    const mask = fullMask()
    const quiet = createSilentPixGridAudioFrame({ audioTime: 0, isPlaying: true, inputSource: 'analyser', analyserConnected: true })
    const baseline = tracker.sample({ frame: logicalFrame(0), audioFrame: quiet, activeGroupMasks: [mask], activeEnvelopeCount: 0, sceneTransitionActivity: 0, nowMs: 0 })!
    expect(baseline.changedVisibleCellCount).toBe(0)

    let value = 0
    let metrics = baseline
    for (let sample = 1; sample <= PIX_GRID_PERCEPTUAL_HISTORY_LIMIT + 2; sample += 1) {
      const onset = sample % 2 === 1
      if (onset) value = Math.min(250, value + 10)
      metrics = tracker.sample({
        frame: logicalFrame(value),
        audioFrame: createSilentPixGridAudioFrame({
          audioTime: sample * 0.1,
          isPlaying: true,
          kickHit: onset,
          sourceValues: { kick: onset ? 1 : 0, energy: onset ? 0.6 : 0.02 },
          inputSource: 'analyser',
          analyserConnected: true,
          analyserActive: true,
        }),
        activeGroupMasks: [mask],
        activeEnvelopeCount: onset ? 1 : 0,
        sceneTransitionActivity: 0,
        nowMs: sample * 100,
      })!
    }

    expect(metrics.sampleSequence).toBe(PIX_GRID_PERCEPTUAL_HISTORY_LIMIT + 3)
    expect(metrics.visibleCellCount).toBe(64)
    expect(metrics.affectedGroupCellCount).toBe(64)
    expect(metrics.recentOnsetToPixelCorrelation).toBeGreaterThan(0.5)
    expect(tracker.snapshot).toEqual(metrics)
  })

  it('reports canonical success only when migration, routes, targets, and visible pixels all agree', () => {
    const status = resolvePixGridTruthfulReactivityStatus({
      state: canonicalState(),
      runtime: runtimeFixture(),
      metrics: visibleMetrics(),
      validationErrorCount: 0,
    })
    expect(status.state).toBe('canonical-preset-fully-active')
    expect(status.tone).toBe('positive')
  })

  it('does not call an executing route music-reactive when its visible target is empty', () => {
    const status = resolvePixGridTruthfulReactivityStatus({
      state: canonicalState(),
      runtime: runtimeFixture({
        routeActivity: runtimeFixture().routeActivity.map(route => ({
          ...route,
          compiledTargetCellCount: 0,
          visibleAffectedCellCount: 0,
          expectedPerceptible: false,
        })),
      }),
      metrics: visibleMetrics({ changedVisibleCellCount: 0, changedVisibleCellPercentage: 0, meanPerceptualColorDistance: 0, localizedGroupChangePercentage: 0, silenceBaselineDifference: 0 }),
      validationErrorCount: 0,
    })
    expect(status.state).toBe('target-masks-empty')
    expect(status.tone).toBe('error')
  })
})
