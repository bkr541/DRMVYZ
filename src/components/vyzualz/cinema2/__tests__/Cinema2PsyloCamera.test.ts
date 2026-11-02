import { describe, expect, it } from 'vitest'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { Matrix4, Vector3, Box3 } from 'three'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_PSYLO_PRESET_MANIFEST as manifest, psyloParameterId } from '../presets/Cinema2PsyloPreset'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { PSYLO_MAX_DISPLACEMENT, PSYLO_MAX_SCALE } from '../modules/psylo/Cinema2PsyloDomain'

function setup() {
  const compiled = compileCinema2NativePreset(manifest)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId) })
  const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
  const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial)
  let elapsed = 0
  const set = (key: string, value: string | number | boolean) => state.setPersistentValue(psyloParameterId(key), value)
  const tick = (seconds = .1, paused = false, bpm = 100, sourcePresent = true) => {
    elapsed += seconds
    const frame: Cinema2ModuleFrameReadContext = {
      frameId: Math.round(elapsed * 100) + 1, timestampMs: elapsed * 1000, elapsedTimeSec: elapsed, deltaTimeSec: seconds,
      viewport: { width: 1440, height: 810, dpr: 1 }, contextGeneration: 1, audio: null, director: null,
      transport: { sourcePresent, playing: !paused, paused, animationActive: !paused, analysisActive: false, trackId: sourcePresent ? 'fixture' : null, timeSec: elapsed, bpm, bpmSync: false },
    }
    return camera.update(frame)
  }
  return { camera, set, tick }
}
describe('PSYLO authored camera modes', () => {
  it('moves on every moving rig, holds fixed, and honors hard enable/speed/pause', () => {
    for (const mode of ['travel', 'orbit', 'elevated', 'fixed']) {
      const c = setup(); c.set('cameraMode', mode)
      const first = c.tick().position
      for (let i = 0; i < 80; i++) c.tick()
      const moved = c.camera.getFrame().position
      expect(new Vector3(...first).distanceTo(new Vector3(...moved)) > .05).toBe(mode !== 'fixed')
      c.set('cameraMotion', false); const held = c.tick().position
      for (let i = 0; i < 10; i++) c.tick()
      expect(c.camera.getFrame().position).toEqual(held)
      c.set('cameraMotion', true); c.set('cameraSpeed', 0); const stopped = c.tick().position
      for (let i = 0; i < 10; i++) c.tick()
      expect(c.camera.getFrame().position).toEqual(stopped)
      c.set('cameraSpeed', 1); const paused = c.tick(.1, true).position
      for (let i = 0; i < 10; i++) c.tick(.1, true)
      expect(c.camera.getFrame().position).toEqual(paused)
    }
  })
  it('supports opt-in no-source movement, continuous loops, mode changes and shared BPM Sync', () => {
    const idle = setup(); const start = idle.tick(.1, false, 100, false).position
    for (let i = 0; i < 30; i++) idle.tick(.1, false, 100, false)
    expect(idle.camera.getFrame().position).not.toEqual(start)
    for (const mode of ['travel', 'orbit', 'elevated']) {
      idle.set('cameraMode', mode)
      let previous = idle.tick().position
      for (let i = 0; i < 800; i++) {
        const current = idle.tick().position
        expect(new Vector3(...previous).distanceTo(new Vector3(...current))).toBeLessThan(.5)
        previous = current
      }
    }
    const sync = setup(), free = setup(); free.set('bpmSync', false)
    for (let i = 0; i < 60; i++) { sync.tick(.1, false, 180); free.tick(.1, false, 180) }
    expect(new Vector3(...sync.camera.getFrame().position).distanceTo(new Vector3(...free.camera.getFrame().position))).toBeGreaterThan(1)
  })
  it('rejects invalid generic rig-selector bindings instead of silently ignoring them', () => {
    const bad = { ...manifest, cameras: manifest.cameras!.map(c => ({ ...c, rigVariants: { ...c.rigVariants, orbit: { kind: 'orbit' as const, radius: -1 } } })) }
    expect(compileCinema2NativePreset(bad).ok).toBe(false)
    const missing = { ...manifest, cameras: manifest.cameras!.map(c => ({ ...c, rigVariants: { travel: c.rig! } })) }
    expect(compileCinema2NativePreset(missing).ok).toBe(false)
  })
  it('clears actual source geometry throughout paths and orbit extremes at maximum deformation', async () => {
    await MeshoptDecoder.ready
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const doc = await io.read('public/cinema2/models/psylo-static.glb')
    // Height-sliced per-plant bounds avoid treating empty space beneath cap
    // overhangs as solid. Expand every slice for max scale + displacement + lens.
    const boxes = new Map<string, Box3>(), value: number[] = [], root: number[] = []
    let stationaryCeiling = -Infinity
    for (const node of doc.getRoot().listNodes()) {
      const matrix = new Matrix4().fromArray(node.getWorldMatrix())
      for (const p of node.getMesh()?.listPrimitives() ?? []) {
        const positions = p.getAttribute('POSITION')!, ids = p.getAttribute('_PSYLO_ID')!, roots = p.getAttribute('_PSYLO_ROOT')!
        for (let i = 0; i < positions.getCount(); i++) {
          const id = ids.getScalar(i)
          positions.getElement(i, value); roots.getElement(i, root)
          const point = new Vector3(...value as [number, number, number]).applyMatrix4(matrix)
          if (id < 0) { stationaryCeiling = Math.max(stationaryCeiling, point.y); continue }
          point.sub(new Vector3(...root as [number, number, number])).multiplyScalar(PSYLO_MAX_SCALE).add(new Vector3(...root as [number, number, number]))
          const lower = point.clone().sub(new Vector3(...root as [number, number, number])).multiplyScalar(.8 / PSYLO_MAX_SCALE).add(new Vector3(...root as [number, number, number]))
          for (let bin = Math.floor(lower.y / .4); bin <= Math.floor(point.y / .4); bin++) {
            const key = `${id}:${bin}`
            const box = boxes.get(key) ?? new Box3(); box.expandByPoint(point); box.expandByPoint(lower); boxes.set(key, box)
          }
        }
      }
    }
    for (const box of boxes.values()) box.expandByScalar(PSYLO_MAX_DISPLACEMENT + .3)
    const c = setup(); const collisions: string[] = []
    for (const [mode, radius, elevation] of [['fixed', 18, 45], ['travel', 18, 45], ['elevated', 18, 45], ['orbit', 14, 40], ['orbit', 22, 40], ['orbit', 14, 60], ['orbit', 22, 60]] as const) {
      c.set('cameraMode', mode); c.set('radius', radius); c.set('elevation', elevation)
      for (let i = 0; i < 900; i++) {
        const frame = c.tick(.1), point = new Vector3(...frame.position)
        if (frame.position[1] <= stationaryCeiling + .3) collisions.push(`${mode}: terrain/stone/groundcover clearance`)
        for (const [key, box] of boxes) if (box.containsPoint(point)) collisions.push(`${mode}: ${key} at ${point.toArray().map(v => v.toFixed(2))}`)
      }
    }
    expect(collisions.slice(0, 12)).toEqual([])
  }, 15000)
})
