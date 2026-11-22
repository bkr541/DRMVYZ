import { describe, expect, it, vi } from 'vitest'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_ORBITAL_PRESET_ID, CINEMA2_ORBITAL_PRESET_MANIFEST } from '../presets/Cinema2OrbitalPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_ORBITAL_MODULE_TYPE_ID, createCinema2OrbitalNativeModuleDefinition } from '../modules/Cinema2OrbitalNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_ORBITAL_PATTERNS, CINEMA2_ORBITAL_POSITIONS, orbitalGlyphLine, orbitalPattern, orbitalPosition, resolveOrbitalGlyphs, resolveOrbitalPose, resolveOrbitalRing, type OrbitalMotionInput } from '../modules/orbital/Cinema2OrbitalMotion'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
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
    expect(manifest.parameters!.find(parameter => parameter.id === 'orbital-pattern')).toMatchObject({ defaultValue: 'gyroscopic-drift', options: CINEMA2_ORBITAL_PATTERNS, designParentGroup: 'design' })
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

  it('offers Position (Stacked or Linear) in place of Alignment, and only while two lines are selected', () => {
    expect(manifest.parameters!.some(parameter => parameter.id === 'orbital-alignment')).toBe(false)
    expect(manifest.parameters!.find(parameter => parameter.id === 'orbital-position')).toMatchObject({
      label: 'Position', type: 'enum', defaultValue: 'stacked', options: CINEMA2_ORBITAL_POSITIONS, designParentGroup: 'design',
      visibleWhen: [{ kind: 'parameter-equals', parameterId: 'orbital-line-mode', value: 'two' }],
    })
    expect(CINEMA2_ORBITAL_POSITIONS.map(option => option.label)).toEqual(['Stacked', 'Linear'])
    const compiled = compileCinema2NativePreset(manifest)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const position = () => createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot())
      .flatMap(parent => [...parent.controls, ...parent.groups.flatMap(group => group.controls)]).find(control => control.definition.id === 'orbital-position')
    expect(state.setPersistentValue('orbital-line-mode' as never, 'two').ok).toBe(true)
    expect(position()).toBeDefined()
    expect(state.setPersistentValue('orbital-line-mode' as never, 'one').ok).toBe(true)
    expect(position()).toBeUndefined()
    expect(orbitalPosition('linear')).toBe('linear')
    expect(orbitalPosition('center')).toBe('stacked')
  })

  describe('orbit', () => {
    const word = (line: number, count: number, y: number): Cinema2SayItGlyphPose[] => Array.from({ length: count }, (_, index) => ({
      id: `glyph-${line * 12 + index}`, character: 'A', mesh: 'glyph-A', position: [(index - (count - 1) / 2) * .8, y, 0], rotation: [0, 0, 0], scale: 1,
    }))
    const two = [...word(0, 4, .5), ...word(1, 5, -.5)]
    const radius = 5
    const centerOf = (poses: readonly Cinema2SayItGlyphPose[], line: number) => {
      const own = poses.filter(pose => orbitalGlyphLine(pose.id) === line)
      return own.reduce((sum, pose) => [sum[0] + pose.position[0] / own.length, sum[1] + pose.position[1] / own.length, sum[2] + pose.position[2] / own.length], [0, 0, 0])
    }

    it('reads the line from the glyph id, twelve characters to a line', () => {
      expect([orbitalGlyphLine('glyph-0'), orbitalGlyphLine('glyph-11'), orbitalGlyphLine('glyph-12'), orbitalGlyphLine('glyph-23'), orbitalGlyphLine('nonsense')]).toEqual([0, 0, 1, 1, 0])
    })

    it('puts every letter on the ring, facing outward, and travels it as the angle grows', () => {
      for (const angle of [0, 1.1, 3.4]) for (const position of ['stacked', 'linear'] as const) {
        for (const [index, glyph] of resolveOrbitalRing(two, { radius, angle, position }).entries()) {
          expect(Math.hypot(glyph.position[0], glyph.position[2])).toBeCloseTo(radius, 6)
          expect(glyph.rotation[1]).toBeCloseTo(two[index]!.position[0] / radius + angle + (position === 'linear' && orbitalGlyphLine(glyph.id) === 1 ? Math.PI : 0), 6)
        }
      }
      const start = centerOf(resolveOrbitalRing(two, { radius, angle: 0, position: 'stacked' }), 0), later = centerOf(resolveOrbitalRing(two, { radius, angle: Math.PI / 2, position: 'stacked' }), 0)
      expect(start[0]).toBeCloseTo(0, 6); expect(start[2]).toBeGreaterThan(radius * .9)
      expect(later[0]).toBeGreaterThan(radius * .9)
    })

    it('Stacked is the layout as authored: two lines on one arc, one above the other', () => {
      const ring = resolveOrbitalRing(two, { radius, angle: 0, position: 'stacked' })
      expect(centerOf(ring, 0)[1]).toBeCloseTo(.5, 6)
      expect(centerOf(ring, 1)[1]).toBeCloseTo(-.5, 6)
      expect(Math.sign(centerOf(ring, 0)[2])).toBe(Math.sign(centerOf(ring, 1)[2]))
      expect(Math.abs(centerOf(ring, 0)[0])).toBeLessThan(.05)
      expect(Math.abs(centerOf(ring, 1)[0])).toBeLessThan(.05)
    })

    it('Linear puts both lines on one row, opposite each other: one in front, one behind', () => {
      const ring = resolveOrbitalRing(two, { radius, angle: 0, position: 'linear' })
      expect(centerOf(ring, 0)[1]).toBeCloseTo(centerOf(ring, 1)[1], 6)
      expect(centerOf(ring, 0)[2]).toBeGreaterThan(radius * .9)
      expect(centerOf(ring, 1)[2]).toBeLessThan(-radius * .9)
      // A turn of half the ring swaps them.
      const half = resolveOrbitalRing(two, { radius, angle: Math.PI, position: 'linear' })
      expect(centerOf(half, 0)[2]).toBeLessThan(-radius * .9)
      expect(centerOf(half, 1)[2]).toBeGreaterThan(radius * .9)
    })

    it('treats one line the same in either position', () => {
      const one = word(0, 6, 0)
      expect(resolveOrbitalRing(one, { radius, angle: .7, position: 'linear' })).toEqual(resolveOrbitalRing(one, { radius, angle: .7, position: 'stacked' }))
    })
  })
})
