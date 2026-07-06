import { beforeEach, describe, expect, it } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import {
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_REACT_PRESETS,
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
} from '../ReactTypes'
import type {
  LaserDmxBeamMatrixCue,
  LaserDmxMatrixBeam,
  ReactPreset,
  ReactPresetAutomationCue,
  ReactTrackSection,
  SoundDrawingClip,
  SoundDrawingLayer,
} from '../ReactTypes'

const manualSection = {
  id: 'manual-1',
  source: 'manual',
  label: 'Custom Drop',
  type: 'drop',
  startSec: 10,
  endSec: 20,
  intensity: 1,
  confidence: 1,
} as unknown as ReactTrackSection

const automationCue = {
  id: 'automation-1',
  timeSec: 10,
  presetId: DEFAULT_REACT_PRESETS[0].id,
} as ReactPresetAutomationCue

const soundLayer = {
  id: 'layer-1',
  name: 'Logo',
  enabled: true,
} as unknown as SoundDrawingLayer

const soundClip = {
  id: 'clip-1',
  layerId: soundLayer.id,
  startSec: 10,
  endSec: 20,
  zIndex: 0,
} as unknown as SoundDrawingClip

const matrixBeam = {
  id: 'beam-1',
  name: 'Authored Beam',
  enabled: true,
  groupId: 'grp-bass',
} as unknown as LaserDmxMatrixBeam

const matrixCue = {
  id: 'matrix-cue-1',
  name: 'Drop Beam',
  enabled: true,
  targetType: 'beam',
  targetId: matrixBeam.id,
  timingMode: 'musical',
  action: 'gate',
  startBar: 9,
} as LaserDmxBeamMatrixCue

function seedAuthoredState() {
  const customPreset: ReactPreset = {
    ...DEFAULT_REACT_PRESETS[0],
    id: 'custom-preset',
    name: 'Custom Preset',
  }
  const spatial = createDefaultLaserDmxSettings()
  spatial.fixtures = spatial.fixtures.map((fixture, index) =>
    index === 0 ? { ...fixture, name: 'Authored Fixture' } : fixture,
  )
  const matrix = createDefaultLaserDmxBeamMatrixSettings()
  matrix.beams = [matrixBeam]
  matrix.cues = [matrixCue]
  matrix.selectedBeamIds = [matrixBeam.id]
  matrix.editor = { ...matrix.editor, guidesVisible: false, overscanAmount: 0.33 }
  matrix.output = { ...matrix.output, masterDimmer: 0.12 }
  matrix.fog = { ...matrix.fog, enabled: true, density: 0.92 }

  useReactStore.setState({
    activeReactPresetId: customPreset.id,
    activeReactEngineId: 'laserDmx',
    reactPresets: [...DEFAULT_REACT_PRESETS, customPreset],
    manualTrackSectionsByTrackId: { 'track-1': [manualSection] },
    selectedSectionId: manualSection.id,
    selectedSectionByTrackId: { 'track-1': manualSection.id },
    suppressedAutoSectionsByTrackId: { 'track-1': ['auto-1'] },
    presetAutomationCuesByTrackId: { 'track-1': [automationCue] },
    soundDrawingLayersByTrackId: { 'track-1': [soundLayer] },
    soundDrawingClipsByTrackId: { 'track-1': [soundClip] },
    performancePads: DEFAULT_PERFORMANCE_PADS.map((pad, index) =>
      index === 0 ? { ...pad, label: 'Edited Pad', transitionTimeMs: 1337 } : pad,
    ),
    activePadId: DEFAULT_PERFORMANCE_PADS[0].id,
    oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, pathScale: 1.31, sourceType: 'text', text: 'AUTHORED' },
    laserDmxSettings: spatial,
    laserDmxWorkspaceMode: 'beamMatrix',
    laserDmxBeamMatrix: matrix,
    activeLaserDmxBeamMatrixPresetId: 'matrix-rising-crown',
    laserDmxBeamMatrixPresetDirty: true,
    reactIntensity: 0.11,
    reactMotion: 0.22,
    reactGlow: 0.33,
    reactBassReactivity: 0.44,
    reactTrailDecay: 0.55,
    reactFogDensity: 0.66,
    reactParticleDensity: 0.77,
  })
}

beforeEach(() => {
  useReactStore.setState({
    activeReactPresetId: 'preset-dream-gate',
    activeReactEngineId: 'cinematicPortal',
    reactPresets: DEFAULT_REACT_PRESETS,
    manualTrackSectionsByTrackId: {},
    selectedSectionId: null,
    selectedSectionByTrackId: {},
    suppressedAutoSectionsByTrackId: {},
    presetAutomationCuesByTrackId: {},
    soundDrawingLayersByTrackId: {},
    soundDrawingClipsByTrackId: {},
    performancePads: DEFAULT_PERFORMANCE_PADS,
    activePadId: null,
    oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS },
    laserDmxSettings: createDefaultLaserDmxSettings(),
    laserDmxWorkspaceMode: 'beamMatrix',
    laserDmxBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    activeLaserDmxBeamMatrixPresetId: null,
    laserDmxBeamMatrixPresetDirty: false,
  })
})

describe('scoped React reset actions', () => {
  it('resets current Beam Matrix live settings while preserving authored program content', () => {
    seedAuthoredState()
    const before = useReactStore.getState()
    const authored = {
      reactPresets: before.reactPresets,
      manual: before.manualTrackSectionsByTrackId,
      suppressed: before.suppressedAutoSectionsByTrackId,
      automation: before.presetAutomationCuesByTrackId,
      layers: before.soundDrawingLayersByTrackId,
      clips: before.soundDrawingClipsByTrackId,
      pads: before.performancePads,
      fixtures: before.laserDmxSettings.fixtures,
      beams: before.laserDmxBeamMatrix.beams,
      groups: before.laserDmxBeamMatrix.groups,
      routes: before.laserDmxBeamMatrix.globalModulationRoutes,
      cues: before.laserDmxBeamMatrix.cues,
    }

    before.resetCurrentEngineSettings()
    const after = useReactStore.getState()
    const matrixDefaults = createDefaultLaserDmxBeamMatrixSettings()

    expect(after.laserDmxBeamMatrix.output).toEqual(matrixDefaults.output)
    expect(after.laserDmxBeamMatrix.fog).toEqual(matrixDefaults.fog)
    expect(after.reactIntensity).toBe(0.7)
    expect(after.reactMotion).toBe(0.5)
    expect(after.reactPresets).toEqual(authored.reactPresets)
    expect(after.manualTrackSectionsByTrackId).toEqual(authored.manual)
    expect(after.suppressedAutoSectionsByTrackId).toEqual(authored.suppressed)
    expect(after.presetAutomationCuesByTrackId).toEqual(authored.automation)
    expect(after.soundDrawingLayersByTrackId).toEqual(authored.layers)
    expect(after.soundDrawingClipsByTrackId).toEqual(authored.clips)
    expect(after.performancePads).toEqual(authored.pads)
    expect(after.laserDmxSettings.fixtures).toEqual(authored.fixtures)
    expect(after.laserDmxBeamMatrix.beams).toEqual(authored.beams)
    expect(after.laserDmxBeamMatrix.groups).toEqual(authored.groups)
    expect(after.laserDmxBeamMatrix.globalModulationRoutes).toEqual(authored.routes)
    expect(after.laserDmxBeamMatrix.cues).toEqual(authored.cues)
  })

  it('resets Sound Drawing settings without deleting authored track content', () => {
    seedAuthoredState()
    useReactStore.setState({ activeReactEngineId: 'oscilloscope' })
    const before = useReactStore.getState()

    before.resetCurrentEngineSettings()
    const after = useReactStore.getState()

    expect(after.oscillatorSettings).toEqual(DEFAULT_OSCILLATOR_SETTINGS)
    expect(after.manualTrackSectionsByTrackId).toEqual(before.manualTrackSectionsByTrackId)
    expect(after.presetAutomationCuesByTrackId).toEqual(before.presetAutomationCuesByTrackId)
    expect(after.soundDrawingLayersByTrackId).toEqual(before.soundDrawingLayersByTrackId)
    expect(after.soundDrawingClipsByTrackId).toEqual(before.soundDrawingClipsByTrackId)
    expect(after.performancePads).toEqual(before.performancePads)
    expect(after.reactPresets).toEqual(before.reactPresets)
  })

  it('resets React-view preferences while preserving authored content and engine programs', () => {
    seedAuthoredState()
    const before = useReactStore.getState()
    const authoredMatrix = before.laserDmxBeamMatrix
    const authoredSpatial = before.laserDmxSettings

    before.resetReactViewPreferences()
    const after = useReactStore.getState()

    expect(after.activeReactPresetId).toBe('preset-dream-gate')
    expect(after.activeReactEngineId).toBe('cinematicPortal')
    expect(after.laserDmxWorkspaceMode).toBe('beamMatrix')
    expect(after.selectedSectionId).toBeNull()
    expect(after.selectedSectionByTrackId).toEqual({})
    expect(after.activePadId).toBeNull()
    expect(after.laserDmxBeamMatrix.selectedBeamIds).toEqual([])
    expect(after.laserDmxBeamMatrix.selectedGroupId).toBeNull()
    expect(after.laserDmxBeamMatrix.beams).toEqual(authoredMatrix.beams)
    expect(after.laserDmxBeamMatrix.groups).toEqual(authoredMatrix.groups)
    expect(after.laserDmxBeamMatrix.cues).toEqual(authoredMatrix.cues)
    expect(after.laserDmxSettings.fixtures).toEqual(authoredSpatial.fixtures)
    expect(after.manualTrackSectionsByTrackId).toEqual(before.manualTrackSectionsByTrackId)
    expect(after.suppressedAutoSectionsByTrackId).toEqual(before.suppressedAutoSectionsByTrackId)
    expect(after.presetAutomationCuesByTrackId).toEqual(before.presetAutomationCuesByTrackId)
    expect(after.soundDrawingLayersByTrackId).toEqual(before.soundDrawingLayersByTrackId)
    expect(after.soundDrawingClipsByTrackId).toEqual(before.soundDrawingClipsByTrackId)
    expect(after.performancePads).toEqual(before.performancePads)
    expect(after.reactPresets).toEqual(before.reactPresets)
  })

  it('clears only the authored project-content boundary', () => {
    seedAuthoredState()
    const before = useReactStore.getState()
    const oscillatorBefore = before.oscillatorSettings

    before.clearReactProjectContent()
    const after = useReactStore.getState()

    expect(after.reactPresets).toEqual(DEFAULT_REACT_PRESETS)
    expect(after.manualTrackSectionsByTrackId).toEqual({})
    expect(after.suppressedAutoSectionsByTrackId).toEqual({})
    expect(after.presetAutomationCuesByTrackId).toEqual({})
    expect(after.soundDrawingLayersByTrackId).toEqual({})
    expect(after.soundDrawingClipsByTrackId).toEqual({})
    expect(after.performancePads).toEqual(DEFAULT_PERFORMANCE_PADS)
    expect(after.laserDmxSettings).toEqual(createDefaultLaserDmxSettings())
    expect(after.laserDmxBeamMatrix).toEqual(createDefaultLaserDmxBeamMatrixSettings())
    expect(after.activeLaserDmxBeamMatrixPresetId).toBeNull()
    expect(after.laserDmxBeamMatrixPresetDirty).toBe(false)
    expect(after.oscillatorSettings).toEqual(oscillatorBefore)
    expect(after.reactIntensity).toBe(0.11)
  })
})
