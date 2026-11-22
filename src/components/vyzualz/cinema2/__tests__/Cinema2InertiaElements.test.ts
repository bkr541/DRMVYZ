import { describe, expect, it } from 'vitest'
import { Cinema2InertiaFlow } from '../modules/inertia/Cinema2InertiaFlow'
import { INERTIA_EXTRA_ROLES, INERTIA_EXTRA_STRIDE, InertiaExtras, type InertiaExtrasInput } from '../modules/inertia/Cinema2InertiaExtras'
import { INERTIA_DEFORM_GLSL } from '../modules/inertia/Cinema2InertiaMotion'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_INERTIA_PRESET_MANIFEST, INERTIA_ELEMENT_CONTROLS, inertiaParameterId } from '../presets/Cinema2InertiaPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

let frameId = 0
function frame(options: { paused?: boolean; present?: boolean; bpm?: number | null; delta?: number } = {}): Cinema2ModuleFrameReadContext {
  return { frameId: ++frameId, timestampMs: frameId * 100, elapsedTimeSec: frameId / 10, deltaTimeSec: options.delta ?? 0.1, contextGeneration: 1,
    viewport: { width: 954, height: 954, dpr: 1 }, audio: null, director: null,
    transport: { sourcePresent: options.present ?? true, playing: !options.paused, paused: !!options.paused, animationActive: !options.paused, analysisActive: false,
      timeSec: frameId / 10, bpm: options.bpm === undefined ? 120 : options.bpm, bpmSync: true, trackId: 'elements' } } as unknown as Cinema2ModuleFrameReadContext
}
const input: InertiaExtrasInput = { clock: 3, rings: .8, dial: .6, dust: .6, inner: .7, coreSize: 1, push: 0 }
const points = (extras: InertiaExtras, options: Partial<InertiaExtrasInput> = {}) => {
  const out = new Float32Array(extras.capacity * INERTIA_EXTRA_STRIDE)
  const count = extras.fill(out, { ...input, ...options })
  return Array.from({ length: count }, (_, i) => ({ x: out[i * 5]!, y: out[i * 5 + 1]!, z: out[i * 5 + 2]!, role: out[i * 5 + 3]!, gain: out[i * 5 + 4]! }))
}
const count = (list: ReturnType<typeof points>, role: number) => list.filter(point => point.role === role).length

describe('Inertia flow clock', () => {
  it('runs in beats at the track tempo, at 120 BPM without one, scaled by Motion Speed, and stands still while paused', () => {
    const run = (bpm: number | null, speed = 1, sync = true) => { const flow = new Cinema2InertiaFlow(); let clock = 0; for (let i = 0; i < 10; i++) clock = flow.update(frame({ bpm }), sync, speed); return clock }
    expect(run(120)).toBeCloseTo(2, 6)
    expect(run(90)).toBeCloseTo(1.5, 6)
    expect(run(null)).toBeCloseTo(2, 6)
    expect(run(90, 1, false)).toBeCloseTo(2, 6)
    expect(run(120, 2)).toBeCloseTo(4, 6)
    expect(run(120, .25)).toBeCloseTo(.5, 6)
    const flow = new Cinema2InertiaFlow()
    const before = flow.update(frame(), true, 1)
    expect(flow.update(frame({ paused: true }), true, 1)).toBe(before)
    expect(flow.update(frame(), true, 1)).toBeGreaterThan(before)
    // It runs with no track at all (the sculpture is alive without music), and one frame is counted once.
    // With no track the runtime gives no frame delta (0 here), so it runs on the frame timestamps; one frame is counted once.
    const idle = new Cinema2InertiaFlow()
    idle.update(frame({ present: false, delta: 0 }), true, 1)
    const same = frame({ present: false, delta: 0 }), moved = idle.update(same, true, 1)
    expect(moved).toBeCloseTo(.2, 6)
    expect(idle.update(same, true, 1)).toBe(moved)
    // A track whose analysis is not running reports no delta either, and the clock holds.
    const held = new Cinema2InertiaFlow(); held.update(frame({ delta: 0 }), true, 1)
    expect(held.update(frame({ delta: 0 }), true, 1)).toBe(0)
  })
})

describe('Inertia extra elements', () => {
  it('builds orbit rings with a satellite each, a dial with a major mark every twelfth tick, dust and an inner shell, within a bounded count', () => {
    for (const quality of ['low', 'medium', 'high'] as const) {
      const extras = new InertiaExtras(quality), list = points(extras, { dust: 1 })
      expect(list.length).toBeLessThanOrEqual(extras.capacity)
      expect(count(list, INERTIA_EXTRA_ROLES.satellite)).toBe(3)
      expect(count(list, INERTIA_EXTRA_ROLES.dialMajor)).toBe(12)
      expect(count(list, INERTIA_EXTRA_ROLES.dial)).toBe(132)
      expect(count(list, INERTIA_EXTRA_ROLES.inner)).toBeGreaterThan(100)
      expect(count(list, INERTIA_EXTRA_ROLES.dust)).toBeGreaterThan(100)
      expect(count(list, INERTIA_EXTRA_ROLES.ring)).toBeGreaterThan(100)
    }
    expect(new InertiaExtras('low').capacity).toBeLessThan(new InertiaExtras('high').capacity)
  })

  it('keeps everything finite, the rings and shell inside the cage, and the dial and dust inside the frame', () => {
    const list = points(new InertiaExtras('medium'), { dust: 1 })
    for (const point of list) {
      for (const value of [point.x, point.y, point.z, point.gain]) expect(Number.isFinite(value)).toBe(true)
      expect(point.gain).toBeGreaterThan(0)
      const radius = Math.hypot(point.x, point.y, point.z)
      if (point.role === INERTIA_EXTRA_ROLES.ring || point.role === INERTIA_EXTRA_ROLES.satellite) expect(radius).toBeLessThanOrEqual(.69)
      if (point.role === INERTIA_EXTRA_ROLES.inner) expect(radius).toBeLessThan(.16)
      if (point.role === INERTIA_EXTRA_ROLES.dial || point.role === INERTIA_EXTRA_ROLES.dialMajor) expect(radius).toBeCloseTo(.96, 5)
      if (point.role === INERTIA_EXTRA_ROLES.dust) { expect(radius).toBeLessThan(1.5 * 1.55); expect(Math.abs(point.y)).toBeLessThan(1.3) }
    }
  })

  it('moves with the clock, stands still without it, is the same field every time, and follows each control down to zero', () => {
    const extras = new InertiaExtras('medium')
    const a = points(extras, { clock: 3 }), b = points(extras, { clock: 3 }), c = points(extras, { clock: 3.7 })
    expect(a).toEqual(b)
    expect(c).not.toEqual(a)
    expect(points(new InertiaExtras('medium'), { clock: 3 })).toEqual(a)
    expect(count(points(extras, { rings: 0 }), INERTIA_EXTRA_ROLES.ring)).toBe(0)
    expect(count(points(extras, { rings: 0 }), INERTIA_EXTRA_ROLES.satellite)).toBe(0)
    expect(count(points(extras, { dial: 0 }), INERTIA_EXTRA_ROLES.dial)).toBe(0)
    expect(count(points(extras, { dust: 0 }), INERTIA_EXTRA_ROLES.dust)).toBe(0)
    expect(count(points(extras, { inner: 0 }), INERTIA_EXTRA_ROLES.inner)).toBe(0)
    expect(points(extras, { rings: 0, dial: 0, dust: 0, inner: 0 })).toHaveLength(0)
    // Dust is a density: half the control shows about half the field.
    const all = count(points(extras, { dust: 1 }), INERTIA_EXTRA_ROLES.dust), half = count(points(extras, { dust: .5 }), INERTIA_EXTRA_ROLES.dust)
    expect(half / all).toBeGreaterThan(.4); expect(half / all).toBeLessThan(.6)
  })

  it('lights each satellite with a comet tail that fades behind it, and pushes the rings outward with the kick', () => {
    const extras = new InertiaExtras('medium')
    const rings = points(extras).filter(point => point.role === INERTIA_EXTRA_ROLES.ring)
    expect(Math.max(...rings.map(point => point.gain))).toBeGreaterThan(.5)
    expect(Math.min(...rings.map(point => point.gain))).toBeLessThan(.3)
    const radius = (list: ReturnType<typeof points>) => Math.max(...list.filter(point => point.role === INERTIA_EXTRA_ROLES.ring).map(point => Math.hypot(point.x, point.y, point.z)))
    expect(radius(points(extras, { push: .05 }))).toBeGreaterThan(radius(points(extras, { push: 0 })) * 1.05)
  })

  it('turns the inner shell against the core and the core waves into the shared shader', () => {
    const extras = new InertiaExtras('medium')
    const shell = (clock: number) => points(extras, { clock, rings: 0, dial: 0, dust: 0 })
    expect(shell(1)).not.toEqual(shell(2))
    for (const name of ['u_clock', 'u_coreMotion', 'u_coreKick', 'coreAnimate']) expect(INERTIA_DEFORM_GLSL).toContain(name)
    // Animation applies to the core only, and only when Core Motion is on, so the cage and the still core are exactly as they were.
    expect(INERTIA_DEFORM_GLSL).toContain('if (core) return coreAnimate(p) * u_coreSize;')
    expect(INERTIA_DEFORM_GLSL).toContain('if (m <= 0.0) return p;')
  })
})

describe('Inertia preset: elements and camera', () => {
  const control = (label: string) => CINEMA2_INERTIA_PRESET_MANIFEST.parameters!.find(parameter => parameter.label === label)!

  it('exposes the core and element controls in Design with defaults that show them, bound to the module, and each can be taken to zero', () => {
    const module = CINEMA2_INERTIA_PRESET_MANIFEST.modules![0]!
    for (const [key, property, label, value, group] of INERTIA_ELEMENT_CONTROLS) {
      expect(control(label), label).toMatchObject({ type: 'float', designParentGroup: 'design', group, defaultValue: value, min: 0, max: 1 })
      expect(module.parameterBindings![property]).toEqual({ $ref: inertiaParameterId(key) })
      expect(module.parameters![property]).toBe(value)
      expect(value).toBeGreaterThan(0)
    }
    expect(['Orbits', 'Dust and Dial'].map(label => control(label).type)).toEqual(['color', 'color'])
    expect(module.parameterBindings!['orbitColor']).toBeDefined(); expect(module.parameterBindings!['dustColor']).toBeDefined()
  })

  it('moves the camera: Sway by default, Orbit, or Locked on the original front view, with a speed that follows the tempo', () => {
    const camera = CINEMA2_INERTIA_PRESET_MANIFEST.cameras![0]!
    expect(camera.projection).toBe('orthographic'); expect(camera.orthographicHeight).toBe(2)
    expect(control('Camera Mode')).toMatchObject({ type: 'enum', defaultValue: 'sway', group: 'Camera' })
    expect(control('Camera Mode').options!.map(option => option.value)).toEqual(['sway', 'orbit', 'locked'])
    expect(camera.rig).toMatchObject({ kind: 'path', loop: true })
    expect(Object.keys(camera.rigVariants!)).toEqual(['sway', 'orbit', 'locked'])
    expect(camera.rigVariants!['locked']).toEqual({ kind: 'static' })
    expect(camera.rigVariants!['orbit']).toMatchObject({ kind: 'orbit', radius: 4 })
    expect(camera.controls).toMatchObject({ rigMode: { $ref: inertiaParameterId('camera-mode') }, motionSpeed: { $ref: inertiaParameterId('camera-speed') }, tempoSync: { $ref: inertiaParameterId('bpm-sync') } })
    expect(camera.motion).toMatchObject({ idleMotion: true })
    expect(control('Camera Speed').visibleWhen).toEqual([{ kind: 'parameter-not-equals', parameterId: inertiaParameterId('camera-mode'), value: 'locked' }])
    // Every point on the sway path is 4 units from the sculpture, looking at its centre, and the loop starts near the original front view.
    const points = (camera.rig as unknown as { points: { position: number[]; target: number[] }[] }).points
    for (const point of points) { expect(Math.hypot(...point.position)).toBeCloseTo(4, 6); expect(point.target).toEqual([0, 0, 0]) }
    expect(points[0]!.position[2]).toBeGreaterThan(3.9)
  })

  it('still compiles, registers, and keeps the original pattern, effects and audio routes', () => {
    expect(compileCinema2NativePreset(CINEMA2_INERTIA_PRESET_MANIFEST).ok).toBe(true)
    expect(cinema2NativePresetRegistry.compile(CINEMA2_INERTIA_PRESET_MANIFEST.id).ok).toBe(true)
    expect(control('Pattern').options).toHaveLength(6)
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.effects!.map(effect => String(effect.id))).toEqual(['inertia-trails', 'inertia-bloom'])
  })
})
