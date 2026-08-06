import { vi } from 'vitest'

export interface CinemaMockWebGL extends WebGL2RenderingContext {
  __calls: {
    createdFramebuffers: number
    deletedFramebuffers: number
    createdTextures: number
    deletedTextures: number
    createdRenderbuffers: number
    deletedRenderbuffers: number
    clearCount: number
    createdPrograms: number
    deletedPrograms: number
    createdShaders: number
    deletedShaders: number
    drawCount: number
  }
}

export function createCinemaMockWebGL(): CinemaMockWebGL {
  let objectId = 1
  const calls = {
    createdFramebuffers: 0,
    deletedFramebuffers: 0,
    createdTextures: 0,
    deletedTextures: 0,
    createdRenderbuffers: 0,
    deletedRenderbuffers: 0,
    clearCount: 0,
    createdPrograms: 0,
    deletedPrograms: 0,
    createdShaders: 0,
    deletedShaders: 0,
    drawCount: 0,
  }
  let boundFramebuffer: WebGLFramebuffer | null = null
  const gl = {
    __calls: calls,
    FRAMEBUFFER: 0x8d40,
    RENDERBUFFER: 0x8d41,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    NEAREST: 0x2600,
    LINEAR: 0x2601,
    REPEAT: 0x2901,
    MIRRORED_REPEAT: 0x8370,
    CLAMP_TO_EDGE: 0x812f,
    RGBA8: 0x8058,
    RGBA16F: 0x881a,
    RGBA32F: 0x8814,
    RGBA: 0x1908,
    R8: 0x8229,
    RED: 0x1903,
    RG8: 0x822b,
    RG: 0x8227,
    DEPTH_COMPONENT16: 0x81a5,
    DEPTH_COMPONENT24: 0x81a6,
    DEPTH_COMPONENT: 0x1902,
    UNSIGNED_BYTE: 0x1401,
    UNSIGNED_SHORT: 0x1403,
    UNSIGNED_INT: 0x1405,
    HALF_FLOAT: 0x140b,
    FLOAT: 0x1406,
    COLOR_ATTACHMENT0: 0x8ce0,
    COLOR_ATTACHMENT1: 0x8ce1,
    DEPTH_ATTACHMENT: 0x8d00,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    NONE: 0,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    SCISSOR_TEST: 0x0c11,
    BLEND: 0x0be2,
    ONE: 1,
    ZERO: 0,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    DST_COLOR: 0x0306,
    ONE_MINUS_SRC_COLOR: 0x0301,
    DEPTH_TEST: 0x0b71,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    TRIANGLES: 0x0004,
    TEXTURE0: 0x84c0,
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_TEXTURE_IMAGE_UNITS: 0x8872,
    FRAMEBUFFER_BINDING: 0x8ca6,
    createShader: vi.fn(() => { calls.createdShaders += 1; return { id: objectId++ } as unknown as WebGLShader }),
    deleteShader: vi.fn(() => { calls.deletedShaders += 1 }),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    createProgram: vi.fn(() => { calls.createdPrograms += 1; return { id: objectId++ } as unknown as WebGLProgram }),
    deleteProgram: vi.fn(() => { calls.deletedPrograms += 1 }),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    getUniformLocation: vi.fn(() => ({ id: objectId++ } as unknown as WebGLUniformLocation)),
    uniform4fv: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    useProgram: vi.fn(),
    bindAttribLocation: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    blendFunc: vi.fn(),
    activeTexture: vi.fn(),
    bindVertexArray: vi.fn(),
    drawArrays: vi.fn(() => { calls.drawCount += 1 }),
    createFramebuffer: vi.fn(() => {
      calls.createdFramebuffers += 1
      return { id: objectId++ } as unknown as WebGLFramebuffer
    }),
    deleteFramebuffer: vi.fn(() => { calls.deletedFramebuffers += 1 }),
    bindFramebuffer: vi.fn((_target: number, framebuffer: WebGLFramebuffer | null) => { boundFramebuffer = framebuffer }),
    checkFramebufferStatus: vi.fn(() => 0x8cd5),
    createTexture: vi.fn(() => {
      calls.createdTextures += 1
      return { id: objectId++ } as unknown as WebGLTexture
    }),
    deleteTexture: vi.fn(() => { calls.deletedTextures += 1 }),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    texSubImage2D: vi.fn(),
    framebufferTexture2D: vi.fn(),
    drawBuffers: vi.fn(),
    readBuffer: vi.fn(),
    createRenderbuffer: vi.fn(() => {
      calls.createdRenderbuffers += 1
      return { id: objectId++ } as unknown as WebGLRenderbuffer
    }),
    deleteRenderbuffer: vi.fn(() => { calls.deletedRenderbuffers += 1 }),
    bindRenderbuffer: vi.fn(),
    renderbufferStorage: vi.fn(),
    framebufferRenderbuffer: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clearDepth: vi.fn(),
    clear: vi.fn(() => { calls.clearCount += 1 }),
    enable: vi.fn(),
    disable: vi.fn(),
    colorMask: vi.fn(),
    flush: vi.fn(),
    getExtension: vi.fn((name: string) => name === 'EXT_color_buffer_float' ? {} : null),
    getParameter: vi.fn((name: number) => name === 0x0d33 ? 8192 : name === 0x8872 ? 16 : name === 0x8ca6 ? boundFramebuffer : 0),
  }
  return gl as unknown as CinemaMockWebGL
}

export class CinemaResizeObserverMock {
  static instances: CinemaResizeObserverMock[] = []
  readonly observe = vi.fn()
  readonly disconnect = vi.fn()
  readonly unobserve = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    CinemaResizeObserverMock.instances.push(this)
  }

  static reset(): void {
    CinemaResizeObserverMock.instances = []
  }

  emit(target: Element, width: number, height: number): void {
    this.callback([{
      target,
      contentRect: { width, height } as DOMRectReadOnly,
    } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}
