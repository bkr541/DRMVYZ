import { describe, expect, it } from 'vitest'

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2CameraManifest,
  type Cinema2CameraTempoManifest,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'

const CAMERA_ID = cinema2StableId<Cinema2CameraId>('tempo-camera')
const AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('tempo-amount')
const SYNC_ID = cinema2StableId<Cinema2ParameterId>('tempo-sync')

const PATH = [
  { position: [0, 1, 0], target: [0, 1, -10] },
  { position: [0, 1, -100], target: [0, 1, -110] },
] as const

function manifest(camera: Partial<Cinema2CameraManifest>): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.camera-tempo-test'),
    revision: 1,
    metadata: { name: 'camera tempo' },
    parameters: [
      { id: AMOUNT_ID, label: 'Motion', type: 'float', defaultValue: 1, min: 0, max: 2 },
      { id: SYNC_ID, label: 'Sync', type: 'boolean', defaultValue: true },
    ],
    cameras: [{
      id: CAMERA_ID, label: 'Tempo', projection: 'perspective', target: [0, 0, 0], fovDegrees: 60,
      rig: { kind: 'fly', points: PATH, durationSeconds: 100, loop: false },
      motion: { tempo: { referenceBpm: 120, flightSpeed: true, minRate: 0.75, maxRate: 1.45, weave: 2, bob: 0.3, roll: 1.5, fov: 1, punch: 3 } },
      controls: { motionAmount: cinema2Ref(AMOUNT_ID), tempoSync: cinema2Ref(SYNC_ID) },
      ...camera,
    }],
    defaults: { camera: cinema2Ref(CAMERA_ID) },
  } as Cinema2NativePresetManifest
}

function build(camera: Partial<Cinema2CameraManifest> = {}) {
  const compiled = compileCinema2NativePreset(manifest(camera))
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(entry => `${entry.path}: ${entry.message}`).join('; '))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
  })
  const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
  return { state, camera: new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial) }
}

interface Music { bpm: number; kickId?: string; kickStrength?: number }

/** A frame at `t` seconds; a track at `music.bpm` has its beat grid running from t = 0. */
function frame(t: number, music: Music | null, dt = 1 / 60): Cinema2ModuleFrameReadContext {
  const beats = music ? (t * music.bpm) / 60 : 0
  const signal = (value: number) => ({ available: true, value })
  const audio = music
    ? {
        discontinuity: { occurred: false, reason: null, generation: 1 },
        rhythm: {
          bpm: signal(music.bpm), beatIndex: signal(Math.floor(beats)), beatPhase: signal(beats - Math.floor(beats)),
          kick: music.kickId ? { id: music.kickId, strength: music.kickStrength ?? 1 } : null,
        },
      }
    : null
  return {
    frameId: Math.round(t * 60) + 1, timestampMs: t * 1000, deltaTimeSec: dt, elapsedTimeSec: t, viewport: { width: 800, height: 400, dpr: 1 },
    contextGeneration: 1, audio: audio as never, director: null,
  } as Cinema2ModuleFrameReadContext
}

function run(camera: Cinema2CameraRuntime, seconds: number, music: Music | null, from = 0) {
  const frames = []
  for (let step = 0; step <= Math.round(seconds * 60); step += 1) frames.push(camera.update(frame(from + step / 60, music)))
  return frames
}

const zeroCrossings = (values: readonly number[]) => values.filter((value, index) => index > 0 && Math.sign(value) !== Math.sign(values[index - 1]!)).length

describe('Cinema 2.0 camera tempo motion', () => {
  it('is opt-in: without motion.tempo the camera is unchanged', () => {
    const plain = build({ motion: { drift: { position: 0 } }, controls: { motionAmount: cinema2Ref(AMOUNT_ID) } })
    const withZeroTempo = build({ motion: { tempo: { referenceBpm: 120, flightSpeed: false } } })
    const a = run(plain.camera, 5, { bpm: 150 })
    const b = run(withZeroTempo.camera, 5, { bpm: 150 })
    const lastA = a[a.length - 1]!
    const lastB = b[b.length - 1]!
    lastA.position.forEach((value: number, axis: number) => expect(lastB.position[axis]).toBeCloseTo(value, 9))
  })

  it('scales the sway with Camera Motion and holds still at 0', () => {
    const swayRange = (amount: number) => {
      const { camera, state } = build({ motion: { tempo: { weave: 2, bob: 0.3, roll: 1.5, fov: 1, punch: 0 } } })
      state.setPersistentValue(AMOUNT_ID, amount as never)
      const frames = run(camera, 16, { bpm: 120 })
      return { x: Math.max(...frames.map(f => f.position[0])) - Math.min(...frames.map(f => f.position[0])), roll: Math.max(...frames.map(f => f.rollDegrees)) - Math.min(...frames.map(f => f.rollDegrees)) }
    }
    const off = swayRange(0)
    const one = swayRange(1)
    const two = swayRange(2)
    expect(off.x).toBeLessThan(1e-3)
    expect(off.roll).toBeLessThan(1e-3)
    expect(one.x).toBeGreaterThan(3) // weave 2 -> about 4 units peak to peak
    expect(one.roll).toBeGreaterThan(2)
    expect(two.x).toBeGreaterThan(one.x * 1.8)
  })

  it('locks the sway to the track tempo when tempoSync is on, and free-runs at the reference tempo when off', () => {
    const crossings = (sync: boolean, bpm: number) => {
      const { camera, state } = build({ motion: { tempo: { weave: 2 } }, rig: { kind: 'static' } as never })
      state.setPersistentValue(SYNC_ID, sync as never)
      return zeroCrossings(run(camera, 40, { bpm }).map(f => f.position[0]))
    }
    const locked160 = crossings(true, 160)
    const locked100 = crossings(true, 100)
    const free160 = crossings(false, 160)
    const free100 = crossings(false, 100)
    // The weave takes 8 beats: at 160 BPM that is 3 s (about 26 crossings in 40 s), at 100 BPM 4.8 s (about 16), free-running at 120 BPM 4 s (about 20).
    expect(locked160).toBeGreaterThan(locked100 * 1.4)
    expect(Math.abs(free160 - free100)).toBeLessThanOrEqual(1)
    expect(locked160).toBeGreaterThan(free160 + 3)
    expect(locked100).toBeLessThan(free100 - 2)
  })

  it('runs the flight at the track tempo (clamped) with tempoSync on, and at the authored speed with it off', () => {
    const travelled = (sync: boolean, bpm: number) => {
      const { camera, state } = build({ motion: { tempo: { flightSpeed: true, minRate: 0.75, maxRate: 1.45 } } })
      state.setPersistentValue(SYNC_ID, sync as never)
      const frames = run(camera, 20, { bpm })
      return frames[0]!.position[2] - frames[frames.length - 1]!.position[2]
    }
    const authored = 20 // 100 units over 100 s
    expect(travelled(false, 170)).toBeCloseTo(authored, 0)
    expect(travelled(false, 70)).toBeCloseTo(authored, 0)
    const fast = travelled(true, 150) // rate 1.25
    expect(fast).toBeGreaterThan(authored * 1.15)
    expect(fast).toBeLessThan(authored * 1.3)
    expect(travelled(true, 240)).toBeLessThan(authored * 1.45) // clamped at 1.45 (and eased in)
    expect(travelled(true, 240)).toBeGreaterThan(authored * 1.3)
    expect(travelled(true, 60)).toBeGreaterThan(authored * 0.74)
    expect(travelled(true, 60)).toBeLessThan(authored * 0.85) // clamped at 0.75
  })

  it('never jumps when BPM Sync is toggled or the tempo changes mid-flight', () => {
    const { camera, state } = build({ motion: { tempo: { weave: 2, bob: 0.3, roll: 1.5, fov: 1, punch: 0, flightSpeed: true } } })
    let previous = camera.update(frame(0, { bpm: 90 }))
    let largest = 0
    for (let step = 1; step <= 60 * 30; step += 1) {
      const t = step / 60
      if (step === 60 * 8) state.setPersistentValue(SYNC_ID, false as never)
      if (step === 60 * 14) state.setPersistentValue(SYNC_ID, true as never)
      const bpm = t < 20 ? 90 : 170 // a track change to a much faster tempo at 20 s
      const next = camera.update(frame(t, { bpm }))
      largest = Math.max(largest, Math.hypot(next.position[0] - previous.position[0], next.position[1] - previous.position[1], next.position[2] - previous.position[2]))
      previous = next
    }
    // One frame of flight is about 0.03 units; anything near 1 would be a visible cut.
    expect(largest).toBeLessThan(0.25)
  })

  it('punches the FOV in on every kick, in proportion to its strength, and lets it recover', () => {
    const { camera } = build({ motion: { tempo: { punch: 3, fov: 0 } } , rig: { kind: 'static' } as never })
    run(camera, 2, { bpm: 120 })
    const before = camera.update(frame(2.05, { bpm: 120 })).fovDegrees
    const hit = camera.update(frame(2.1, { bpm: 120, kickId: 'k1', kickStrength: 1 })).fovDegrees
    expect(before - hit).toBeGreaterThan(1.5)
    const same = camera.update(frame(2.12, { bpm: 120, kickId: 'k1', kickStrength: 1 })).fovDegrees
    expect(same).toBeGreaterThanOrEqual(hit) // the same event id does not punch again
    let later = same
    for (let step = 0; step < 60; step += 1) later = camera.update(frame(2.13 + step / 60, { bpm: 120 })).fovDegrees
    expect(Math.abs(later - before)).toBeLessThan(0.3)
    const soft = camera.update(frame(4, { bpm: 120, kickId: 'k2', kickStrength: 0.3 })).fovDegrees
    expect(before - soft).toBeLessThan((before - hit) * 0.6)
  })

  it('needs no music to move: it free-runs at the reference tempo, so Camera Motion always does something', () => {
    const { camera } = build({ motion: { tempo: { weave: 2 } }, rig: { kind: 'static' } as never })
    const xs = run(camera, 12, null).map(f => f.position[0])
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(3)
  })
})

describe('Cinema 2.0 camera tempo validation', () => {
  const compile = (camera: Partial<Cinema2CameraManifest>) => compileCinema2NativePreset(manifest(camera))
  const codes = (camera: Partial<Cinema2CameraManifest>) => {
    const result = compile(camera)
    return result.ok ? [] : result.diagnostics.map(entry => entry.code)
  }

  it('accepts a well-formed tempo block and a tempoSync control', () => {
    expect(compile({}).ok).toBe(true)
  })

  it('rejects out-of-range or malformed tempo values', () => {
    const tempo = (patch: Record<string, unknown>) => ({ motion: { tempo: patch as Cinema2CameraTempoManifest } })
    expect(codes(tempo({ referenceBpm: 10 }))).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes(tempo({ weave: -1 }))).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes(tempo({ minRate: 2, maxRate: 1 }))).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes(tempo({ flightSpeed: 'yes' }))).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes({ ...tempo({ flightSpeed: true }), rig: { kind: 'static' } as never })).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
  })

  it('requires motion.tempo for the tempoSync control and a toggle or number parameter', () => {
    expect(codes({ motion: { drift: { position: 0.1 } } })).toContain('CINEMA2_PRESET_CAMERA_CONTROLS_INVALID')
  })
})
