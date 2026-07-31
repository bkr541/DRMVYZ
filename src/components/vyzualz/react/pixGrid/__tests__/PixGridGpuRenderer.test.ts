import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESETS } from '../PixGridPresets'
import { applyPixGridRuntimeControls } from '../PixGridRuntimeControls'
import { applyPixGridPresetSettings } from '../PixGridState'
import { PixGridReactionRuntime } from '../PixGridAudioRouting'
import { normalizePixGridState } from '../PixGridValidation'
import { resolvePixGridPresentation } from '../PixGridPresentation'
import { PixGridGpuRenderer } from '../../renderers/pixGrid/PixGridGpuRenderer'
import { renderPixGridBaseline, renderPixGridCanvasFallback } from '../../renderers/pixGrid/PixGridBaselineRenderer'
import {
  getReactLiveEngineOwnershipDiagnosticsForTests,
  resetReactLiveEngineOwnershipForTests,
} from '../../renderers/ReactLiveEngineOwnership'
import {
  PIX_GRID_LOGICAL_FRAGMENT_SHADER,
  PIX_GRID_PRESENTATION_FRAGMENT_SHADER,
} from '../../renderers/pixGrid/PixGridGpuShaderSources'

type Listener = (event: Event) => void

function createFakeWebGL2() {
  let nextId = 1
  let activeTexture = 100
  let framebuffer: object | null = null
  let program: object | null = null
  let vertexArray: object | null = null
  let viewport = new Int32Array([0, 0, 640, 360])
  const textureBindings = new Map<number, object | null>()
  const enabled = new Set<number>()
  const object = () => ({ id: nextId++ })
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    FRAMEBUFFER: 5, FRAMEBUFFER_COMPLETE: 6, COLOR_ATTACHMENT0: 7,
    TEXTURE_2D: 8, TEXTURE_MIN_FILTER: 9, TEXTURE_MAG_FILTER: 10,
    TEXTURE_WRAP_S: 11, TEXTURE_WRAP_T: 12, NEAREST: 13, CLAMP_TO_EDGE: 14,
    RGBA8: 15, RGBA: 16, UNSIGNED_BYTE: 17, UNPACK_ALIGNMENT: 18,
    COLOR_BUFFER_BIT: 19, TRIANGLES: 20, BLEND: 21, DEPTH_TEST: 22,
    CULL_FACE: 23, SCISSOR_TEST: 24, TEXTURE0: 100, TEXTURE1: 101,
    ACTIVE_TEXTURE: 25, TEXTURE_BINDING_2D: 26, FRAMEBUFFER_BINDING: 27,
    CURRENT_PROGRAM: 28, VERTEX_ARRAY_BINDING: 29, VIEWPORT: 30, COLOR_CLEAR_VALUE: 31, MAX_TEXTURE_SIZE: 32,
    createShader: vi.fn(object), shaderSource: vi.fn(), compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true), getShaderInfoLog: vi.fn(() => ''), deleteShader: vi.fn(),
    createProgram: vi.fn(object), attachShader: vi.fn(), linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true), getProgramInfoLog: vi.fn(() => ''), deleteProgram: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => ({ name })),
    createVertexArray: vi.fn(object), deleteVertexArray: vi.fn(),
    createFramebuffer: vi.fn(object), deleteFramebuffer: vi.fn(),
    createTexture: vi.fn(object), deleteTexture: vi.fn(),
    activeTexture: vi.fn((value: number) => { activeTexture = value }),
    bindTexture: vi.fn((_target: number, value: object | null) => { textureBindings.set(activeTexture, value) }),
    texParameteri: vi.fn(), texImage2D: vi.fn(), texSubImage2D: vi.fn(), pixelStorei: vi.fn(),
    bindFramebuffer: vi.fn((_target: number, value: object | null) => { framebuffer = value }),
    framebufferTexture2D: vi.fn(), checkFramebufferStatus: vi.fn(() => 6),
    bindVertexArray: vi.fn((value: object | null) => { vertexArray = value }),
    useProgram: vi.fn((value: object | null) => { program = value }),
    viewport: vi.fn((x: number, y: number, width: number, height: number) => { viewport = new Int32Array([x, y, width, height]) }),
    clearColor: vi.fn(), clear: vi.fn(), drawArrays: vi.fn(), flush: vi.fn(),
    uniform1i: vi.fn(), uniform1f: vi.fn(), uniform2f: vi.fn(), uniform3f: vi.fn(),
    disable: vi.fn((value: number) => enabled.delete(value)), enable: vi.fn((value: number) => enabled.add(value)),
    isEnabled: vi.fn((value: number) => enabled.has(value)),
    getParameter: vi.fn((parameter: number) => {
      if (parameter === 25) return activeTexture
      if (parameter === 26) return textureBindings.get(activeTexture) ?? null
      if (parameter === 27) return framebuffer
      if (parameter === 28) return program
      if (parameter === 29) return vertexArray
      if (parameter === 30) return viewport
      if (parameter === 18) return 4
      if (parameter === 31) return new Float32Array([0, 0, 0, 0])
      if (parameter === 32) return 4096
      return null
    }),
  }
  return gl
}

function createCanvas(gl: ReturnType<typeof createFakeWebGL2> | null) {
  const listeners = new Map<string, Listener>()
  return {
    width: 640,
    height: 360,
    getContext: vi.fn((kind: string) => kind === 'webgl2' ? gl : null),
    addEventListener: vi.fn((type: string, listener: Listener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    dispatch(type: string, event: Event = { preventDefault: vi.fn() } as unknown as Event) {
      listeners.get(type)?.(event)
      return event
    },
  }
}

function renderInput(quality: 'high' | 'ultra' = 'high') {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'pix-grid-bass-beacon')!
  return {
    frame: {
      width: 640, height: 360, audioTime: 2, bass: 0.7, mid: 0.4, high: 0.2,
      volume: 0.7, beatHit: true, beatPhase: 0.1, isPlaying: true,
      motion: 0.7, intensity: 0.9, glow: 0.5, bassReactivity: 0.8,
    },
    preset,
    state: { ...createDefaultPixGridState(), quality },
    presentationWidth: 640,
    presentationHeight: 360,
  }
}

describe('PixGridGpuRenderer', () => {
  it('uses texelFetch and NEAREST sampling for crisp logical presentation', () => {
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('texelFetch(uLogicalTexture')
    expect(PIX_GRID_LOGICAL_FRAGMENT_SHADER).toContain('outColor = vec4(logicalColor, alpha)')
  })

  it('binds the canonical resolved intensity, Glow, Halo Radius, and Diffusion uniforms', () => {
    const gl = createFakeWebGL2()
    const canvas = createCanvas(gl)
    const renderer = PixGridGpuRenderer.create(canvas as unknown as HTMLCanvasElement).renderer!
    const input = renderInput('high')
    const expected = resolvePixGridPresentation(input.state, input.frame)

    expect(renderer.render(input)).toBe(true)
    const uniformValue = (name: string): number | undefined => {
      const call = gl.uniform1f.mock.calls.find((entry: unknown[]) => (entry[0] as { name?: string } | null)?.name === name)
      return typeof call?.[1] === 'number' ? call[1] : undefined
    }
    expect(uniformValue('uResolvedIntensity')).toBeCloseTo(expected.resolvedOutputIntensity)
    expect(uniformValue('uGlow')).toBeCloseTo(expected.glow)
    expect(uniformValue('uHaloRadius')).toBeCloseTo(expected.haloRadius)
    expect(uniformValue('uDiffusion')).toBeCloseTo(expected.diffusion)
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).not.toContain('uCellBrightness')
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).not.toContain('uGlobalIntensity')
  })

  it('reuses logical textures and framebuffers until the quality resolution changes', () => {
    const gl = createFakeWebGL2()
    const canvas = createCanvas(gl)
    const result = PixGridGpuRenderer.create(canvas as unknown as HTMLCanvasElement)
    expect(result.error).toBeNull()
    const renderer = result.renderer!

    expect(renderer.render(renderInput('high'))).toBe(true)
    expect(renderer.render(renderInput('high'))).toBe(true)
    expect(renderer.diagnostics.logicalAllocationCount).toBe(1)
    expect(gl.texImage2D).toHaveBeenCalledTimes(3)
    expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    expect(renderer.render(renderInput('ultra'))).toBe(true)
    expect(renderer.diagnostics.logicalAllocationCount).toBe(2)
    expect(gl.texImage2D).toHaveBeenCalledTimes(6)
  })

  it('uploads the same resolved action framebuffer consumed by the Canvas fallback', () => {
    const gl = createFakeWebGL2()
    const canvas = createCanvas(gl)
    const renderer = PixGridGpuRenderer.create(canvas as unknown as HTMLCanvasElement).renderer!
    const controlled = {
      ...applyPixGridRuntimeControls({
        audioTime: 40,
        bass: 0.88,
        mid: 0.24,
        high: 0.18,
        volume: 0.8,
        beatHit: true,
        kickHit: true,
        snareHit: false,
        hatHit: false,
        beatPhase: 0,
        beatIndex: 80,
        barIndex: 20,
        beatsSinceSectionStart: 2,
        barsSinceSectionStart: 0.5,
        sectionType: 'drop',
        sourceValues: { bass: 0.88, kick: 1 },
        isPlaying: true,
      }, { bassReactivity: 1, motion: 0 }),
      width: 640,
      height: 360,
      motion: 0,
      intensity: 1,
      glow: 0,
      bassReactivity: 1,
    }
    const presets = [
      PIX_GRID_PRESETS[0],
      PIX_GRID_PRESETS.find(candidate => candidate.id === 'pix-grid-neon-marquee-cycle')!,
    ]

    for (const preset of presets) {
      const state = normalizePixGridState({
        ...applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings),
        globalIntensity: 1,
        cellBrightness: 1,
      })
      const expected = composePixGridLogicalFrame(
        preset,
        state,
        controlled,
        undefined,
        undefined,
        new PixGridReactionRuntime(),
      )

      expect(renderer.render({
        frame: controlled,
        preset,
        state,
        presentationWidth: 640,
        presentationHeight: 360,
        reactionRuntime: new PixGridReactionRuntime(),
      })).toBe(true)
      const gpuUpload = gl.texSubImage2D.mock.calls.at(-1)?.[8] as Uint8Array

      const image = { data: new Uint8ClampedArray(state.matrixWidth * state.matrixHeight * 4) }
      const logicalContext = {
        createImageData: vi.fn(() => image),
        putImageData: vi.fn(),
      }
      const outputContext = {
        save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), strokeRect: vi.fn(),
        fillStyle: '', strokeStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true, lineWidth: 1,
      }
      renderPixGridCanvasFallback(
        outputContext as unknown as CanvasRenderingContext2D,
        {
          canvas: { width: state.matrixWidth, height: state.matrixHeight } as HTMLCanvasElement,
          context: logicalContext as unknown as CanvasRenderingContext2D,
        },
        controlled,
        preset,
        state,
        undefined,
        new PixGridReactionRuntime(),
      )

      expect(Array.from(gpuUpload)).toEqual(Array.from(expected.pixels))
      expect(Array.from(image.data)).toEqual(Array.from(expected.pixels))
    }
  })

  it('disposes every owned GPU resource idempotently', () => {
    const gl = createFakeWebGL2()
    const canvas = createCanvas(gl)
    const renderer = PixGridGpuRenderer.create(canvas as unknown as HTMLCanvasElement).renderer!
    renderer.render(renderInput())
    renderer.dispose()
    renderer.dispose()

    expect(gl.deleteProgram).toHaveBeenCalledTimes(2)
    expect(gl.deleteVertexArray).toHaveBeenCalledTimes(1)
    expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(1)
    expect(gl.deleteTexture).toHaveBeenCalledTimes(3)
    expect(canvas.removeEventListener).toHaveBeenCalledTimes(2)
  })

  it('holds rendering during context loss and rebuilds resources after restoration', () => {
    const gl = createFakeWebGL2()
    const canvas = createCanvas(gl)
    const onContextLost = vi.fn()
    const onContextRestored = vi.fn()
    const renderer = PixGridGpuRenderer.create(canvas as unknown as HTMLCanvasElement, {
      onContextLost,
      onContextRestored,
    }).renderer!
    renderer.render(renderInput())

    const event = canvas.dispatch('webglcontextlost') as unknown as { preventDefault: ReturnType<typeof vi.fn> }
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(onContextLost).toHaveBeenCalledOnce()
    expect(renderer.diagnostics.contextState).toBe('lost')
    expect(renderer.render(renderInput())).toBe(false)

    canvas.dispatch('webglcontextrestored')
    expect(onContextRestored).toHaveBeenCalledOnce()
    expect(renderer.diagnostics.contextState).toBe('ready')
    expect(renderer.render(renderInput())).toBe(true)
    expect(gl.createProgram).toHaveBeenCalledTimes(4)
  })


  it('keeps Canvas2D thumbnail rendering isolated from the live GPU ownership slot', () => {
    resetReactLiveEngineOwnershipForTests()
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'pix-grid-bass-beacon')!
    const context = {
      save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
      rect: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), strokeRect: vi.fn(),
      fillStyle: '', strokeStyle: '', shadowColor: '', shadowBlur: 0, lineWidth: 1,
      globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D
    renderPixGridBaseline(context, renderInput().frame, preset, createDefaultPixGridState())
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeOwnerCount: 0,
      activeEngine: null,
    })
  })

  it('returns a concise fallback reason when WebGL2 cannot be created', () => {
    const canvas = createCanvas(null)
    const result = PixGridGpuRenderer.create(canvas as unknown as HTMLCanvasElement)
    expect(result.renderer).toBeNull()
    expect(result.error).toContain('Canvas2D PixGrid fallback')
  })
})
