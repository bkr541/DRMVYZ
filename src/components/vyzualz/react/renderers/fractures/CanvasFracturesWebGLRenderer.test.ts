/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { generateCanvasFracturesPlan } from './CanvasFracturesPlan'
import { CanvasFracturesRenderer } from './CanvasFracturesRenderer'
import type { CanvasFracturesRenderParams } from './CanvasFracturesTypes'

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
    bindVertexArray: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => attribute++),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    pixelStorei: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    blendEquation: vi.fn(),
    blendFunc: vi.fn(),
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
    deleteBuffer: vi.fn(),
    deleteVertexArray: vi.fn(),
  }
  return gl as unknown as WebGL2RenderingContext & {
    drawArrays: ReturnType<typeof vi.fn>
    texImage2D: ReturnType<typeof vi.fn>
  }
}

const effects: CanvasFracturesRenderParams['effects'] = {
  intensity: 0.8,
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
}

describe('Canvas Fractures WebGL2 renderer', () => {
  it('selects WebGL2, uploads a stable image once, and draws every fragment independently', () => {
    const canvas = document.createElement('canvas')
    const gl = makeGl()
    canvas.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null) as typeof canvas.getContext
    const result = CanvasFracturesRenderer.create(canvas)
    expect(result.renderer?.backend).toBe('webgl2')
    if (!result.renderer) return

    const plan = generateCanvasFracturesPlan({
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
    })
    const image = document.createElement('img')
    Object.defineProperties(image, {
      complete: { value: true },
      naturalWidth: { value: 1280 },
      naturalHeight: { value: 720 },
    })
    result.renderer.setPlan(plan)
    result.renderer.resize(1280, 720, 1)
    const params: CanvasFracturesRenderParams = {
      source: image,
      fitMode: 'cover',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      effects,
    }
    expect(result.renderer.render(params)).toBe(true)
    expect(result.renderer.render(params)).toBe(true)
    expect(gl.texImage2D).toHaveBeenCalledTimes(1)
    expect(gl.drawArrays).toHaveBeenCalledTimes(plan.fragments.length * 2)
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
