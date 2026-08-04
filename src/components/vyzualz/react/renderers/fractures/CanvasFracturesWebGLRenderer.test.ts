/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { generateCanvasFracturesPlan } from './CanvasFracturesPlan'
import { CanvasFracturesRenderer } from './CanvasFracturesRenderer'
import { CANVAS_FRACTURES_EFFECT_MODIFIERS } from './CanvasFracturesEffects'
import type {
  CanvasFracturesPlan,
  CanvasFracturesRenderParams,
} from './CanvasFracturesTypes'

function makeGl() {
  let attribute = 0
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    DYNAMIC_DRAW: 6,
    FLOAT: 7,
    TEXTURE_2D: 8,
    TEXTURE_MIN_FILTER: 9,
    TEXTURE_MAG_FILTER: 10,
    TEXTURE_WRAP_S: 11,
    TEXTURE_WRAP_T: 12,
    LINEAR: 13,
    CLAMP_TO_EDGE: 14,
    UNPACK_FLIP_Y_WEBGL: 15,
    RGBA: 16,
    UNSIGNED_BYTE: 17,
    COLOR_BUFFER_BIT: 18,
    BLEND: 19,
    FUNC_ADD: 20,
    SRC_ALPHA: 21,
    ONE_MINUS_SRC_ALPHA: 22,
    TEXTURE0: 23,
    TRIANGLES: 24,
    FRAMEBUFFER: 25,
    COLOR_ATTACHMENT0: 26,
    FRAMEBUFFER_COMPLETE: 27,
    ONE: 28,
    ONE_MINUS_SRC_COLOR: 29,
    ONE_MINUS_DST_COLOR: 30,
    FUNC_REVERSE_SUBTRACT: 31,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    createVertexArray: vi.fn(() => ({})),
    createTexture: vi.fn(() => ({})),
    createFramebuffer: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => attribute++),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    bindTexture: vi.fn(),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => 27),
    texParameteri: vi.fn(),
    pixelStorei: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => ({ name })),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    blendEquation: vi.fn(),
    blendFunc: vi.fn(),
    blendEquationSeparate: vi.fn(),
    blendFuncSeparate: vi.fn(),
    useProgram: vi.fn(),
    activeTexture: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    bufferSubData: vi.fn(),
    drawArrays: vi.fn(),
    texImage2D: vi.fn(),
    deleteTexture: vi.fn(),
    deleteFramebuffer: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteVertexArray: vi.fn(),
  }
  return gl as unknown as WebGL2RenderingContext & {
    bindFramebuffer: ReturnType<typeof vi.fn>
    blendEquationSeparate: ReturnType<typeof vi.fn>
    blendFuncSeparate: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    createFramebuffer: ReturnType<typeof vi.fn>
    drawArrays: ReturnType<typeof vi.fn>
    texImage2D: ReturnType<typeof vi.fn>
    uniform1i: ReturnType<typeof vi.fn>
  }
}

function makeEffects(patch: Partial<CanvasFracturesRenderParams['effects']> = {}): CanvasFracturesRenderParams['effects'] {
  return {
    intensity: 0.8,
    glow: 0,
    glitch: 0,
    texture: 0,
    trails: 0,
    depth: 0,
    duplication: 0,
    colorTreatment: 0,
    outlineIntensity: 0.6,
    outlineThickness: 0.4,
    bloomIntensity: 0.5,
    rgbSplit: 0.4,
    lumaMode: 'highlights',
    lumaThreshold: 0.6,
    displacement: 0.4,
    pixelation: 0.3,
    scanlines: 0.2,
    noise: 0.2,
    quality: 'balanced',
    colorSourceMode: 'manualOverride',
    manualPrimaryColor: '#4AC7DB',
    manualSupportingColor: '#61D6AA',
    flashTrigger: 0,
    reducedMotion: false,
    ...patch,
  }
}

function makePlan(patch: Partial<Parameters<typeof generateCanvasFracturesPlan>[0]> = {}) {
  return generateCanvasFracturesPlan({
    presetId: 'canvas-fractures',
    sourceIdentity: 'webgl-source',
    mediaType: 'image',
    mediaRevision: 2,
    variationSeed: 77,
    topologyRevision: 0,
    layoutRevision: 0,
    mode: 'mixed',
    intensity: 0,
    focusProtection: 0.7,
    focusX: 0.5,
    focusY: 0.5,
    composition: 0.4,
    placementMode: 'balanced',
    quality: 'low',
    anchorMode: 'fullyFragmented',
    effectRoleWeights: { clean: 0.2, glow: 0.2, outline: 0.2, glitch: 0.1, luma: 0.1, displacement: 0.1, texture: 0.1 },
    ...patch,
  })
}

function forceGlitchBlend(plan: CanvasFracturesPlan): CanvasFracturesPlan {
  return {
    ...plan,
    id: `${plan.id}:difference`,
    fragments: plan.fragments.map(fragment => ({
      ...fragment,
      effectRole: 'glitch',
      effectAssignment: {
        ...fragment.effectAssignment,
        role: 'glitch',
        modifiers: CANVAS_FRACTURES_EFFECT_MODIFIERS.dissolve,
        blendMode: 'difference',
      },
    })),
  }
}

function makeImage() {
  const image = document.createElement('img')
  Object.defineProperties(image, {
    complete: { value: true },
    naturalWidth: { value: 1280 },
    naturalHeight: { value: 720 },
  })
  return image
}

describe('Canvas Fractures WebGL2 renderer', () => {
  it('selects WebGL2, uploads one source texture, and draws every fragment independently', () => {
    const canvas = document.createElement('canvas')
    const gl = makeGl()
    canvas.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null) as typeof canvas.getContext
    const result = CanvasFracturesRenderer.create(canvas)
    expect(result.renderer?.backend).toBe('webgl2')
    if (!result.renderer) return

    const plan = makePlan()
    result.renderer.setPlan(plan)
    result.renderer.resize(1280, 720, 1)
    const params: CanvasFracturesRenderParams = {
      source: makeImage(),
      fitMode: 'cover',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      effects: makeEffects(),
    }
    expect(result.renderer.render(params)).toBe(true)
    expect(result.renderer.render(params)).toBe(true)
    expect(gl.texImage2D).toHaveBeenCalledTimes(1)
    expect(gl.drawArrays).toHaveBeenCalledTimes(plan.fragments.length * 2)
  })

  it('allocates bounded feedback resources and clears them on explicit, resize, and topology invalidation', () => {
    const canvas = document.createElement('canvas')
    const gl = makeGl()
    canvas.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null) as typeof canvas.getContext
    const result = CanvasFracturesRenderer.create(canvas)
    if (!result.renderer) throw new Error(result.error)
    result.renderer.setPlan(makePlan())
    result.renderer.resize(1280, 720, 1)
    const source = makeImage()
    const trailParams: CanvasFracturesRenderParams = {
      source,
      fitMode: 'cover',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      framePositionSec: 10,
      effects: makeEffects({ trails: 1, intensity: 1, quality: 'low' }),
    }
    expect(result.renderer.render(trailParams)).toBe(true)
    expect(gl.createFramebuffer).toHaveBeenCalledTimes(2)

    gl.clear.mockClear()
    expect(result.renderer.render({ ...trailParams, framePositionSec: 10.02 })).toBe(true)
    expect(gl.clear).toHaveBeenCalledTimes(2)
    gl.clear.mockClear()
    expect(result.renderer.render({ ...trailParams, framePositionSec: 5 })).toBe(true)
    expect(gl.clear).toHaveBeenCalledTimes(4)

    expect(result.renderer.render({
      ...trailParams,
      framePositionSec: 5.02,
      effects: makeEffects({ trails: 1, intensity: 1, quality: 'high' }),
    })).toBe(true)
    expect(gl.createFramebuffer).toHaveBeenCalledTimes(4)

    gl.clear.mockClear()
    result.renderer.invalidateFeedback()
    expect(gl.clear).toHaveBeenCalledTimes(2)

    gl.clear.mockClear()
    result.renderer.resize(960, 540, 1)
    expect(gl.clear).toHaveBeenCalledTimes(2)

    gl.clear.mockClear()
    result.renderer.setPlan(makePlan({ topologyRevision: 1 }))
    expect(gl.clear).toHaveBeenCalledTimes(2)
  })

  it('resets WebGL blend state after a Difference fragment and preserves core role dispatch', () => {
    const canvas = document.createElement('canvas')
    const gl = makeGl()
    canvas.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null) as typeof canvas.getContext
    const result = CanvasFracturesRenderer.create(canvas)
    if (!result.renderer) throw new Error(result.error)
    const plan = forceGlitchBlend(makePlan())
    result.renderer.setPlan(plan)
    result.renderer.resize(640, 360, 1)
    expect(result.renderer.render({
      source: makeImage(),
      fitMode: 'cover',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      effects: makeEffects({ glitch: 1, intensity: 1 }),
    })).toBe(true)

    expect(gl.blendEquationSeparate.mock.calls.some((call: unknown[]) => call[0] === gl.FUNC_REVERSE_SUBTRACT)).toBe(true)
    expect(gl.blendEquationSeparate.mock.calls[gl.blendEquationSeparate.mock.calls.length - 1]).toEqual([gl.FUNC_ADD, gl.FUNC_ADD])
    expect(gl.blendFuncSeparate.mock.calls[gl.blendFuncSeparate.mock.calls.length - 1]).toEqual([
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    ])
    expect(gl.uniform1i.mock.calls.some((call: unknown[]) => (call[0] as { name?: string })?.name === 'uRole' && call[1] === 3)).toBe(true)
  })

  it('handles context loss without crashing and can rebuild after restoration', () => {
    const canvas = document.createElement('canvas')
    const gl = makeGl()
    canvas.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null) as typeof canvas.getContext
    const result = CanvasFracturesRenderer.create(canvas)
    if (!result.renderer) throw new Error(result.error)
    const lost = new Event('webglcontextlost', { cancelable: true })
    expect(canvas.dispatchEvent(lost)).toBe(false)
    expect(() => canvas.dispatchEvent(new Event('webglcontextrestored'))).not.toThrow()
    expect(() => result.renderer?.dispose()).not.toThrow()
  })
})
