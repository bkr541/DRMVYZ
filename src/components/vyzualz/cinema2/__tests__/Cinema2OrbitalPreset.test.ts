import { describe, expect, it, vi } from 'vitest'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_ORBITAL_PRESET_ID, CINEMA2_ORBITAL_PRESET_MANIFEST } from '../presets/Cinema2OrbitalPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_ORBITAL_MODULE_TYPE_ID, createCinema2OrbitalNativeModuleDefinition } from '../modules/Cinema2OrbitalNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_ORBITAL_PATTERNS, orbitalPattern, resolveOrbitalGlyphs, resolveOrbitalPose, type OrbitalMotionInput } from '../modules/orbital/Cinema2OrbitalMotion'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2SayItModuleInspection } from '../modules/Cinema2SayItNativeModule'
import type { Cinema2AudioIntelligenceFrame } from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ThreeLoadedAsset } from '../modules/three/Cinema2ThreeAssetCache'
import type { Cinema2SayItGlyphPose } from '../modules/sayIt/Cinema2SayItMotion'

const manifest = CINEMA2_ORBITAL_PRESET_MANIFEST
const motion: OrbitalMotionInput = { phaseBeats: 4.2, period: 8, amount: .7, ringTravel: 1, bass: .5, mids: .4, highs: .7, beat: .3 }
const glyphs: readonly Cinema2SayItGlyphPose[] = [
  { id: 'a', character: 'A', mesh: 'glyph-A', position: [-1, .4, 0], rotation: [0, 0, 0], scale: 1 },
  { id: 'b', character: 'B', mesh: 'glyph-B', position: [1, -.4, 0], rotation: [0, 0, 0], scale: 1 },
]

function createModule(options?: Parameters<typeof createCinema2OrbitalNativeModuleDefinition>[0]) {
  const module = manifest.modules![0]!
  const values = new Map(Object.entries(module.parameters!))
  const parameters = { get: (key: string) => values.get(key), getAuthored: (key: string) => values.get(key), resolve: () => null }
  const definition = createCinema2OrbitalNativeModuleDefinition(options)
  const instance = definition.create({ module, parameters, randomness: {} } as unknown as Cinema2ModuleCreateContext) as ReturnType<typeof definition.create> & { inspect(): Cinema2SayItModuleInspection }
  return { values, parameters, instance }
}

describe('Cinema 2.0 ORBITAL', () => {
  it('compiles in the native catalog with the required inspector groups and canonical trigger controls', () => {
    expect(cinema2NativePresetRegistry.compile(CINEMA2_ORBITAL_PRESET_ID).ok).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest }).diagnostics).toEqual([])
    expect(cinema2NativeModuleRegistry.get(CINEMA2_ORBITAL_MODULE_TYPE_ID, 1)).toBeTruthy()
    expect(new Set(manifest.parameters!.map(parameter => parameter.designParentGroup).filter(Boolean))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
    expect(manifest.parameters!.find(parameter => parameter.id === 'orbital-pattern')).toMatchObject({ defaultValue: 'gyroscopic-drift', options: CINEMA2_ORBITAL_PATTERNS, designParentGroup: 'effects' })
    expect(manifest.parameters!.find(parameter => parameter.id === 'orbital-trigger')).toMatchObject({ defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: 'orbital-pattern-change', value: true }] })
  })

  it('has six distinct rig and glyph paths, with bounded lettering and a true lock off', () => {
    const rings = new Set(), letters = new Set()
    for (const { value } of CINEMA2_ORBITAL_PATTERNS) {
      rings.add(JSON.stringify(resolveOrbitalPose(value, motion)))
      const moved = resolveOrbitalGlyphs(glyphs, value, motion)
      letters.add(JSON.stringify(moved))
      for (const [index, glyph] of moved.entries()) {
        glyph.position.forEach((position, axis) => expect(Math.abs(position - glyphs[index]!.position[axis]!)).toBeLessThan(.35))
      }
      expect(resolveOrbitalGlyphs(glyphs, value, { ...motion, amount: 0 })).toBe(glyphs)
      expect(resolveOrbitalPose(value, { ...motion, amount: 0 }).rings.every(angle => angle === 0)).toBe(true)
    }
    expect(rings.size).toBe(6)
    expect(letters.size).toBe(6)
    expect(resolveOrbitalPose('apsis-pulse', { ...motion, bass: 1 }).expansion).toBeGreaterThan(resolveOrbitalPose('apsis-pulse', { ...motion, bass: 0 }).expansion)
  })

  it('switches once per trigger and does not overwrite the authored selection', () => {
    const { instance, values, parameters } = createModule()
    values.set('pattern', 'gyroscopic-drift')
    values.set('patternChange', true)
    values.set('trigger', 'kick')
    let tick = 0
    const update = (kick: string | null, paused = false) => {
      const time = ++tick / 60
      const audio = { upstream: { timeSec: time, trackId: 'track' }, rhythm: { kick: kick ? { id: kick } : null }, bands: {}, features: {} } as unknown as Cinema2AudioIntelligenceFrame
      instance.lifecycle.update({ parameters, targets: {} as never, frame: {
        frameId: tick, elapsedTimeSec: time, timestampMs: time * 1000, deltaTimeSec: 1 / 60,
        viewport: { width: 840, height: 525, dpr: 1 }, contextGeneration: 1, audio, director: null,
        transport: { sourcePresent: true, playing: !paused, analysisActive: true, paused, animationActive: !paused, trackId: 'track', timeSec: time },
      } })
      return orbitalPattern(instance.inspect().activePattern)
    }
    expect(update(null)).toBe('gyroscopic-drift')
    const next = update('kick-1')
    expect(next).not.toBe('gyroscopic-drift')
    expect(update('kick-1')).toBe(next)
    expect(update('kick-2', true)).toBe(next)
    expect(update('kick-3')).not.toBe(next)
    expect(values.get('pattern')).toBe('gyroscopic-drift')
    values.set('patternChange', false)
    expect(update('kick-4')).toBe('gyroscopic-drift')
    instance.lifecycle.dispose()
  })

  it('releases the glyph lease when the companion sphere cannot load', async () => {
    const glyphAsset = { id: 'glyphs' } as Cinema2ThreeLoadedAsset
    const acquire = vi.fn().mockResolvedValueOnce(glyphAsset).mockRejectedValueOnce(new Error('unavailable'))
    const release = vi.fn()
    const { instance } = createModule({ assets: { acquire, release }, loadLibrary: async () => ({}) as never })
    instance.render!.providers[0]!.execute({ lightingEnvironment: { quality: 'high' } } as never)
    await vi.waitFor(() => expect(instance.inspect().state).toBe('failed'))
    expect(acquire.mock.calls.map(call => call[1])).toEqual(['cinema2-say-it-glyphs', 'cinema2-orbital-gyroscope'])
    expect(release).toHaveBeenCalledExactlyOnceWith(glyphAsset)
    instance.lifecycle.dispose()
    expect(release).toHaveBeenCalledTimes(1)
  })
})
