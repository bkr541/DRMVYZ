import { beforeEach, describe, expect, it } from 'vitest'
import { CANVAS_PRESETS, CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS, CANVAS_PRESET_SETTINGS_SCHEMA_VERSION } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { mergeReactStoreState, migrateReactStore, normalizeCanvasPresetSettings, reactStorePartialize, useReactStore } from '../../../../../stores/reactStore'
import { DEFAULT_CANVAS_DATA_BLEED_SETTINGS as defaults, normalizeCanvasDataBleedSettings, clearDataBleedHistory, getDataBleedClearRevision } from './DataBleedSettings'
import { resolveDataBleedPlan } from './DataBleedRenderPlan'
const state = () => useReactStore.getState()
beforeEach(() => state().resetReactView())
describe('Data Bleed catalog and durable settings', () => {
  it('registers one visible preset without touching source/media locks or other renderer identities', () => {
    state().setCanvasAutoSelectEnabled(true); state().selectCanvasMediaItem('user-source')
    state().selectCanvasPreset('canvas-data-bleed')
    expect(CANVAS_VISIBLE_PRESETS.filter(p => p.id === 'canvas-data-bleed')).toHaveLength(1)
    expect(CANVAS_PRESET_BY_ID['canvas-data-bleed']).toMatchObject({ name: 'Data Bleed', rendererKind: 'dataBleed' })
    state().applyCanvasAutoSelection({ presetId: 'canvas-fractures', mediaId: 'other' })
    expect(state().activeCanvasMediaId).toBe('user-source')
    expect(state().selectedCanvasPresetId).toBe('canvas-data-bleed')
    state().selectCanvasPreset('canvas-clean-playback')
    expect(state().activeCanvasMediaId).toBe('user-source')
    expect(state().canvasPresetSettings).toEqual(normalizeCanvasPresetSettings(CANVAS_PRESET_BY_ID['canvas-clean-playback'].settings))
    expect(CANVAS_PRESET_BY_ID['canvas-mutagen'].rendererKind).toBe('imageMutation')
    expect(CANVAS_PRESET_BY_ID['canvas-shiftgrid'].rendererKind).toBe('shiftgrid')
  })
  it('validates every authored field, clamps numbers and strips runtime/private data', () => {
    expect(normalizeCanvasDataBleedSettings({ amount: 5, blockSize: 1, motionSensitivity: -1, flowSpeed: 99, historyRetention: 1, sourceRefresh: -2, directionBias: 999, sourceMix: 5, audioReactivity: -3, deterministicSeed: -10, quality: 'ultra', flowMode: 'swirl', freezeHistory: 'yes', autoPerformance: 'yes', bpmSync: 1, url: 'secret', framebuffers: [] })).toEqual({ ...defaults, amount: 1, blockSize: 2, motionSensitivity: 0, flowSpeed: 4, historyRetention: 0.95, sourceRefresh: 0, directionBias: 180, sourceMix: 1, audioReactivity: 0, deterministicSeed: 0 })
    for (const value of [null, undefined, [], 'bad', { amount: NaN, sourceMix: Infinity, blockSize: '4' }]) expect(normalizeCanvasDataBleedSettings(value)).toEqual(defaults)
  })
  it('hydrates schema 14 and older saves, preserves other recipes, and persists only settings', () => {
    const previous = state().canvasPresetSettings.mutagen
    const old = mergeReactStoreState({ canvasPresetSettings: { schemaVersion: 14, intensity: 0.42, mutagen: previous } }, state())
    expect(old.canvasPresetSettings.schemaVersion).toBe(CANVAS_PRESET_SETTINGS_SCHEMA_VERSION)
    expect(old.canvasPresetSettings.dataBleed).toEqual(defaults)
    expect(old.canvasPresetSettings.mutagen).toEqual(previous)
    expect(old.canvasPresetSettings.intensity).toBe(0.42)
    state().selectCanvasMediaItem('private-media-id'); state().selectCanvasPreset('canvas-data-bleed')
    const authored = { ...defaults, flowMode: 'motion' as const, freezeHistory: true, deterministicSeed: 42, amount: 0.33 }
    state().setCanvasPresetSettings({ dataBleed: authored })
    const serialized = JSON.parse(JSON.stringify(reactStorePartialize(state())))
    const restored = mergeReactStoreState(migrateReactStore(serialized, 0), state())
    expect(restored.canvasPresetSettings.dataBleed).toEqual(authored)
    expect(restored.activeCanvasMediaId).toBe('private-media-id')
    expect(JSON.stringify(CANVAS_PRESET_BY_ID['canvas-data-bleed'])).not.toContain('private-media-id')
    state().resetCanvasPresetSettings(); expect(state().canvasPresetSettings.dataBleed).toEqual(defaults)
    expect(state().activeCanvasMediaId).toBe('private-media-id')
  })
  it('tracks every nested field in provenance without clearing the stable preset ID', () => {
    const preset = CANVAS_PRESET_BY_ID['canvas-data-bleed'], exact = normalizeCanvasPresetSettings(preset.settings)
    for (const [key, value] of Object.entries(defaults)) {
      if (key === 'version') continue
      const replacement = typeof value === 'boolean' ? !value : typeof value === 'number' ? value + 0.1 : value === 'mixed' ? 'motion' : 'high'
      expect(resolveCanvasPresetProvenance(preset, { ...exact, dataBleed: { ...exact.dataBleed, [key]: replacement } }).status).toBe('modified')
    }
    for (const p of CANVAS_PRESETS) expect(resolveCanvasPresetProvenance(p, normalizeCanvasPresetSettings(p.settings)).status).toBe('exact')
  })
  it('holds clear-history command identity outside persistence and bounds Auto plans', () => {
    const before = getDataBleedClearRevision(); clearDataBleedHistory(); expect(getDataBleedClearRevision()).not.toBe(before)
    expect(JSON.stringify(reactStorePartialize(state()))).not.toContain('clearRevision')
    for (const [w, h, tier] of [[1280, 720, 'balanced'], [1920, 1080, 'balanced'], [3840, 2160, 'low']] as const) {
      const plan = resolveDataBleedPlan(defaults, w, h)
      expect(plan.tier).toBe(tier); expect(plan.maxTargets).toBe(4); expect(plan.maxDrawPasses).toBe(3); expect(plan.feedbackPasses).toBe(1)
      expect(plan.output.width).toBeLessThanOrEqual(2560)
    }
  })
})
