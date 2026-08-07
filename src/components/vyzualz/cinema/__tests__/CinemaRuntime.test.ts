/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CinemaNodeId, CinemaPortId } from '../CinemaIdentifiers'
import {
  CINEMA_FOUNDATION_COMPOSITION_ID,
  CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID,
  CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID,
  CINEMA_FOUNDATION_RUNTIME_REGISTRY,
  createCinemaFoundationPersistedState,
} from '../CinemaFoundation'
import { createCinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import { CINEMA_STAGE15_REFERENCE_COMPOSITION_ID } from '../CinemaMediaTextNodes'
import type { CinemaFrameContext, CinemaNodePlugin, CinemaRenderNode } from '../CinemaRendererContracts'
import type { CinemaTargetDescriptor } from '../CinemaRendererContracts'
import { CinemaRuntime } from '../runtime/CinemaRuntime'
import {
  getDrmvyzWebGLContextDiagnosticsForTests,
  resetDrmvyzWebGLContextDiagnosticsForTests,
} from '../../react/shaders/runtime/WebGLContextLifecycle'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

const TARGET: CinemaTargetDescriptor = {
  colorSpace: 'srgb',
  alphaMode: 'premultiplied',
  colorFormat: 'rgba8',
  hasDepth: true,
  hasMask: false,
  widthScale: 1,
  heightScale: 1,
  filter: 'linear',
  wrap: 'clamp',
  clearColor: [0, 0, 0, 0],
}

beforeEach(() => {
  resetDrmvyzWebGLContextDiagnosticsForTests()
})

afterEach(() => {
  resetDrmvyzWebGLContextDiagnosticsForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('CinemaRuntime', () => {
  it('owns one context and one animation loop, then retires both deterministically', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)

    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelFrame = vi.fn((id: number) => { callbacks.delete(id) })

    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: requestFrame,
      cancelAnimationFrame: cancelFrame,
    })
    expect(created.error).toBeNull()
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize({
      valid: true,
      cssWidth: 640,
      cssHeight: 360,
      backingWidth: 960,
      backingHeight: 540,
      effectiveDpr: 1.5,
      resolutionScale: 1,
      quality: 'high',
      cappedByDpr: false,
      cappedByPixelBudget: false,
      cappedByDimension: false,
    })
    runtime.start()
    runtime.start()

    expect(requestFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      activeCount: 1,
      activeLiveByEngine: { cinema: 1 },
    })

    const first = [...callbacks.entries()][0]
    callbacks.delete(first[0])
    first[1](16.67)
    expect(gl.__calls.clearCount).toBe(1)
    expect(callbacks.size).toBe(1)

    runtime.dispose()
    expect(cancelFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(0)
    expect(getDrmvyzWebGLContextDiagnosticsForTests().activeCount).toBe(0)
  })

  it('reuses matching pooled targets and reallocates active targets on resize', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize(resolution(640, 360))
    const owner = 'cinema.node.test' as CinemaNodeId
    const first = runtime.targets.acquire(owner, TARGET, 'frame')
    const firstView = runtime.targets.getReadTexture(first)
    runtime.targets.release(first)
    const second = runtime.targets.acquire(owner, TARGET, 'frame')
    const secondView = runtime.targets.getReadTexture(second)

    expect(secondView?.textureViewId).toBe(firstView?.textureViewId)
    expect(runtime.targets.getDiagnostics()).toMatchObject({
      createdAllocationCount: 1,
      reusedAllocationCount: 1,
      activeLeaseCount: 1,
    })

    runtime.resize(resolution(800, 450))
    expect(runtime.targets.getDiagnostics()).toMatchObject({
      createdAllocationCount: 2,
      destroyedAllocationCount: 1,
      activeLeaseCount: 1,
      viewport: { width: 800, height: 450 },
    })
    expect(runtime.targets.getReadTexture(second)).not.toBeNull()

    runtime.targets.release(second)
    runtime.dispose()
    expect(gl.__calls.deletedFramebuffers).toBe(gl.__calls.createdFramebuffers)
    expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
    expect(gl.__calls.deletedRenderbuffers).toBe(gl.__calls.createdRenderbuffers)
  })

  it('allocates and exposes a distinct mask attachment for mask-compatible nodes', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize(resolution(640, 360))
    const lease = runtime.targets.acquire('cinema.node.mask-source' as CinemaNodeId, {
      ...TARGET,
      hasDepth: false,
      hasMask: true,
    }, 'frame')
    const color = runtime.targets.getReadTexture(lease)
    const mask = runtime.targets.getReadMaskTexture?.(lease)

    expect(color).not.toBeNull()
    expect(mask).not.toBeNull()
    expect(mask?.textureViewId).not.toBe(color?.textureViewId)
    expect(mask?.descriptor).toMatchObject({ colorFormat: 'r8', hasMask: false })
    expect(gl.drawBuffers).toHaveBeenCalledWith([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])

    runtime.targets.release(lease)
    runtime.dispose()
    expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
  })

  it('bounds pooled allocations, clamps oversized targets, and removes released texture routes', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize(resolution(5_000, 3_000))
    const owner = 'cinema.node.pool-bound' as CinemaNodeId
    const port = 'cinema.port.pool-bound' as CinemaPortId
    const oversized = { ...TARGET, widthScale: 4, heightScale: 4 }
    const leases = Array.from({ length: 25 }, () => runtime.targets.acquire(owner, oversized, 'frame'))
    const firstView = runtime.targets.getReadTexture(leases[0])
    expect(firstView).not.toBeNull()
    if (firstView) {
      runtime.textures.publishOutput(owner, port, firstView)
      expect(runtime.textures.resolveInput(owner, port)?.textureViewId).toBe(firstView.textureViewId)
      expect('texture' in firstView).toBe(false)
    }

    for (const lease of leases) runtime.targets.release(lease)
    expect(runtime.textures.resolveInput(owner, port)).toBeNull()
    expect(runtime.targets.getDiagnostics()).toMatchObject({
      pooledAllocationCount: 24,
      maximumPooledAllocationCount: 24,
      maximumTextureSize: 8192,
      destroyedAllocationCount: 1,
    })
    expect(gl.texImage2D).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      8192,
      8192,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )

    runtime.dispose()
    expect(gl.__calls.deletedFramebuffers).toBe(gl.__calls.createdFramebuffers)
    expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
    expect(gl.__calls.deletedRenderbuffers).toBe(gl.__calls.createdRenderbuffers)
  })

  it('pauses on context loss and resumes one loop after rebuilding on restoration', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelFrame = vi.fn((id: number) => { callbacks.delete(id) })
    const snapshots: string[] = []

    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: requestFrame,
      cancelAnimationFrame: cancelFrame,
      onSnapshot: snapshot => snapshots.push(snapshot.phase),
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return
    runtime.resize(resolution(320, 180))
    runtime.start()
    expect(callbacks.size).toBe(1)

    const lost = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(callbacks.size).toBe(0)
    expect(runtime.getSnapshot().phase).toBe('context-lost')
    expect(runtime.getSnapshot().diagnostics.diagnostics.some(d => d.code === 'CINEMA_CONTEXT_LOST')).toBe(true)

    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(runtime.getSnapshot()).toMatchObject({ phase: 'running', contextGeneration: 2 })
    expect(runtime.getSnapshot().diagnostics.diagnostics.some(d => d.code === 'CINEMA_CONTEXT_RESTORED')).toBe(true)
    expect(callbacks.size).toBe(1)
    expect(requestFrame).toHaveBeenCalledTimes(2)
    expect(snapshots).toContain('context-lost')

    runtime.dispose()
  })



  it('executes the persisted foundation graph through registered nodes and one output', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: callback => { const id = nextRaf++; callbacks.set(id, callback); return id },
      cancelAnimationFrame: id => { callbacks.delete(id) },
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    const state = createCinemaFoundationPersistedState()
    runtime.resize(resolution(640, 360))
    const activeComposition = state.compositions.find(composition => composition.id === state.activeCompositionId) ?? null
    runtime.setGraph(activeComposition, null, state.definitions)
    runtime.setFrame(frame(640, 360))
    runtime.start()
    const scheduled = [...callbacks.entries()][0]
    callbacks.delete(scheduled[0])
    scheduled[1](16.67)

    expect(runtime.getSnapshot().graph).toMatchObject({
      compositionId: state.activeCompositionId,
      activeNodeCount: 2,
      initializedNodeCount: 2,
      failedNodeCount: 0,
      outputRendered: true,
      safeOutputActive: false,
    })
    expect(gl.__calls.drawCount).toBe(2)
    expect(gl.bindFramebuffer).toHaveBeenCalledWith(gl.FRAMEBUFFER, null)

    runtime.setGraph(null, null, state.definitions)
    expect(runtime.getSnapshot().graph).toMatchObject({ activeNodeCount: 0, safeOutputActive: true })
    runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
  })

  it('executes the Stage 15 text source through the production runtime with one loop and a mask attachment', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    const context2d = {
      clearRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
      textBaseline: 'middle',
      textAlign: 'center',
      font: '',
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D
    vi.stubGlobal('CanvasRenderingContext2D', class CanvasRenderingContext2D {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (kind: string) {
      if (this === canvas && kind === 'webgl2') return gl as unknown as RenderingContext
      if (kind === '2d') return context2d
      return null
    })
    const callbacks = new Map<number, FrameRequestCallback>()
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.set(1, callback)
      return 1
    })
    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: requestFrame,
      cancelAnimationFrame: () => { callbacks.clear() },
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    const state = createCinemaFoundationPersistedState()
    const composition = state.compositions.find(candidate => candidate.id === CINEMA_STAGE15_REFERENCE_COMPOSITION_ID) ?? null
    runtime.resize(resolution(640, 360))
    runtime.setGraph(composition, null, state.definitions)
    runtime.setFrame(frame(640, 360))
    runtime.start()
    const callback = callbacks.get(1)
    expect(callback).toBeDefined()
    callback?.(16.67)

    expect(requestFrame).toHaveBeenCalledTimes(2)
    expect(runtime.getSnapshot().graph).toMatchObject({
      compositionId: CINEMA_STAGE15_REFERENCE_COMPOSITION_ID,
      activeNodeCount: 2,
      initializedNodeCount: 2,
      failedNodeCount: 0,
      outputRendered: true,
      safeOutputActive: false,
    })
    expect(context2d.fillText).toHaveBeenCalled()
    expect(gl.drawBuffers).toHaveBeenCalledWith([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
    expect(gl.__calls.drawCount).toBe(2)

    runtime.dispose()
  })

  it('isolates a throwing node and keeps the output path alive diagnostically', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const outputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
    expect(outputRegistration).toBeDefined()
    if (!outputRegistration) return

    const throwingPlugin: CinemaNodePlugin = {
      definition: CINEMA_FOUNDATION_GRADIENT_DEFINITION,
      createNode(node): CinemaRenderNode {
        return {
          nodeId: node.id,
          typeId: node.typeId,
          initialize() {},
          resize() {},
          render() { throw new Error('intentional renderer failure') },
          reset() {},
          dispose() {},
        }
      },
    }
    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin: throwingPlugin },
      outputRegistration,
    ]).registry
    const callbacks = new Map<number, FrameRequestCallback>()
    const created = CinemaRuntime.create(canvas, {
      runtimeRegistry,
      requestAnimationFrame: callback => { callbacks.set(1, callback); return 1 },
      cancelAnimationFrame: () => { callbacks.clear() },
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return
    const state = createCinemaFoundationPersistedState()
    runtime.resize(resolution(320, 180))
    const foundationComposition = state.compositions.find(composition => composition.id === CINEMA_FOUNDATION_COMPOSITION_ID) ?? null
    runtime.setGraph(foundationComposition, null, state.definitions)
    runtime.setFrame(frame(320, 180))
    runtime.start()
    const callback = callbacks.get(1)
    expect(callback).toBeDefined()
    callback?.(16.67)

    expect(runtime.getSnapshot().graph).toMatchObject({ failedNodeCount: 1, outputRendered: true, safeOutputActive: true })
    expect(runtime.getSnapshot().diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_NODE_RENDER_FAILED'
      && diagnostic.message.includes('foundation-gradient')
    ))).toBe(true)
    expect(runtime.getSnapshot().phase).toBe('running')
    runtime.dispose()
  })


  it('honors runtime capability declarations before renderer initialization', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const outputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
    expect(outputRegistration).toBeDefined()
    if (!outputRegistration) return

    const constrainedDefinition = {
      ...CINEMA_FOUNDATION_GRADIENT_DEFINITION,
      capabilities: {
        ...CINEMA_FOUNDATION_GRADIENT_DEFINITION.capabilities,
        requires: { webgl2: true, timerQueries: true },
      },
    }
    const createNode = vi.fn((): CinemaRenderNode => ({
      nodeId: 'foundation-gradient' as CinemaNodeId,
      typeId: CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId,
      initialize() {}, resize() {}, render() {}, reset() {}, dispose() {},
    }))
    const constrainedPlugin: CinemaNodePlugin = { definition: constrainedDefinition, createNode }
    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin: constrainedPlugin },
      outputRegistration,
    ]).registry
    const created = CinemaRuntime.create(canvas, {
      runtimeRegistry,
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return
    const foundation = createCinemaFoundationPersistedState()
    const definitions = foundation.definitions.map(definition => definition.id === constrainedDefinition.typeId
      ? { ...definition, definition: constrainedDefinition }
      : definition)

    runtime.resize(resolution(320, 180))
    const foundationComposition = foundation.compositions.find(composition => composition.id === CINEMA_FOUNDATION_COMPOSITION_ID) ?? null
    runtime.setGraph(foundationComposition, null, definitions)

    expect(createNode).not.toHaveBeenCalled()
    expect(runtime.getSnapshot().graph.diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_CAPABILITY_UNAVAILABLE'
      && diagnostic.attribution?.nodeId === 'foundation-gradient'
    ))).toBe(true)
    runtime.dispose()
  })

  it('returns structured safe-output diagnostics when WebGL2 is unavailable', () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    const result = CinemaRuntime.create(canvas)
    expect(result.runtime).toBeNull()
    expect(result.error).toContain('WebGL2')
    expect(result.diagnostics.diagnostics.map(diagnostic => diagnostic.code)).toEqual(
      expect.arrayContaining(['CINEMA_CAPABILITY_UNAVAILABLE', 'CINEMA_SAFE_OUTPUT_ACTIVE']),
    )
  })
})

function resolution(width: number, height: number) {
  return {
    valid: true,
    cssWidth: width,
    cssHeight: height,
    backingWidth: width,
    backingHeight: height,
    effectiveDpr: 1,
    resolutionScale: 1,
    quality: 'high' as const,
    cappedByDpr: false,
    cappedByPixelBudget: false,
    cappedByDimension: false,
  }
}


function frame(width: number, height: number): Readonly<CinemaFrameContext> {
  return {
    viewport: { width, height, dpr: 1 },
    transport: {
      trackId: 'stage-8-test', audioTimeSec: 0, durationSec: 60, playing: true, paused: false,
      seeking: false, looped: false, visibilitySuspended: false, discontinuity: false,
      discontinuityReasons: [], reset: { required: false, reconstruct: false, generation: 0, reasons: [], actionIds: [], identity: null },
    },
  } as unknown as Readonly<CinemaFrameContext>
}
