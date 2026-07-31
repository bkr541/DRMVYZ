import { describe, expect, it } from 'vitest'
import { MultiBandAnalyzer, type BandAnalysisResult } from '../../../../../features/musicIntelligence/bandAnalysis'
import { RhythmAnalyzer, type RhythmAnalysisResult } from '../../../../../features/musicIntelligence/rhythmAnalysis'
import type { ReactPreset } from '../../ReactTypes'
import { PixGridReactionRuntime, createSilentPixGridAudioFrame } from '../PixGridAudioRouting'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  PIX_GRID_REALISTIC_LIVE_SOURCE_PROFILES,
  liveProfile,
} from '../PixGridPerceptualCalibration'
import { measurePixGridPerceptualDifference, pearsonCorrelation } from '../PixGridPerceptualMetrics'
import { PIX_GRID_PERFORMANCE_PROGRAMS } from '../PixGridPerformancePrograms'
import { PIX_GRID_MUSIC_REACTIVE_PRESETS, PIX_GRID_PRESETS } from '../PixGridPresets'
import { auditPixGridPresetRenderedReactivity } from '../PixGridReactivityAudit'
import { applyPixGridRuntimeControls } from '../PixGridRuntimeControls'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'
import {
  PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
  PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
  PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION,
  type PixGridAudioFrame,
  type PixGridReactionAssignment,
} from '../PixGridTypes'
import { normalizePixGridReactionAssignment, normalizePixGridState } from '../PixGridValidation'
import {
  createPixGridPerceptualAnalyserFixture,
  type PixGridPerceptualAudioFixtureKind,
} from './__fixtures__/PixGridPerceptualAudioFixture'

interface PixGridFixtureAnalysis {
  bands: BandAnalysisResult
  rhythm: RhythmAnalysisResult
}

function analyseFixture(kind: PixGridPerceptualAudioFixtureKind): PixGridFixtureAnalysis {
  const fixture = createPixGridPerceptualAnalyserFixture(kind)
  const bandAnalyzer = new MultiBandAnalyzer()
  const rhythmAnalyzer = new RhythmAnalyzer()
  const analyze = (freqBuf: Uint8Array<ArrayBuffer>) => {
    const bands = bandAnalyzer.analyze(freqBuf, fixture.sampleRate)
    const rhythm = rhythmAnalyzer.analyze(freqBuf, bands, true)
    return { bands, rhythm }
  }
  analyze(fixture.calibration.freqBuf)
  for (const frame of fixture.baseline) analyze(frame.freqBuf)
  let result = analyze(fixture.event[0]!.freqBuf)
  for (const frame of fixture.event.slice(1)) result = analyze(frame.freqBuf)
  return result
}

function stateFor(presetId: string) {
  const preset = PIX_GRID_PRESETS.find(candidate => candidate.id === presetId)!
  const state = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
  const selectedSceneId = preset.sectionMappings.find(mapping => mapping.sectionType === 'drop')?.sceneId ?? state.selectedSceneId
  return normalizePixGridState({ ...state, quality: 'low', selectedSceneId })
}

function legacyPresetStateForMigration(preset: ReactPreset) {
  const settings = preset.pixGridSettings!
  const stripCalibration = (assignment: PixGridReactionAssignment): PixGridReactionAssignment => {
    const { perceptualGain: _gain, minimumEffectiveStrength: _floor, maskSizeCompensation: _mask, ...legacy } = assignment
    return legacy
  }
  const legacySettings = {
    ...settings,
    authoredConfigurationVersion: 6,
    audioAssignments: settings.audioAssignments?.map(stripCalibration),
    groups: settings.groups?.map(group => ({ ...group, reactions: group.reactions.map(stripCalibration) })),
  }
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, legacySettings)
  return {
    ...applied,
    configuration: {
      ...applied.configuration,
      audioRouteConfigurationVersion: 3,
      performanceProgramConfigurationVersion: 2,
      musicReactiveConfigurationVersion: 3,
      canonicalMigrationCompleted: false,
    },
  }
}

function pixGridFrameFromMusicIntelligence(frame: PixGridFixtureAnalysis, event: PixGridPerceptualAudioFixtureKind): PixGridAudioFrame {
  const sourceValues = {
    sub: frame.bands.sub.normalized,
    bass: frame.bands.bass.normalized,
    lowMid: frame.bands.lowMid.normalized,
    mid: frame.bands.mid.normalized,
    high: frame.bands.high.normalized,
    air: frame.bands.air.normalized,
    volume: frame.bands.volume,
    energy: Math.min(1, frame.bands.volume * 2.4),
    spectralFlux: frame.rhythm.spectralFlux,
    kick: event === 'kick' ? frame.rhythm.kickStrength : 0,
    snare: event === 'snare' ? frame.rhythm.snareStrength : 0,
    hat: event === 'hat' ? frame.rhythm.hatStrength : 0,
    transient: frame.rhythm.transient,
    beat: event === 'quiet' || event === 'bass' ? 0 : 1,
    downbeat: event === 'kick' ? 1 : 0,
  }
  return applyPixGridRuntimeControls(createSilentPixGridAudioFrame({
    audioTime: 40,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    sectionType: 'drop',
    sectionPhase: 'body',
    sectionOccurrence: 1,
    dropOccurrence: 1,
    beatIndex: 80,
    barIndex: 20,
    phraseIndex: 5,
    sourceValues,
    capabilities: {
      sub: true, bass: true, lowMid: true, mid: true, high: true, air: true,
      volume: true, energy: true, spectralFlux: true, kick: true, snare: true,
      hat: true, transient: true, beat: true, downbeat: true,
      buildProgress: false, semanticMoment: false, vocalEnergy: false,
    },
    confidence: Object.fromEntries(Object.keys(sourceValues).map(source => [source, 0.82])),
    eventIdentities: event === 'quiet' || event === 'bass' ? {} : { [event]: `fixture:${event}:1`, beat: `fixture:beat:1` },
    trackIdentity: 'pix-grid-perceptual-fixture',
  }), { bassReactivity: 1, motion: 0 })
}

describe('PixGrid perceptual Audio Intelligence contract', () => {
  it('defines realistic live profiles rather than maximum-strength-only fixtures', () => {
    expect(liveProfile('normal-kick').values.kick).toBeGreaterThanOrEqual(0.5)
    expect(liveProfile('normal-kick').values.kick).toBeLessThan(0.8)
    expect(liveProfile('normal-snare').values.snare).toBeLessThan(0.8)
    expect(liveProfile('medium-bass').values.bass).toBeGreaterThan(0.3)
    expect(liveProfile('medium-bass').values.bass).toBeLessThan(0.6)
    expect(liveProfile('low-energy').values.energy).toBeLessThan(0.25)
    expect(liveProfile('partial-confidence').confidence).toBeLessThan(0.5)
    expect(liveProfile('live-analyser-only').capabilities).toBe('live-only')
    expect(PIX_GRID_REALISTIC_LIVE_SOURCE_PROFILES.some(profile => profile.capabilities === 'live-only')).toBe(true)
  })

  it('migrates untouched built-in routes to the perceptual configuration versions', () => {
    const preset = PIX_GRID_PRESETS[0]
    const migrated = migratePixGridState(legacyPresetStateForMigration(preset), preset)
    const routes = [...migrated.audioAssignments, ...migrated.groups.flatMap(group => group.reactions)]
    expect(migrated.configuration.audioRouteConfigurationVersion).toBe(PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION)
    expect(migrated.configuration.performanceProgramConfigurationVersion).toBe(PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION)
    expect(migrated.configuration.musicReactiveConfigurationVersion).toBe(PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION)
    expect(routes.some(route => (route.perceptualGain ?? 1) > 1)).toBe(true)
    expect(routes.some(route => (route.minimumEffectiveStrength ?? 0) > 0)).toBe(true)
  })

  it('upgrades unchanged canonical routes without rewriting a customized route', () => {
    const preset = PIX_GRID_PRESETS[0]
    const legacy = legacyPresetStateForMigration(preset)
    const customizedRouteId = legacy.groups[0]!.reactions[0]!.id
    const customizedAmount = 1.234
    const customized = {
      ...legacy,
      groups: legacy.groups.map((group, groupIndex) => groupIndex === 0
        ? { ...group, reactions: group.reactions.map((route, routeIndex) => routeIndex === 0 ? { ...route, amount: customizedAmount } : route) }
        : group),
      configuration: { ...legacy.configuration, userCustomized: true },
    }

    const migrated = migratePixGridState(customized, preset)
    const routes = [...migrated.audioAssignments, ...migrated.groups.flatMap(group => group.reactions)]
    const customizedRoute = routes.find(route => route.id === customizedRouteId)!
    expect(customizedRoute.amount).toBe(customizedAmount)
    expect(customizedRoute.perceptualGain).toBe(1)
    expect(customizedRoute.minimumEffectiveStrength).toBe(0)
    expect(routes.some(route => route.id !== customizedRouteId && (route.perceptualGain ?? 1) > 1)).toBe(true)
  })

  it('keeps legacy and user-authored routes neutral unless calibration is explicit', () => {
    const normalized = normalizePixGridReactionAssignment({
      id: 'custom-route',
      name: 'Custom route',
      enabled: true,
      source: 'kick',
      target: 'brightness',
      targetScope: 'group',
      amount: 0.4,
    }, 0)

    expect(normalized).not.toBeNull()
    expect(normalized?.perceptualGain).toBe(1)
    expect(normalized?.minimumEffectiveStrength).toBe(0)
    expect(normalized?.maskSizeCompensation).toBe(0)
  })

  it('calibrates every built-in route with bounded perceptual gain and non-gated event decay', () => {
    for (const program of PIX_GRID_PERFORMANCE_PROGRAMS) {
      for (const route of program.continuousRoutes) {
        expect(route.inputRange).toBeDefined()
        expect(route.perceptualGain).toBeGreaterThanOrEqual(1)
        expect(route.minimumEffectiveStrength).toBeGreaterThan(0)
        expect(route.maskSizeCompensation).toBeGreaterThanOrEqual(0)
      }
      for (const route of program.eventRoutes) {
        expect(route.curve).not.toBe('gate')
        expect(route.envelope.hold + route.envelope.release).toBeGreaterThanOrEqual(route.event === 'hat' ? 0.08 : 0.18)
        expect(route.perceptualGain).toBeGreaterThanOrEqual(1)
        expect(route.minimumEffectiveStrength).toBeGreaterThan(0)
      }
    }
  })

  it.each(PIX_GRID_MUSIC_REACTIVE_PRESETS)('$name passes realistic perceptual-output audit minimums', (preset: ReactPreset) => {
    const report = auditPixGridPresetRenderedReactivity(preset, stateFor(preset.id))
    expect(report.passed).toBe(true)
    expect(report.checks.find(check => check.id === 'critical-routes-clear-perceptual-floor')).toMatchObject({ passed: true })
    expect(report.checks.find(check => check.id === 'kick-perceptual-minimum')).toMatchObject({ passed: true })
    expect(report.checks.find(check => check.id === 'snare-perceptual-minimum')).toMatchObject({ passed: true })
    expect(report.checks.find(check => check.id === 'bass-dynamic-range')).toMatchObject({ passed: true })
    expect(report.checks.find(check => check.id === 'bass-reactivity-control')).toMatchObject({ passed: true })
    expect(report.checks.find(check => check.id === 'deterministic-repeat')).toMatchObject({ passed: true })
    expect(report.acceptanceMatrix.filter(row => row.category === 'music').every(row => row.passed)).toBe(true)
  })

  it('runs the repository band and rhythm analyser path and produces material localized pixels', () => {
    const kickAnalysis = analyseFixture('kick')
    const snareAnalysis = analyseFixture('snare')
    const hatAnalysis = analyseFixture('hat')
    const bassAnalysis = analyseFixture('bass')

    expect(kickAnalysis.rhythm.kickHit).toBe(true)
    expect(kickAnalysis.rhythm.kickStrength).toBeGreaterThan(0.5)
    expect(kickAnalysis.rhythm.kickStrength).toBeLessThan(0.8)
    expect(snareAnalysis.rhythm.snareHit).toBe(true)
    expect(snareAnalysis.rhythm.snareStrength).toBeGreaterThan(0.55)
    expect(snareAnalysis.rhythm.snareStrength).toBeLessThan(0.8)
    expect(hatAnalysis.rhythm.hatHit).toBe(true)
    expect(bassAnalysis.bands.bass.normalized).toBeGreaterThan(0.25)

    for (const preset of PIX_GRID_MUSIC_REACTIVE_PRESETS) {
      const state = stateFor(preset.id)
      const quietFrame = pixGridFrameFromMusicIntelligence(analyseFixture('bass'), 'quiet')
      quietFrame.sourceValues = { ...quietFrame.sourceValues, sub: 0.01, bass: 0.01, energy: 0.02, volume: 0.01 }
      const quiet = composePixGridLogicalFrame(preset, state, quietFrame, undefined, null, new PixGridReactionRuntime())
      const kick = composePixGridLogicalFrame(preset, state, pixGridFrameFromMusicIntelligence(kickAnalysis, 'kick'), undefined, null, new PixGridReactionRuntime())
      const snare = composePixGridLogicalFrame(preset, state, pixGridFrameFromMusicIntelligence(snareAnalysis, 'snare'), undefined, null, new PixGridReactionRuntime())
      const hat = composePixGridLogicalFrame(preset, state, pixGridFrameFromMusicIntelligence(hatAnalysis, 'hat'), undefined, null, new PixGridReactionRuntime())
      const kickMetrics = measurePixGridPerceptualDifference(quiet, kick)
      const snareMetrics = measurePixGridPerceptualDifference(quiet, snare)
      const hatMetrics = measurePixGridPerceptualDifference(quiet, hat)

      expect(kickMetrics.changedCellRatio).toBeGreaterThanOrEqual(0.15)
      expect(kickMetrics.meanMaterialDelta).toBeGreaterThan(45)
      expect(kickMetrics.meanLuminanceDelta).toBeGreaterThan(30)
      expect(snareMetrics.changedCellRatio).toBeGreaterThanOrEqual(0.15)
      expect(snareMetrics.meanMaterialDelta).toBeGreaterThan(45)
      expect(snareMetrics.meanLuminanceDelta).toBeGreaterThan(30)
      expect(hatMetrics.changedCellRatio).toBeGreaterThanOrEqual(0.02)
      expect(hatMetrics.changedCellRatio).toBeLessThan(kickMetrics.changedCellRatio)
      expect(kickMetrics.centerChangedRatio + kickMetrics.lowerChangedRatio)
        .not.toBeCloseTo(snareMetrics.centerChangedRatio + snareMetrics.lowerChangedRatio, 2)
    }
  })

  it.each(PIX_GRID_MUSIC_REACTIVE_PRESETS)('$name keeps a normal snare readable beyond 100 ms and clears the envelope', (preset: ReactPreset) => {
    const state = stateFor(preset.id)
    const frame = (audioTime: number, snare: number, identity?: string): PixGridAudioFrame => applyPixGridRuntimeControls(
      createSilentPixGridAudioFrame({
        audioTime,
        deltaTimeSec: 1 / 60,
        isPlaying: true,
        sectionType: 'drop',
        sectionPhase: 'body',
        sectionOccurrence: 1,
        dropOccurrence: 1,
        beatIndex: 80,
        barIndex: 20,
        phraseIndex: 5,
        sourceValues: { bass: 0.18, energy: 0.36, snare },
        capabilities: { bass: true, energy: true, snare: true },
        confidence: { bass: 0.82, energy: 0.82, snare: 0.82 },
        eventIdentities: identity ? { snare: identity } : {},
        trackIdentity: 'pix-grid-envelope-fixture',
      }),
      { bassReactivity: 1, motion: 0 },
    )

    const runtime = new PixGridReactionRuntime()
    composePixGridLogicalFrame(preset, state, frame(40, 0.66, 'snare:1'), undefined, null, runtime)
    const held = composePixGridLogicalFrame(
      preset,
      state,
      { ...frame(40.12, 0), deltaTimeSec: 0.12 },
      undefined,
      null,
      runtime,
    )
    const heldBaseline = composePixGridLogicalFrame(preset, state, frame(40.12, 0), undefined, null, new PixGridReactionRuntime())
    const expired = composePixGridLogicalFrame(
      preset,
      state,
      { ...frame(40.55, 0), deltaTimeSec: 0.43 },
      undefined,
      null,
      runtime,
    )
    const expiredBaseline = composePixGridLogicalFrame(preset, state, frame(40.55, 0), undefined, null, new PixGridReactionRuntime())

    expect(measurePixGridPerceptualDifference(heldBaseline, held).changedCellRatio).toBeGreaterThanOrEqual(0.01)
    expect(measurePixGridPerceptualDifference(expiredBaseline, expired).changedCellRatio).toBe(0)
  })

  it('correlates ordinary kick onset strength with material pixel output', () => {
    const preset = PIX_GRID_PRESETS[0]
    const state = stateFor(preset.id)
    const strengths = [0, 0.42, 0.58, 0.72, 0.36, 0.8, 0.5, 0]
    const pixelResponse = strengths.map((strength, index) => {
      const base = applyPixGridRuntimeControls(createSilentPixGridAudioFrame({
        audioTime: 48 + index / 60,
        deltaTimeSec: 1 / 60,
        isPlaying: true,
        sectionType: 'drop',
        beatIndex: 96 + index,
        sourceValues: { bass: 0.28, energy: 0.45, kick: 0, beat: 0 },
        eventIdentities: {},
      }), { bassReactivity: 1, motion: 0 })
      const event = { ...base, sourceValues: { ...base.sourceValues, kick: strength, beat: strength > 0 ? 1 : 0 }, eventIdentities: strength > 0 ? { kick: `correlation:${index}`, beat: `correlation-beat:${index}` } : {} }
      const quiet = composePixGridLogicalFrame(preset, state, base, undefined, null, new PixGridReactionRuntime())
      const active = composePixGridLogicalFrame(preset, state, event, undefined, null, new PixGridReactionRuntime())
      return measurePixGridPerceptualDifference(quiet, active).changedCellRatio
    })
    expect(pearsonCorrelation(strengths, pixelResponse)).toBeGreaterThan(0.55)
  })
})
