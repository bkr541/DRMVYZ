import { beforeAll, describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { bakeCinema2BlockshiftModel, CINEMA2_BLOCKSHIFT_MODEL_IDS, type Cinema2BlockshiftModel } from '../modules/blockshift/Cinema2BlockshiftModels'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { CINEMA2_BLOCKSHIFT_BLOCKS, CINEMA2_BLOCKSHIFT_PALETTE } from '../modules/blockshift/Cinema2BlockshiftDomain'
import { buildCinema2BlockshiftLayout, packCinema2BlockshiftInstances, cinema2BlockshiftHalfExtents } from '../modules/blockshift/Cinema2BlockshiftLayout'
import { Cinema2BlockshiftRenderer } from '../modules/blockshift/Cinema2BlockshiftRenderer'
import { createCinema2BlockshiftNativeModuleDefinition, type Cinema2BlockshiftModuleInstance } from '../modules/Cinema2BlockshiftNativeModule'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ModuleResourceScope } from '../modules/Cinema2ModuleResources'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_BLOCKSHIFT_PRESET_MANIFEST as manifest } from '../presets/Cinema2BlockshiftPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'

let models: Cinema2BlockshiftModel[]
beforeAll(async () => {
  models = await Promise.all(['hallow', 'impossible'].map(async (name, index) => {
    const source = await readFile(`docs/BLOCKSHIFT/${name}_cube.glb`)
    expect(source.equals(await readFile(`public/cinema2/models/blockshift-${name}-cube.glb`))).toBe(true)
    const gltf = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer, '')
    return bakeCinema2BlockshiftModel({ THREE } as Cinema2ThreeLibrary, { id: CINEMA2_BLOCKSHIFT_MODEL_IDS[index]!, scene: gltf.scene })
  }))
})

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const frame: Cinema2ModuleFrameReadContext = { frameId: 1, timestampMs: 0, deltaTimeSec: 0, elapsedTimeSec: 0, contextGeneration: 1, viewport: { width: 960, height: 540, dpr: 1 }, audio: null, director: null }

describe('BLOCKSHIFT native preview', () => {
  it('compiles its world/color/depth graph and is registered as an explicitly unfinished reference preview', () => {
    const compiled = compileCinema2NativePreset(manifest)
    expect(compiled.ok, JSON.stringify(compiled.diagnostics)).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({ role: 'reference', manifest }).ok).toBe(true)
    expect(cinema2NativeModuleRegistry.validateModules(manifest.modules ?? []).ok).toBe(true)
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.some(entry => entry.manifest.id === manifest.id && entry.role === 'reference')).toBe(true)
    expect(manifest.effects?.map(effect => effect.typeId)).toEqual(['volumetric-atmosphere', 'hdr-bloom'])
    expect(manifest.effects?.[1]?.parameterBindings?.intensity?.$ref).toBe('blockshift-bloom')
    expect(manifest.render?.targets?.[0]?.descriptor).toMatchObject({ colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8', depthFormat: 'depth24' })
    expect(manifest.choreography?.rules).toHaveLength(20)
    expect(manifest.render?.passes[0]?.outputs?.map(output => output.attachment)).toEqual(['color', 'depth'])
  })

  it('keeps fifteen deterministic identities, the enlarged side length, and independent edge groups', () => {
    const layout = buildCinema2BlockshiftLayout()
    expect(layout).toEqual(buildCinema2BlockshiftLayout())
    expect(layout.map(block => block.id)).toEqual(CINEMA2_BLOCKSHIFT_BLOCKS.map(block => block.id))
    expect(new Set(layout.map(block => block.id)).size).toBe(15)
    expect(layout.every(block => block.size === 1.35 * 6)).toBe(true)
    expect(new Set(layout.map(block => block.position[2])).size).toBeGreaterThan(2)
    const packed = packCinema2BlockshiftInstances(layout)
    expect(packed).toHaveLength(180)
    expect(packed.every(Number.isFinite)).toBe(true)
    expect(new Set(layout.map(block => block.edgeRole)).size).toBe(3)
    expect(() => packCinema2BlockshiftInstances([...layout].reverse())).toThrow(/identity/)
  })

  it('keeps the static control-envelope corners separated and framed', () => {
    for (const blockSize of [1.05, 1.35, 1.8, 3]) for (const spread of [0.5, 1, 1.8, 3]) for (const depth of [0, 0.45, 1]) {
      const layout = buildCinema2BlockshiftLayout({ blockSize, spread, depth })
      const radius = Math.sqrt(3) * blockSize * 6 / 2
      for (const block of layout) {
        expect(Math.hypot(...block.position) + radius).toBeLessThanOrEqual(300)
        expect(Math.hypot(...block.position) - radius).toBeGreaterThanOrEqual(2 - 1e-9)
        for (const other of layout.slice(0, block.index)) {
          expect(block.position.some((value, axis) => {
            const extent = (candidate: typeof block) => cinema2BlockshiftHalfExtents(candidate)[axis]!
            return Math.abs(value - other.position[axis]!) >= extent(block) + extent(other) + 1.5 - 1e-9
          })).toBe(true)
        }
      }
    }
    expect(() => buildCinema2BlockshiftLayout({ blockSize: NaN })).toThrow(/finite/)
    expect(() => buildCinema2BlockshiftLayout({ spread: -1 })).toThrow()
  })

  it.each([[1920, 1080], [1080, 1080], [1080, 1920]])('places the observer inside the field with large visible foreground and rear objects at %sx%s', (width, height) => {
    const result = compileCinema2NativePreset(manifest)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    const state = new Cinema2ParameterState(result.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(result.plan.targets, { resolveBaseValue: target => target.authoredBaseValue })
    const spatial = new Cinema2SpatialRuntime(result.plan.scene, result.plan.targets.targets, resolver)
    const camera = new Cinema2CameraRuntime(result.plan, state, resolver, spatial)
    const matrix = camera.update({ ...frame, viewport: { width, height, dpr: 1 } }).viewProjectionMatrix
    expect(manifest.cameras![0]!.transform!.position).toEqual([0, 0, 0])
    for (const pattern of ['stack', 'orbit', 'stagger', 'split', 'wave', 'collapse'] as const) {
      const blocks = buildCinema2BlockshiftLayout({ pattern })
      for (const axis of [0, 1, 2]) {
        expect(blocks.some(block => block.position[axis]! > 0)).toBe(true)
        expect(blocks.some(block => block.position[axis]! < 0)).toBe(true)
      }
      expect(blocks.filter(block => block.position[2] > 0).length).toBeGreaterThanOrEqual(3)
      let visible = 0, foreground = 0
      for (const block of blocks.filter(block => block.position[2] < 0)) {
        const projected = []
        for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
          const point = [block.position[0] + x * block.size, block.position[1] + y * block.size, block.position[2] + z * block.size, 1]
          const clip = [0, 1, 3].map(row => point.reduce((sum, value, col) => sum + value * matrix[col * 4 + row]!, 0))
          if (clip[2]! > 0) projected.push([clip[0]! / clip[2]!, clip[1]! / clip[2]!])
        }
        const xs = projected.map(p => p[0]!), ys = projected.map(p => p[1]!)
        if (Math.min(...xs) < 1 && Math.max(...xs) > -1 && Math.min(...ys) < 1 && Math.max(...ys) > -1) {
          visible++
          if ((Math.max(...ys) - Math.min(...ys)) * height / 2 > Math.min(width, height) * 0.2) foreground++
        }
      }
      expect(visible, pattern).toBeGreaterThanOrEqual(3)
      expect(foreground, pattern).toBeGreaterThanOrEqual(2)
    }
  })

  it('draws fourteen Hallow Cubes and one Impossible Cube in four material batches without per-frame allocation', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new Cinema2BlockshiftRenderer(gl, packCinema2BlockshiftInstances(buildCinema2BlockshiftLayout()), models)
    const allocated = gl.__calls.createdBuffers
    renderer.draw(identity, CINEMA2_BLOCKSHIFT_PALETTE.blockBody)
    renderer.draw(identity, CINEMA2_BLOCKSHIFT_PALETTE.blockBody)
    expect(gl.drawElementsInstanced).toHaveBeenNthCalledWith(1, gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, 14)
    expect(gl.drawElementsInstanced).toHaveBeenNthCalledWith(2, gl.TRIANGLES, 132, gl.UNSIGNED_SHORT, 0, 14)
    expect(gl.drawElementsInstanced).toHaveBeenNthCalledWith(3, gl.TRIANGLES, 5226, gl.UNSIGNED_SHORT, 0, 1)
    expect(gl.drawElementsInstanced).toHaveBeenNthCalledWith(4, gl.TRIANGLES, 16758, gl.UNSIGNED_SHORT, 0, 1)
    renderer.updateInstances(packCinema2BlockshiftInstances(buildCinema2BlockshiftLayout({ pattern: 'split' })))
    expect(gl.__calls.createdBuffers).toBe(allocated)
    expect(gl.uniform4fv).toHaveBeenCalledWith(expect.anything(), expect.any(Float32Array))
    expect(renderer.estimateGpuBytes()).toBeLessThan(1024 * 1024)
    renderer.dispose()
    renderer.dispose()
    expect(gl.__calls.deletedBuffers).toBe(allocated)
    expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays)
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
  })

  it('preserves both supplied models and normalizes their transformed geometry into the existing safety envelope', () => {
    expect(models.map(model => model.id)).toEqual(CINEMA2_BLOCKSHIFT_MODEL_IDS)
    expect(models.map(model => (model.body.indices.length + model.frame.indices.length) / 3)).toEqual([56, 7328])
    for (const model of models) {
      expect(model.frame.ledCoordinates).toHaveLength(model.frame.vertices.length / 2)
      expect(model.frame.ledCoordinates!.every(Number.isFinite)).toBe(true)
      const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity]
      for (const part of [model.body, model.frame]) for (let offset = 0; offset < part.vertices.length; offset += 6) {
        expect(Math.hypot(...part.vertices.slice(offset, offset + 3))).toBeLessThanOrEqual(Math.sqrt(3) / 2 + 1e-6)
        expect(Math.hypot(...part.vertices.slice(offset + 3, offset + 6))).toBeCloseTo(1)
        for (let axis = 0; axis < 3; axis++) {
          minimum[axis] = Math.min(minimum[axis]!, part.vertices[offset + axis]!)
          maximum[axis] = Math.max(maximum[axis]!, part.vertices[offset + axis]!)
        }
      }
      for (let axis = 0; axis < 3; axis++) expect((minimum[axis]! + maximum[axis]!) / 2).toBeCloseTo(0)
      expect(Math.max(...maximum.map((value, axis) => value - minimum[axis]!))).toBeCloseTo(1)
    }
  })

  it('cleans partial GPU allocations if renderer creation fails', () => {
    const gl = createCinemaMockWebGL()
    vi.mocked(gl.createBuffer).mockReturnValueOnce(null as unknown as WebGLBuffer)
    expect(() => new Cinema2BlockshiftRenderer(gl, packCinema2BlockshiftInstances(buildCinema2BlockshiftLayout()), models)).toThrow(/allocate/)
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
  })

  it('requires camera/depth, leases one renderer across passes, and retires it through the host scope', async () => {
    const gl = createCinemaMockWebGL()
    const diagnostics = vi.fn()
    const resources = new Cinema2ModuleResourceScope(gl, diagnostics)
    const renderer = { updateInstances: vi.fn(), draw: vi.fn(), dispose: vi.fn(), estimateGpuBytes: () => 1234 }
    const factory = vi.fn(() => renderer)
    const definition = createCinema2BlockshiftNativeModuleDefinition(factory, async () => models)
    const unused = () => { throw new Error('Unexpected use of an inactive P2 facet') }
    const context: Cinema2ModuleCreateContext = {
      module: manifest.modules![0]!, resources,
      parameters: { get: () => undefined, getAuthored: () => undefined, resolve: () => null },
      targets: { getTarget: () => null, resolve: unused, dispatch: unused },
      media: { get: () => null, getSlot: () => null },
      randomness: { sample: unused, probability: unused, stream: unused, eventStream: unused },
    }
    const instance = definition.create(context) as Cinema2BlockshiftModuleInstance
    const execute = instance.render!.providers[0]!.execute
    const execution = { frame, target: null, width: 960, height: 540 }
    expect(() => execute(execution)).toThrow(/depth/)
    expect(() => execute({ ...execution, depthAvailable: true })).toThrow(/camera/)
    const compiled = compileCinema2NativePreset(manifest)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const parameters = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.authoredBaseValue })
    const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
    const camera = new Cinema2CameraRuntime(compiled.plan, parameters, resolver, spatial).update(frame)
    execute({ ...execution, depthAvailable: true, camera })
    await Promise.resolve()
    execute({ ...execution, depthAvailable: true, camera })
    execute({ ...execution, depthAvailable: true, camera })
    expect(factory).toHaveBeenCalledTimes(1)
    expect(instance.inspect()).toMatchObject({ instanceCount: 15, drawCalls: 4, estimatedGpuBytes: 1234 })
    expect(resources.getSnapshot()).toMatchObject({ activeLeaseCount: 1, estimatedGpuBytes: 1234 })
    instance.lifecycle.dispose()
    resources.disposeAll()
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(resources.getSnapshot()).toMatchObject({ activeLeaseCount: 0, estimatedGpuBytes: 0 })
    expect(diagnostics).not.toHaveBeenCalled()
    expect(definition.validate?.({ ...manifest.modules![0]!, config: { blockCount: 10 } })).toHaveLength(1)
  })
  it('reports model failures and prevents late GPU allocation after disposal', async () => {
    const gl = createCinemaMockWebGL(), resources = new Cinema2ModuleResourceScope(gl, () => {})
    const factory = vi.fn()
    const base = { module: manifest.modules![0]!, resources, parameters: { get: () => undefined } } as unknown as Cinema2ModuleCreateContext
    const compiled = compileCinema2NativePreset(manifest)
    if (!compiled.ok) throw new Error('Compilation failed')
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.authoredBaseValue })
    const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)).update(frame)
    const execution = { frame, target: null, width: 960, height: 540, depthAvailable: true, camera }
    const failed = createCinema2BlockshiftNativeModuleDefinition(factory, async () => { throw new Error('Missing GLB') }).create(base)
    failed.render!.providers[0]!.execute(execution)
    await Promise.resolve(); await Promise.resolve()
    expect(failed.getDiagnostics?.()[0]?.code).toBe('CINEMA2_BLOCKSHIFT_MODEL_LOAD_FAILED')
    expect(factory).not.toHaveBeenCalled()
    let resolve!: (value: readonly Cinema2BlockshiftModel[]) => void
    const pending = new Promise<readonly Cinema2BlockshiftModel[]>(done => { resolve = done })
    const disposed = createCinema2BlockshiftNativeModuleDefinition(factory, () => pending).create(base)
    disposed.render!.providers[0]!.execute(execution)
    disposed.lifecycle.dispose()
    resolve(models); await Promise.resolve()
    disposed.render!.providers[0]!.execute(execution)
    expect(factory).not.toHaveBeenCalled()
    resources.disposeAll()
  })

})
