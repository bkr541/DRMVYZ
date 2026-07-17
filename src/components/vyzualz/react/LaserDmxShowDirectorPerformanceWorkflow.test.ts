import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from './ReactTypes'
import {
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS,
  type LaserDmxShowDirectorPerformancePresetDefinition,
} from './LaserDmxShowDirectorPerformancePresets'
import { createDefaultLaserDmxShowDirectorPerformanceState } from './LaserDmxShowDirectorPerformanceProgram'
import { applyShowDirectorPerformanceGlobalOverrides } from './renderers/LaserDmxRenderer'
import {
  clearLaserDmxShowDirectorPerformanceRuntimeStatus,
  getLaserDmxShowDirectorPerformanceRuntimeStatus,
  publishLaserDmxShowDirectorPerformanceRuntimeStatus,
  subscribeLaserDmxShowDirectorPerformanceRuntimeStatus,
} from './LaserDmxShowDirectorPerformanceRuntimeStatus'

function syntheticPreset(): LaserDmxShowDirectorPerformancePresetDefinition {
  return {
    id: 'synthetic-show',
    name: 'Synthetic Show',
    description: 'Test-only performance show.',
    genreTags: ['test'],
    behaviorTags: ['deterministic'],
    supportedSectionRoles: ['drop'],
    musicIntelligenceCapabilities: ['Beat Grid', 'Sections'],
    fixtureCount: 1,
    approximatePeakBeamDemand: 9,
    createRig: createId => {
      const fixture = createDefaultLaserDmxShowDirectorFixture('laser', createId(), 0)
      return normalizeLaserDmxShowDirectorState({
        ...createDefaultLaserDmxShowDirectorState(),
        sourceTemplateId: null,
        fixtures: [{ ...fixture, semanticKey: 'hero-laser', brightness: 0.7 }],
      })
    },
    createProgram: () => ({
      schemaVersion: 1,
      id: 'synthetic-program',
      name: 'Synthetic Program',
      deterministicSeed: 123,
      tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
      scenes: [{
        id: 'drop', label: 'Drop', enabled: true, section: { types: ['drop'] },
        address: { fixtureSemanticKeys: ['hero-laser'] }, fixture: { brightness: 1 },
      }],
    }),
  }
}

describe('Show Director performance preset workflow', () => {
  it('publishes all twenty finished shows through the canonical registry', () => {
    expect(LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.map(preset => preset.id)).toEqual([
      'prism-cathedral',
      'cardinal-fan-reactor',
      'cyan-mirror-cage',
      'vocal-eclipse-exchange',
      'emerald-tunnel-relay',
      'white-vector-interlock',
      'aurora-canopy-drift',
      'chromatic-chapter-stage',
      'prismatic-pulse-matrix',
      'spectral-ribbon-singularity',
      'crimson-apex-protocol',
      'violet-hourglass-orbit',
      'scarlet-origami-lattice',
      'small-club-rig-performance',
      'festival-front-beams-performance',
      'dubstep-drop-lasers-performance',
      'led-bar-grid-performance',
      'moving-head-sweep-performance',
      'strobe-blinder-hits-performance',
      'haze-co2-drops-performance',
    ])
    expect(LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.map(preset => preset.fixtureCount)).toEqual([12, 16, 16, 10, 13, 13, 15, 18, 19, 22, 19, 22, 19, 9, 8, 9, 10, 5, 6, 8])
  })

  it('loads rig and program atomically, preserves canvas preferences, and reloads the pristine built-in definition', () => {
    const initialRig = normalizeLaserDmxShowDirectorState({
      ...createDefaultLaserDmxShowDirectorState(),
      settings: {
        ...createDefaultLaserDmxShowDirectorState().settings,
        showGrid: false,
        zoom: 1.65,
        presentationMode: 'capture',
        rendererMode: 'webgl',
        webglQuality: 'medium',
        webglRenderScale: 0.75,
      },
    })
    useReactStore.setState({
      activeReactEngineId: 'canvas',
      laserDmxWorkspaceMode: 'beamMatrix',
      laserDmxBeamMatrixAuthoringMode: 'manual',
      laserDmxShowDirector: initialRig,
      laserDmxShowDirectorPerformance: createDefaultLaserDmxShowDirectorPerformanceState(),
      laserDmxShowDirectorUndoStack: [],
      laserDmxShowDirectorRedoStack: [],
      laserDmxShowDirectorHistoryTransaction: null,
    })

    const preset = syntheticPreset()
    expect(useReactStore.getState().applyLaserDmxShowDirectorPerformancePreset(preset)).toBe(true)
    let state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('laserDmx')
    expect(state.laserDmxBeamMatrixAuthoringMode).toBe('showDirector')
    expect(state.laserDmxShowDirector.fixtures[0]?.semanticKey).toBe('hero-laser')
    expect(state.laserDmxShowDirector.settings.showGrid).toBe(false)
    expect(state.laserDmxShowDirector.settings.zoom).toBe(1.65)
    expect(state.laserDmxShowDirector.settings.presentationMode).toBe('capture')
    expect(state.laserDmxShowDirector.settings.rendererMode).toBe('webgl')
    expect(state.laserDmxShowDirector.settings.webglQuality).toBe('medium')
    expect(state.laserDmxShowDirector.settings.webglRenderScale).toBe(0.75)
    expect(state.laserDmxShowDirectorPerformance).toMatchObject({
      activePresetId: 'synthetic-show', activeProgramId: 'synthetic-program', enabled: true, presetDirty: false,
    })

    const fixtureId = state.laserDmxShowDirector.fixtures[0]!.id
    state.updateLaserDmxShowDirectorFixture(fixtureId, { brightness: 0.2 })
    state = useReactStore.getState()
    expect(state.laserDmxShowDirectorPerformance.presetDirty).toBe(true)
    expect(state.laserDmxShowDirector.fixtures[0]?.brightness).toBe(0.2)

    state.updateLaserDmxShowDirectorFixture(fixtureId, { optics: { primitiveType: 'layeredFan', opticalSoftness: 0.22 } })
    state.updateLaserDmxShowDirectorFixture(fixtureId, { optics: { rayCount: 9 } })
    state = useReactStore.getState()
    expect(state.laserDmxShowDirector.fixtures[0]?.optics).toMatchObject({
      primitiveType: 'layeredFan',
      opticalSoftness: 0.22,
      rayCount: 9,
    })

    expect(state.applyLaserDmxShowDirectorPerformancePreset(preset)).toBe(true)
    state = useReactStore.getState()
    expect(state.laserDmxShowDirector.fixtures[0]?.brightness).toBe(0.7)
    expect(state.laserDmxShowDirectorPerformance.presetDirty).toBe(false)
    expect(state.laserDmxShowDirectorUndoStack).toEqual([])
  })

  it('disables the program without deleting or rewriting the underlying authored rig', () => {
    const preset = syntheticPreset()
    useReactStore.getState().applyLaserDmxShowDirectorPerformancePreset(preset)
    const before = JSON.stringify(useReactStore.getState().laserDmxShowDirector)
    useReactStore.getState().setLaserDmxShowDirectorPerformanceEnabled(false)
    const state = useReactStore.getState()
    expect(state.laserDmxShowDirectorPerformance.enabled).toBe(false)
    expect(JSON.stringify(state.laserDmxShowDirector)).toBe(before)
    expect(state.laserDmxShowDirectorPerformance.activeProgramDefinition?.id).toBe('synthetic-program')
  })

  it('keeps authored/global blackout authoritative while applying runtime output overrides', () => {
    const matrix = createDefaultLaserDmxBeamMatrixSettings()
    const authoredBlackout = { ...matrix, output: { ...matrix.output, blackout: true } }
    expect(applyShowDirectorPerformanceGlobalOverrides(authoredBlackout, { blackout: false }).output.blackout).toBe(true)
    expect(applyShowDirectorPerformanceGlobalOverrides(matrix, { blackout: true }).output.blackout).toBe(true)
    expect(applyShowDirectorPerformanceGlobalOverrides(matrix, { dimmer: 0.5 }).output.masterDimmer).toBeCloseTo(matrix.output.masterDimmer * 0.5)
  })

  it('publishes runtime status only when its boundary snapshot changes', () => {
    clearLaserDmxShowDirectorPerformanceRuntimeStatus()
    let calls = 0
    const unsubscribe = subscribeLaserDmxShowDirectorPerformanceRuntimeStatus(() => { calls += 1 })
    const resolution = {
      showDirector: createDefaultLaserDmxShowDirectorState(), activeSceneId: 'scene', activeSceneLabel: 'Scene', activeVariation: null,
      fourBarVariation: 'four-a', eightBarRecruitmentStage: 1, currentSection: 'drop' as const, currentSectionOccurrence: 1,
      activeFixtureKeys: ['hero'], activeGroupKeys: ['group'], estimatedBeamDemand: 10, boundedBeamDemand: 10,
      requestedGlobalOutputOverrides: {}, fixturePriorityById: {}, deterministicIdentity: 'frame-a',
      diagnostics: { analysisReady: true, analysisStatus: 'ready' as const, missingCapabilities: [], missingFixtureKeys: [], missingGroupKeys: [], malformedMutationIds: [], fallbackReason: null, suppressionReason: null, beamBudgetWarning: null },
    }
    publishLaserDmxShowDirectorPerformanceRuntimeStatus('Show', resolution)
    publishLaserDmxShowDirectorPerformanceRuntimeStatus('Show', { ...resolution, deterministicIdentity: 'frame-b' })
    expect(calls).toBe(1)
    expect(getLaserDmxShowDirectorPerformanceRuntimeStatus().scene).toBe('Scene')
    unsubscribe()
  })
  it('clears an incompatible Performance Show when a static Rig Layout is loaded', () => {
    const performancePreset = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS[0]!
    expect(useReactStore.getState().applyLaserDmxShowDirectorPerformancePreset(performancePreset)).toBe(true)
    expect(useReactStore.getState().laserDmxShowDirectorPerformance.enabled).toBe(true)

    expect(useReactStore.getState().applyLaserDmxShowDirectorTemplate('small-club-rig')).toBe(true)
    const state = useReactStore.getState()
    expect(state.laserDmxShowDirector.sourceTemplateId).toBe('small-club-rig')
    expect(state.laserDmxShowDirectorPerformance.enabled).toBe(false)
    expect(state.laserDmxShowDirectorPerformance.activePresetId).toBeNull()
    expect(state.laserDmxShowDirectorPerformance.activeProgramId).toBeNull()
    expect(state.laserDmxShowDirectorPerformance.activeProgramDefinition).toBeNull()
  })

  it('publishes partial analysis state and the missing optional capabilities', () => {
    clearLaserDmxShowDirectorPerformanceRuntimeStatus()
    const resolution = {
      showDirector: createDefaultLaserDmxShowDirectorState(), activeSceneId: 'scene', activeSceneLabel: 'Scene', activeVariation: null,
      fourBarVariation: null, eightBarRecruitmentStage: 1, currentSection: 'verse' as const, currentSectionOccurrence: 1,
      activeFixtureKeys: ['hero'], activeGroupKeys: ['group'], estimatedBeamDemand: 8, boundedBeamDemand: 8,
      requestedGlobalOutputOverrides: {}, fixturePriorityById: {}, deterministicIdentity: 'partial',
      diagnostics: { analysisReady: true, analysisStatus: 'partial' as const, missingCapabilities: ['Lyrics', 'Stem Curves'], missingFixtureKeys: [], missingGroupKeys: [], malformedMutationIds: [], fallbackReason: null, suppressionReason: null, beamBudgetWarning: null },
    }
    publishLaserDmxShowDirectorPerformanceRuntimeStatus('Show', resolution)
    const status = getLaserDmxShowDirectorPerformanceRuntimeStatus()
    expect(status.analysisStatus).toBe('partial')
    expect(status.missingCapabilities).toEqual(['Lyrics', 'Stem Curves'])
  })

})

describe('Show Director performance UI architecture', () => {
  const presetsSource = readFileSync(new URL('./ReactPresetsPanel.tsx', import.meta.url), 'utf8')
  const controlsSource = readFileSync(new URL('./LaserDmxShowDirectorControls.tsx', import.meta.url), 'utf8')
  const rendererSource = readFileSync(new URL('./renderers/LaserDmxRenderer.ts', import.meta.url), 'utf8')
  const thumbnailSource = readFileSync(new URL('./LaserDmxPresetThumbnail.tsx', import.meta.url), 'utf8')

  it('separates Performance Shows, Rig Layouts, and Matrix looks while reusing canonical preset cards', () => {
    expect(presetsSource).toContain('Show Director Performance Shows')
    expect(presetsSource).toContain('Show Director Rig Layouts')
    expect(presetsSource).toContain('Beam Matrix Presets')
    expect(presetsSource).toContain('<ReactPresetCard')
    expect(presetsSource).not.toContain('function PerformancePresetCard')
  })

  it('reuses canonical control rows and exposes missing-analysis fallback status', () => {
    expect(controlsSource).toContain('ToggleRow')
    expect(controlsSource).toContain('SliderRow')
    expect(controlsSource).toContain('SelectRow')
    expect(controlsSource).toContain('NumberInputRow')
    expect(controlsSource).toContain("status.analysisStatus === 'ready'")
    expect(controlsSource).toContain('Optional intelligence unavailable')
    expect(controlsSource).toContain('data-performance-runtime-status')
  })

  it('does not persist per-frame runtime state or create production thumbnail loops', () => {
    expect(rendererSource).toContain('resolveLaserDmxShowDirectorPerformance')
    expect(rendererSource).toContain('publishLaserDmxShowDirectorPerformanceRuntimeStatus')
    expect(rendererSource).not.toContain('useReactStore.setState')
    expect(thumbnailSource).toContain('Static representative rendering only')
    expect(thumbnailSource).not.toContain('requestAnimationFrame')
    expect(thumbnailSource).not.toContain('AudioFeatureBus')
  })
})
