import { beforeEach, describe, expect, it } from 'vitest'
import { useReactStore } from './reactStore'
import {
  CANVAS_PRESET_BY_ID,
  DEFAULT_CANVAS_PRESET_ID,
} from '../components/vyzualz/react/ReactTypes'
import {
  getReactLeftTabLabel,
  getReactLeftTabs,
  getReactPresetTabLabel,
  resolveReactWorkspaceComposition,
} from '../components/vyzualz/react/reactWorkspaceComposition'
import {
  isSelectableReactEngineId,
  REACT_ENGINE_CATALOG,
  REACT_ENGINE_IDS,
} from '../components/vyzualz/react/reactEngineCatalog'

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
})

describe('CANVAS final-pass store and workspace contract', () => {
  it('registers CANVAS as a native React engine with source-left/preset-right composition', () => {
    expect(REACT_ENGINE_IDS).toContain('canvas')
    expect(isSelectableReactEngineId('canvas')).toBe(true)
    expect(REACT_ENGINE_CATALOG.canvas.label).toBe('CANVAS')

    const composition = resolveReactWorkspaceComposition('canvas', 'beamMatrix', false)
    expect(getReactLeftTabs(composition)).toEqual(['workspace'])
    expect(getReactLeftTabLabel('workspace', composition)).toBe('SOURCE')
    expect(composition.presetSurface).toBe('enginePresets')
    expect(getReactPresetTabLabel(composition)).toBe('PRESETS')
    expect(composition.showPerformancePads).toBe(true)
    expect(composition.showSoundDrawingTimeline).toBe(false)
  })

  it('defaults away from an isolated CANVAS upload bucket', () => {
    expect(useReactStore.getState().canvasEngineSettings.uploadEnabled).toBe(false)
  })

  it('locks manual media selection against Auto Select media changes', () => {
    useReactStore.getState().setCanvasAutoSelectEnabled(true)
    useReactStore.getState().selectCanvasMediaItem('library-video-1')

    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')
    expect(useReactStore.getState().canvasEngineSettings.manualMediaOverrideId).toBe('library-video-1')

    useReactStore.getState().applyCanvasAutoSelection({
      mediaId: 'library-image-2',
      presetId: 'canvas-bass-bloom',
      label: 'Auto: drop section',
    })

    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')
    expect(useReactStore.getState().selectedCanvasPresetId).toBe('canvas-bass-bloom')
    expect(useReactStore.getState().canvasPresetOverride).toMatchObject({
      source: 'auto',
      presetId: 'canvas-bass-bloom',
      label: 'Auto: drop section',
    })
  })

  it('clears media lock so Auto Select can move to a better source', () => {
    useReactStore.getState().setCanvasAutoSelectEnabled(true)
    useReactStore.getState().selectCanvasMediaItem('library-video-1')
    useReactStore.getState().clearCanvasMediaOverride()

    useReactStore.getState().applyCanvasAutoSelection({
      mediaId: 'library-image-2',
      presetId: 'canvas-ghost-echo',
      label: 'Auto: breakdown',
    })

    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-image-2')
    expect(useReactStore.getState().canvasEngineSettings.manualMediaOverrideId).toBeNull()
  })

  it('keeps manual preset override in control while Auto Select may still update unlocked media', () => {
    useReactStore.getState().setCanvasAutoSelectEnabled(true)
    useReactStore.getState().selectCanvasPreset('canvas-ghost-echo')

    useReactStore.getState().applyCanvasAutoSelection({
      mediaId: 'library-video-1',
      presetId: 'canvas-glitch-pulse',
      label: 'Auto: drop section',
    })

    expect(useReactStore.getState().selectedCanvasPresetId).toBe('canvas-ghost-echo')
    expect(useReactStore.getState().canvasPresetOverride).toMatchObject({
      source: 'manual',
      presetId: 'canvas-ghost-echo',
      label: 'User-selected preset',
    })
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')
  })

  it('applies presets as parameter bundles and preserves user-adjusted overrides', () => {
    const particleAura = CANVAS_PRESET_BY_ID['canvas-particle-aura']

    useReactStore.getState().selectCanvasPreset('canvas-particle-aura')
    expect(useReactStore.getState().selectedCanvasPresetId).toBe(particleAura.id)
    expect(useReactStore.getState().canvasPresetSettings).toMatchObject({
      sourceVisibility: particleAura.settings.sourceVisibility,
      intensity: particleAura.settings.intensity,
      particleDensity: particleAura.settings.particleDensity,
      particleColorMode: particleAura.settings.particleColorMode,
      particleQuality: particleAura.settings.particleQuality,
    })
    expect(particleAura.controls).toEqual(expect.arrayContaining([
      'sourceVisibility',
      'intensity',
      'particleDensity',
      'particleSize',
      'particleColorMode',
      'particleQuality',
    ]))

    useReactStore.getState().setCanvasPresetSettings({ particleDensity: 0.19, particleQuality: 'low' })
    expect(useReactStore.getState().canvasPresetSettings.particleDensity).toBe(0.19)
    expect(useReactStore.getState().canvasPresetOverride).toMatchObject({
      source: 'manual',
      presetId: 'canvas-particle-aura',
      label: 'User-adjusted preset',
    })

    useReactStore.getState().resetCanvasPresetSettings()
    expect(useReactStore.getState().canvasPresetSettings.particleDensity).toBe(particleAura.settings.particleDensity)
    expect(useReactStore.getState().canvasPresetSettings.particleQuality).toBe(particleAura.settings.particleQuality)
  })

  it('keeps clean playback a real parameter bundle instead of a placeholder effect', () => {
    const clean = CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]

    expect(clean.controls).toEqual(expect.arrayContaining(['sourceVisibility', 'intensity']))
    useReactStore.getState().selectCanvasPreset(DEFAULT_CANVAS_PRESET_ID)
    expect(useReactStore.getState().canvasPresetSettings).toMatchObject({
      sourceVisibility: clean.settings.sourceVisibility,
      intensity: clean.settings.intensity,
      glow: clean.settings.glow,
      trailAmount: clean.settings.trailAmount,
    })
  })
})
