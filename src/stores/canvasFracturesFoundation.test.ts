import { beforeEach, describe, expect, it } from 'vitest'
import {
  CANVAS_PRESET_BY_ID,
  CANVAS_PRESETS,
  CANVAS_PRESET_SETTINGS_SCHEMA_VERSION,
  DEFAULT_CANVAS_PRESET_SETTINGS,
  resolveCanvasPresetRendererKind,
} from '../components/vyzualz/react/ReactTypes'
import {
  mergeReactStoreState,
  migrateReactStore,
  normalizeCanvasPresetSettings,
  useReactStore,
} from './reactStore'

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
})

describe('Fractures CANVAS foundation', () => {
  it('registers Fractures and selects it through the production CANVAS store action', () => {
    const fractures = CANVAS_PRESET_BY_ID['canvas-fractures']

    expect(CANVAS_PRESETS.map(preset => preset.id)).toContain('canvas-fractures')
    expect(fractures).toMatchObject({
      id: 'canvas-fractures',
      name: 'Fractures',
      rendererKind: 'fragmentCollage',
    })

    useReactStore.getState().selectCanvasPreset('canvas-fractures')

    expect(useReactStore.getState().selectedCanvasPresetId).toBe('canvas-fractures')
    expect(useReactStore.getState().canvasPresetSettings).toMatchObject(fractures.settings)
    expect(useReactStore.getState().canvasPresetOverride).toMatchObject({
      source: 'manual',
      presetId: 'canvas-fractures',
      label: 'User-selected preset',
    })
  })

  it('uses explicit renderer kinds without changing existing preset routing', () => {
    expect(resolveCanvasPresetRendererKind('canvas-fractures')).toBe('fragmentCollage')
    expect(resolveCanvasPresetRendererKind('canvas-particle-aura')).toBe('particleAura')
    expect(resolveCanvasPresetRendererKind('canvas-clean-playback')).toBe('standard')
    expect(resolveCanvasPresetRendererKind('canvas-glitch-pulse')).toBe('standard')
  })

  it('normalizes enum values, colors, role weights, revisions, and numeric ranges', () => {
    const normalized = normalizeCanvasPresetSettings({
      schemaVersion: 2,
      fractureIntensity: 4,
      fractureMode: 'triangles',
      fractureAnchorMode: 'missing',
      fractureFocusProtection: -4,
      fractureFocusX: 2,
      fractureFocusY: -1,
      fractureComposition: 12,
      fracturePlacementMode: 'orbit',
      fractureTopologyInterval: 'quarterBeat',
      fractureLayoutInterval: 'never',
      fractureVariationSeed: 1_500_000.9,
      fractureQuality: 'ultra',
      fractureMotionAmount: Number.NaN,
      fractureTransitionMode: 'wipe',
      fractureTransitionSpeed: 4,
      fractureStaggerAmount: -1,
      fractureZoomAmount: 3,
      fractureFreezeLayout: 'yes',
      fractureReturnToAnchor: false,
      fractureTopologyRevision: -9,
      fractureLayoutRevision: Number.MAX_SAFE_INTEGER * 2,
      fractureEffectsIntensity: 3,
      fractureGlowAmount: -3,
      fractureEffectRoleWeights: {
        anchor: 4,
        primary: -2,
        support: Number.NaN,
        accent: 0.4,
        echo: 2,
      },
      fractureColorSourceMode: 'gradient',
      fractureManualPrimaryColor: 'not-a-color',
      fractureManualSupportingColor: '#12abEF',
      fractureAudioResponse: 4,
      fractureBassMotion: -1,
      fractureTransientGlitch: 8,
      fractureStructuralResponse: -8,
    })

    expect(normalized.schemaVersion).toBe(CANVAS_PRESET_SETTINGS_SCHEMA_VERSION)
    expect(normalized).toMatchObject({
      fractureIntensity: 1,
      fractureMode: DEFAULT_CANVAS_PRESET_SETTINGS.fractureMode,
      fractureAnchorMode: DEFAULT_CANVAS_PRESET_SETTINGS.fractureAnchorMode,
      fractureFocusProtection: 0,
      fractureFocusX: 1,
      fractureFocusY: 0,
      fractureComposition: 1,
      fracturePlacementMode: DEFAULT_CANVAS_PRESET_SETTINGS.fracturePlacementMode,
      fractureTopologyInterval: DEFAULT_CANVAS_PRESET_SETTINGS.fractureTopologyInterval,
      fractureLayoutInterval: DEFAULT_CANVAS_PRESET_SETTINGS.fractureLayoutInterval,
      fractureVariationSeed: 999999,
      fractureQuality: DEFAULT_CANVAS_PRESET_SETTINGS.fractureQuality,
      fractureMotionAmount: DEFAULT_CANVAS_PRESET_SETTINGS.fractureMotionAmount,
      fractureTransitionMode: DEFAULT_CANVAS_PRESET_SETTINGS.fractureTransitionMode,
      fractureTransitionSpeed: 1,
      fractureStaggerAmount: 0,
      fractureZoomAmount: 1,
      fractureFreezeLayout: false,
      fractureReturnToAnchor: false,
      fractureTopologyRevision: 0,
      fractureLayoutRevision: Number.MAX_SAFE_INTEGER,
      fractureEffectsIntensity: 1,
      fractureGlowAmount: 0,
      fractureColorSourceMode: DEFAULT_CANVAS_PRESET_SETTINGS.fractureColorSourceMode,
      fractureManualPrimaryColor: DEFAULT_CANVAS_PRESET_SETTINGS.fractureManualPrimaryColor,
      fractureManualSupportingColor: '#12ABEF',
      fractureAudioResponse: 1,
      fractureBassMotion: 0,
      fractureTransientGlitch: 1,
      fractureStructuralResponse: 0,
    })
    expect(normalized.fractureEffectRoleWeights).toEqual({
      anchor: 1,
      primary: 0,
      support: DEFAULT_CANVAS_PRESET_SETTINGS.fractureEffectRoleWeights.support,
      accent: 0.4,
      echo: 1,
    })
  })

  it('migrates a pre-Fractures project lazily without replacing existing CANVAS values', () => {
    const migrated = migrateReactStore({
      selectedCanvasPresetId: 'canvas-ghost-echo',
      canvasPresetSettings: {
        schemaVersion: 2,
        sourceMixMode: 'dryOnly',
        drySourceMix: 0.37,
        sourceVisibility: 0.37,
        intensity: 0.73,
        glow: 0.42,
      },
      unrelatedMarker: 'preserve-me',
    }, 64)
    const settings = migrated.canvasPresetSettings as ReturnType<typeof normalizeCanvasPresetSettings>

    expect(migrated.unrelatedMarker).toBe('preserve-me')
    expect(migrated.selectedCanvasPresetId).toBe('canvas-ghost-echo')
    expect(settings).toMatchObject({
      schemaVersion: CANVAS_PRESET_SETTINGS_SCHEMA_VERSION,
      drySourceMix: 0.37,
      sourceVisibility: 0.37,
      intensity: 0.73,
      glow: 0.42,
      fractureMode: DEFAULT_CANVAS_PRESET_SETTINGS.fractureMode,
      fractureVariationSeed: DEFAULT_CANVAS_PRESET_SETTINGS.fractureVariationSeed,
    })
  })

  it('round-trips every Fractures choice through the persisted project merge path', () => {
    useReactStore.getState().selectCanvasPreset('canvas-fractures')
    useReactStore.getState().setCanvasPresetSettings({
      fractureIntensity: 0.91,
      fractureMode: 'angledQuads',
      fractureAnchorMode: 'fadeWithMusic',
      fractureFocusProtection: 0.27,
      fractureFocusX: 0.33,
      fractureFocusY: 0.66,
      fractureComposition: 0.88,
      fracturePlacementMode: 'randomMix',
      fractureTopologyInterval: '8bars',
      fractureLayoutInterval: '2bars',
      fractureVariationSeed: 424242,
      fractureQuality: 'high',
      fractureMotionAmount: 0.77,
      fractureTransitionMode: 'zoomInOut',
      fractureTransitionSpeed: 0.69,
      fractureStaggerAmount: 0.31,
      fractureZoomAmount: 0.52,
      fractureFreezeLayout: true,
      fractureReturnToAnchor: false,
      fractureTopologyRevision: 4,
      fractureLayoutRevision: 7,
      fractureEffectsIntensity: 0.81,
      fractureGlowAmount: 0.61,
      fractureGlitchAmount: 0.72,
      fractureTextureAmount: 0.41,
      fractureTrailsAmount: 0.35,
      fractureDepthAmount: 0.58,
      fractureDuplicationAmount: 0.22,
      fractureColorTreatmentAmount: 0.67,
      fractureEffectRoleWeights: {
        anchor: 0.95,
        primary: 0.84,
        support: 0.63,
        accent: 0.42,
        echo: 0.21,
      },
      fractureColorSourceMode: 'manualOverride',
      fractureManualPrimaryColor: '#112233',
      fractureManualSupportingColor: '#AABBCC',
      fractureAudioResponse: 0.73,
      fractureBassMotion: 0.64,
      fractureTransientGlitch: 0.55,
      fractureStructuralResponse: 0.46,
    })

    const before = useReactStore.getState()
    const persisted = JSON.parse(JSON.stringify({
      selectedCanvasPresetId: before.selectedCanvasPresetId,
      canvasPresetSettings: before.canvasPresetSettings,
      canvasPresetOverride: before.canvasPresetOverride,
    }))
    const reloaded = mergeReactStoreState(persisted, before)

    expect(reloaded.selectedCanvasPresetId).toBe('canvas-fractures')
    expect(reloaded.canvasPresetSettings).toEqual(before.canvasPresetSettings)
    expect(reloaded.canvasPresetOverride).toEqual(before.canvasPresetOverride)
  })
})
