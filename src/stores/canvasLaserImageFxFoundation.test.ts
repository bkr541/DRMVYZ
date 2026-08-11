import { beforeEach, describe, expect, it } from 'vitest'
import {
  CANVAS_PRESET_BY_ID,
  CANVAS_PRESET_SETTINGS_SCHEMA_VERSION,
  DEFAULT_CANVAS_PRESET_SETTINGS,
} from '../components/vyzualz/react/ReactTypes'
import { mergeReactStoreState, normalizeCanvasPresetSettings, useReactStore } from './reactStore'

describe('CANVAS Laser Image FX foundation', () => {
  beforeEach(() => useReactStore.getState().resetReactView())

  it('registers Laser Image FX through the canonical Canvas preset contract', () => {
    const preset = CANVAS_PRESET_BY_ID['canvas-laser-image-fx']
    expect(preset).toMatchObject({
      id: 'canvas-laser-image-fx',
      name: 'Laser Image FX',
      rendererKind: 'laserImageFx',
    })
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')
    const state = useReactStore.getState()
    expect(state.selectedCanvasPresetId).toBe('canvas-laser-image-fx')
    expect(state.canvasPresetSettings.laserImageEffect).toBe('spin3d')
    expect(state.canvasPresetSettings.laserBpmSync).toBe(true)
  })

  it('normalizes enums, clamps numeric controls, and preserves independent selections', () => {
    const normalized = normalizeCanvasPresetSettings({
      laserImageEffect: 'warpDiamond',
      laserColorEffect: 'colorBlobsB',
      laserSpeed: 99,
      laserWarpAmount: -4,
      laserPerspective: 3,
      laserColorAmount: Number.NaN,
      laserBloom: 2,
      laserBpmSync: false,
      laserize: 1.6,
    })
    expect(normalized).toMatchObject({
      laserImageEffect: 'warpDiamond',
      laserColorEffect: 'colorBlobsB',
      laserSpeed: 4,
      laserWarpAmount: 0,
      laserPerspective: 1,
      laserColorAmount: DEFAULT_CANVAS_PRESET_SETTINGS.laserColorAmount,
      laserBloom: 1,
      laserBpmSync: false,
      laserize: 1,
    })

    const malformed = normalizeCanvasPresetSettings({ laserImageEffect: 'broken', laserColorEffect: 'broken' })
    expect(malformed.laserImageEffect).toBe(DEFAULT_CANVAS_PRESET_SETTINGS.laserImageEffect)
    expect(malformed.laserColorEffect).toBe(DEFAULT_CANVAS_PRESET_SETTINGS.laserColorEffect)
  })

  it('hydrates pre-v6 Canvas settings with Laser defaults while preserving unrelated authored values', () => {
    const current = useReactStore.getState()
    const merged = mergeReactStoreState({
      selectedCanvasPresetId: 'canvas-clean-playback',
      canvasPresetSettings: {
        schemaVersion: 5,
        drySourceMix: 0.37,
        sourceVisibility: 0.37,
        intensity: 0.44,
        fractureVariationSeed: 90210,
        particleQuality: 'high',
      },
    }, current)
    expect(merged.canvasPresetSettings.schemaVersion).toBe(CANVAS_PRESET_SETTINGS_SCHEMA_VERSION)
    expect(merged.canvasPresetSettings.drySourceMix).toBe(0.37)
    expect(merged.canvasPresetSettings.intensity).toBe(0.44)
    expect(merged.canvasPresetSettings.fractureVariationSeed).toBe(90210)
    expect(merged.canvasPresetSettings.particleQuality).toBe('high')
    expect(merged.canvasPresetSettings.laserImageEffect).toBe(DEFAULT_CANVAS_PRESET_SETTINGS.laserImageEffect)
    expect(merged.canvasPresetSettings.laserColorEffect).toBe(DEFAULT_CANVAS_PRESET_SETTINGS.laserColorEffect)
  })
})
