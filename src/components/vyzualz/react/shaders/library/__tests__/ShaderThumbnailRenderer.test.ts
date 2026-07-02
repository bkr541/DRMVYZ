import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShaderDefinition } from '../../registry/shaderRegistryTypes'
import {
  getDrmvyzThumbnailWebGLCoordinatorDiagnosticsForTests,
  getDrmvyzWebGLContextDiagnosticsForTests,
  resetDrmvyzThumbnailWebGLCoordinatorForTests,
  resetDrmvyzWebGLContextDiagnosticsForTests,
} from '../../runtime/WebGLContextLifecycle'

const mocks = vi.hoisted(() => ({
  programCreate: vi.fn(),
  programDispose: vi.fn(),
  fullscreenRun: vi.fn(),
  fullscreenDispose: vi.fn(),
}))

vi.mock('../../runtime/ShaderProgram', () => ({
  ShaderProgram: {
    create: mocks.programCreate,
  },
}))

vi.mock('../../runtime/ShaderCompiler', () => ({
  ShaderCompiler: class ShaderCompiler {},
}))

vi.mock('../../runtime/FullscreenPass', () => ({
  FULLSCREEN_VERT_SRC: 'vertex',
  FullscreenPass: class FullscreenPass {
    run = mocks.fullscreenRun
    dispose = mocks.fullscreenDispose
  },
}))

import {
  getShaderThumbnailContextDiagnosticsForTests,
  ShaderThumbnailRenderer,
} from '../ShaderThumbnailRenderer'

const renderers: ShaderThumbnailRenderer[] = []
let canvases: Array<HTMLCanvasElement & { getContext: ReturnType<typeof vi.fn>; toDataURL: ReturnType<typeof vi.fn> }>
let loseContext: ReturnType<typeof vi.fn>
let gl: WebGL2RenderingContext

function definition(id: string): ShaderDefinition {
  return {
    id,
    name: id,
    description: '',
    category: 'generator',
    version: 1,
    fragSrc: `fragment-${id}`,
    params: [],
    defaults: {},
  }
}

function createRenderer(): ShaderThumbnailRenderer {
  const renderer = new ShaderThumbnailRenderer()
  renderers.push(renderer)
  return renderer
}

beforeEach(() => {
  resetDrmvyzThumbnailWebGLCoordinatorForTests()
  resetDrmvyzWebGLContextDiagnosticsForTests()
  canvases = []
  loseContext = vi.fn()
  gl = {
    FRAMEBUFFER: 0x8D40,
    RENDERBUFFER: 0x8D41,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    TEXTURE0: 0x84C0,
    TEXTURE_2D: 0x0DE1,
    BLEND: 0x0BE2,
    CULL_FACE: 0x0B44,
    DEPTH_TEST: 0x0B71,
    SCISSOR_TEST: 0x0C11,
    STENCIL_TEST: 0x0B90,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    STENCIL_BUFFER_BIT: 0x0400,
    bindFramebuffer: vi.fn(),
    bindRenderbuffer: vi.fn(),
    bindVertexArray: vi.fn(),
    bindBuffer: vi.fn(),
    useProgram: vi.fn(),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    disable: vi.fn(),
    colorMask: vi.fn(),
    depthMask: vi.fn(),
    stencilMask: vi.fn(),
    viewport: vi.fn(),
    scissor: vi.fn(),
    clearColor: vi.fn(),
    clearDepth: vi.fn(),
    clearStencil: vi.fn(),
    clear: vi.fn(),
    flush: vi.fn(),
    getExtension: vi.fn((name: string) => name === 'WEBGL_lose_context' ? { loseContext } : null),
  } as unknown as WebGL2RenderingContext

  const program = {
    activate: vi.fn(),
    setFloat: vi.fn(),
    setVec2: vi.fn(),
    dispose: mocks.programDispose,
  }
  mocks.programCreate.mockReset()
  mocks.programCreate.mockReturnValue({ program, error: null })
  mocks.programDispose.mockReset()
  mocks.fullscreenRun.mockReset()
  mocks.fullscreenDispose.mockReset()

  vi.stubGlobal('OffscreenCanvas', undefined)
  vi.stubGlobal('document', {
    createElement: vi.fn(() => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => gl),
        toDataURL: vi.fn(() => `data:image/png;base64,${canvases.length}`),
      } as unknown as HTMLCanvasElement & {
        getContext: ReturnType<typeof vi.fn>
        toDataURL: ReturnType<typeof vi.fn>
      }
      canvases.push(canvas)
      return canvas
    }),
  })
})

afterEach(() => {
  for (const renderer of renderers.splice(0)) renderer.dispose()
  resetDrmvyzThumbnailWebGLCoordinatorForTests()
  vi.unstubAllGlobals()
})

describe('ShaderThumbnailRenderer shared WebGL context pool', () => {
  it('reuses one context across repeated shader scene thumbnails', async () => {
    const renderer = createRenderer()

    await expect(renderer.render(definition('first'))).resolves.toMatchObject({ sceneId: 'first' })
    await expect(renderer.render(definition('second'))).resolves.toMatchObject({ sceneId: 'second' })

    expect(canvases).toHaveLength(1)
    expect(canvases[0].getContext).toHaveBeenCalledTimes(1)
    expect(mocks.programCreate).toHaveBeenCalledTimes(2)
    expect(mocks.programDispose).toHaveBeenCalledTimes(2)
    expect(getShaderThumbnailContextDiagnosticsForTests()).toMatchObject({
      activeContextCount: 1,
      contextLimit: 1,
    })
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      creationCount: 1,
      activeCount: 1,
      activeByRole: { 'shader-scene-thumbnail': 1 },
    })
    expect(getDrmvyzThumbnailWebGLCoordinatorDiagnosticsForTests()).toEqual({
      activeLeaseCount: 1,
      activeFamily: 'shader-scene-thumbnail',
      contextLimit: 1,
    })
  })

  it('shares the hard-capped context across renderer instances', async () => {
    const first = createRenderer()
    const second = createRenderer()

    await first.render(definition('first-owner'))
    await second.render(definition('second-owner'))

    expect(canvases).toHaveLength(1)
    expect(getShaderThumbnailContextDiagnosticsForTests()).toMatchObject({
      activeContextCount: 1,
      ownerCount: 2,
    })
    first.dispose()
    expect(loseContext).not.toHaveBeenCalled()
    second.dispose()
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('terminally retires the shared context once and balances diagnostics', async () => {
    const renderer = createRenderer()
    await renderer.render(definition('retire'))

    renderer.dispose()
    renderer.dispose()

    expect(loseContext).toHaveBeenCalledTimes(1)
    expect(canvases[0]).toMatchObject({ width: 1, height: 1 })
    expect(mocks.fullscreenDispose).toHaveBeenCalledTimes(1)
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      creationCount: 1,
      retirementCount: 1,
      terminalRetirementCount: 1,
      activeCount: 0,
    })
  })

  it('resets reusable GL state between different presets', async () => {
    const renderer = createRenderer()
    await renderer.render(definition('state-a'))
    const clearsAfterFirst = vi.mocked(gl.clear).mock.calls.length
    await renderer.render(definition('state-b'))

    expect(vi.mocked(gl.bindFramebuffer)).toHaveBeenCalledWith(gl.FRAMEBUFFER, null)
    expect(vi.mocked(gl.useProgram)).toHaveBeenCalledWith(null)
    expect(vi.mocked(gl.clear).mock.calls.length).toBeGreaterThan(clearsAfterFirst)
    expect(mocks.fullscreenRun).toHaveBeenCalledTimes(2)
  })
})
