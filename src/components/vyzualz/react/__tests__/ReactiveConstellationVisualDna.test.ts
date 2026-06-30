import { beforeEach, describe, expect, it } from 'vitest'
import {
  CINEMATIC_AUDIO_SOURCES,
  CINEMATIC_AUDIO_TARGETS,
  createCinematicWorldConfig,
} from '../CinematicWorldConfig'
import {
  REACTIVE_CONSTELLATION_BOUNDS,
  REACTIVE_CONSTELLATION_DEFAULTS,
  REACTIVE_CONSTELLATION_MACRO_KEYS,
  resolveReactiveConstellationSettings,
} from '../CinematicWorldSettings'
import {
  REACTIVE_CONSTELLATION_VISUAL_DNA_CATALOG,
  applyReactiveConstellationVisualDnaProfile,
  createReactiveConstellationProfileAudioRoutes,
  markReactiveConstellationVisualDnaCustom,
  updateReactiveConstellationMacro,
} from '../ReactiveConstellationVisualDna'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import {
  mergeReactStoreState,
  reactStorePartialize,
  resolveCinematicConfigForPreset,
  useReactStore,
} from '../../../../stores/reactStore'

const constellationPreset = DEFAULT_REACT_PRESETS.find(
  preset => preset.cinematicConfig?.worldMode === 'reactiveConstellation',
)!

function constellationSettings(config: ReturnType<typeof createCinematicWorldConfig>) {
  if (config.worldSettings.mode !== 'reactiveConstellation') throw new Error('Expected Reactive Constellation settings')
  return resolveReactiveConstellationSettings(config.worldSettings)
}

describe('Reactive Constellation Visual DNA profiles', () => {
  beforeEach(() => useReactStore.getState().resetReactView())

  it('publishes a complete, valid catalog of curated starting profiles', () => {
    const profiles = Object.values(REACTIVE_CONSTELLATION_VISUAL_DNA_CATALOG)
    expect(profiles.map(profile => profile.id)).toEqual([
      'melodicBass', 'heavyDubstep', 'hybridTrap', 'house', 'techno', 'openFormat',
    ])
    expect(new Set(profiles.map(profile => profile.label)).size).toBe(profiles.length)

    for (const profile of profiles) {
      const applied = applyReactiveConstellationVisualDnaProfile(
        createCinematicWorldConfig('reactiveConstellation', {}),
        profile.id,
      )
      const settings = constellationSettings(applied)
      expect(settings.visualDnaProfile).toBe(profile.id)
      for (const key of REACTIVE_CONSTELLATION_MACRO_KEYS) expect(settings[key]).toBe(0.5)
      for (const [key, [min, max]] of Object.entries(REACTIVE_CONSTELLATION_BOUNDS)) {
        const value = settings[key as keyof typeof settings]
        expect(typeof value, `${profile.id}.${key}`).toBe('number')
        expect(value as number, `${profile.id}.${key}`).toBeGreaterThanOrEqual(min)
        expect(value as number, `${profile.id}.${key}`).toBeLessThanOrEqual(max)
      }
      expect(applied.audioMapping.routes.length).toBeGreaterThan(0)
      expect(new Set(applied.audioMapping.routes.map(route => route.id)).size).toBe(applied.audioMapping.routes.length)
      expect(applied.audioMapping.routes.every(route => CINEMATIC_AUDIO_SOURCES.includes(route.source))).toBe(true)
      expect(applied.audioMapping.routes.every(route => CINEMATIC_AUDIO_TARGETS.includes(route.target))).toBe(true)
    }
  })

  it('applies profiles through cloned normalized data without mutating presets or catalog routes', () => {
    const presetSnapshot = JSON.stringify(DEFAULT_REACT_PRESETS)
    const source = resolveCinematicConfigForPreset(constellationPreset, {})!
    const sourceSnapshot = JSON.stringify(source)
    const applied = applyReactiveConstellationVisualDnaProfile(source, 'heavyDubstep')

    expect(applied).not.toBe(source)
    expect(applied.worldSettings).not.toBe(source.worldSettings)
    expect(applied.camera).not.toBe(source.camera)
    expect(applied.audioMapping.routes[0]).not.toBe(source.audioMapping.routes[0])
    expect(applied.worldMode).toBe('reactiveConstellation')

    applied.audioMapping.routes[0].amount = 2
    const freshRoutes = createReactiveConstellationProfileAudioRoutes('heavyDubstep')
    expect(freshRoutes[0].amount).not.toBe(2)
    expect(JSON.stringify(source)).toBe(sourceSnapshot)
    expect(JSON.stringify(DEFAULT_REACT_PRESETS)).toBe(presetSnapshot)
  })

  it('normalizes macro values and marks detailed edits custom without destroying authored values', () => {
    const profiled = applyReactiveConstellationVisualDnaProfile(
      createCinematicWorldConfig('reactiveConstellation', {}),
      'melodicBass',
    )
    const high = updateReactiveConstellationMacro(profiled, 'macroImpact', 99)
    const low = updateReactiveConstellationMacro(high, 'macroTrails', -4)
    const custom = markReactiveConstellationVisualDnaCustom(low)
    const settings = constellationSettings(custom)

    expect(settings.macroImpact).toBe(1)
    expect(settings.macroTrails).toBe(0)
    expect(settings.visualDnaProfile).toBe('custom')
    expect(settings.nodeCount).toBe(constellationSettings(profiled).nodeCount)
    expect(settings.networkSpread).toBe(constellationSettings(profiled).networkSpread)
  })

  it('round-trips profile and macro settings through project persistence and repairs legacy payloads', () => {
    const base = resolveCinematicConfigForPreset(constellationPreset, {})!
    const authored = updateReactiveConstellationMacro(
      applyReactiveConstellationVisualDnaProfile(base, 'techno'),
      'macroTrails',
      0.91,
    )
    useReactStore.getState().setCinematicConfigForPreset(constellationPreset.id, authored)
    const persisted = reactStorePartialize(useReactStore.getState())
    const merged = mergeReactStoreState(persisted, useReactStore.getState())
    const restored = merged.cinematicConfigsByPresetId[constellationPreset.id]
    const restoredSettings = constellationSettings(restored)

    expect(restoredSettings.visualDnaProfile).toBe('techno')
    expect(restoredSettings.macroTrails).toBe(0.91)

    const legacy = structuredClone(base) as typeof base & {
      worldSettings: { mode: 'reactiveConstellation'; settings: Record<string, unknown> }
    }
    if (legacy.worldSettings.mode !== 'reactiveConstellation') throw new Error('Expected Reactive Constellation settings')
    for (const key of ['visualDnaProfile', ...REACTIVE_CONSTELLATION_MACRO_KEYS]) delete legacy.worldSettings.settings[key]
    const migrated = mergeReactStoreState({
      cinematicConfigsByPresetId: { [constellationPreset.id]: legacy },
    }, useReactStore.getState())
    const migratedSettings = constellationSettings(migrated.cinematicConfigsByPresetId[constellationPreset.id])

    expect(migratedSettings.visualDnaProfile).toBe(REACTIVE_CONSTELLATION_DEFAULTS.visualDnaProfile)
    for (const key of REACTIVE_CONSTELLATION_MACRO_KEYS) {
      expect(migratedSettings[key]).toBe(REACTIVE_CONSTELLATION_DEFAULTS[key])
    }
  })
})
