/**
 * Developer-only accounting of what a WebGL2 context is doing: draw calls and triangles per frame, textures / buffers / renderbuffers / framebuffers
 * and their estimated bytes, and shader compile / link activity.
 *
 * It works by wrapping the context's own methods with thin counting versions while attached, and removing the wrappers on `detach()`. It reads
 * nothing back from the GPU and never blocks. It sees only resources created *after* it attached, so attach it before the scene loads (the
 * validation scene does); `trackedSince` in the snapshot says when it started. Byte figures are estimates from format tables (a mip chain is
 * counted as +1/3 once `generateMipmap` or `texStorage*` says there is one); drivers may pad or compress.
 *
 * Nothing attaches it by default, so presets that do not use it pay nothing.
 */
const GL = {
  TEXTURE_2D: 0x0de1, TEXTURE_3D: 0x806f, TEXTURE_2D_ARRAY: 0x8c1a, TEXTURE_CUBE_MAP: 0x8513,
  ARRAY_BUFFER: 0x8892, ELEMENT_ARRAY_BUFFER: 0x8893, RENDERBUFFER: 0x8d41,
  POINTS: 0x0000, LINES: 0x0001, LINE_LOOP: 0x0002, LINE_STRIP: 0x0003, TRIANGLES: 0x0004, TRIANGLE_STRIP: 0x0005, TRIANGLE_FAN: 0x0006,
  TEXTURE0: 0x84c0,
} as const

/** Bytes per texel for sized internal formats. */
const SIZED_BYTES: Readonly<Record<number, number>> = Object.freeze({
  0x8229: 1, // R8
  0x822b: 2, // RG8
  0x8058: 4, // RGBA8
  0x8c43: 4, // SRGB8_ALPHA8
  0x8051: 3, // RGB8
  0x8c41: 3, // SRGB8
  0x8d62: 2, // RGB565
  0x8056: 2, // RGBA4
  0x8057: 2, // RGB5_A1
  0x822d: 2, // R16F
  0x822f: 4, // RG16F
  0x881a: 8, // RGBA16F
  0x881b: 6, // RGB16F
  0x822e: 4, // R32F
  0x8230: 8, // RG32F
  0x8814: 16, // RGBA32F
  0x8815: 12, // RGB32F
  0x8c3a: 4, // R11F_G11F_B10F
  0x8059: 4, // RGB10_A2
  0x81a5: 2, // DEPTH_COMPONENT16
  0x81a6: 3, // DEPTH_COMPONENT24
  0x8cac: 4, // DEPTH_COMPONENT32F
  0x88f0: 4, // DEPTH24_STENCIL8
  0x8cad: 5, // DEPTH32F_STENCIL8
  0x8232: 1, // R8UI
  0x8236: 4, // R32UI
  0x8d48: 1, // STENCIL_INDEX8
})

const COMPONENTS: Readonly<Record<number, number>> = Object.freeze({ 0x1908: 4, 0x1907: 3, 0x190a: 2, 0x1909: 1, 0x1903: 1, 0x8227: 2 })
const TYPE_BYTES: Readonly<Record<number, number>> = Object.freeze({ 0x1401: 1, 0x1403: 2, 0x1405: 4, 0x1406: 4, 0x140b: 2, 0x8d61: 2, 0x8033: 2, 0x8034: 2, 0x8363: 2 })

export function cinema2TexelBytes(internalFormat: number, format?: number, type?: number): number {
  const sized = SIZED_BYTES[internalFormat]
  if (sized !== undefined) return sized
  // Unsized (RGBA, RGB, LUMINANCE...) formats take their size from the upload type.
  const components = COMPONENTS[format ?? internalFormat] ?? COMPONENTS[internalFormat] ?? 4
  const typeBytes = type !== undefined ? (TYPE_BYTES[type] ?? 1) : 1
  // Packed types (4444, 5551, 565) are 2 bytes per texel whatever the component count.
  if (type === 0x8033 || type === 0x8034 || type === 0x8363) return 2
  return components * typeBytes
}

function levelBytes(width: number, height: number, depth: number, texel: number): number {
  return Math.max(1, width) * Math.max(1, height) * Math.max(1, depth) * texel
}

function chainBytes(width: number, height: number, depth: number, levels: number, texel: number): number {
  let total = 0
  let w = width, h = height, d = depth
  for (let level = 0; level < levels; level += 1) {
    total += levelBytes(w, h, d, texel)
    w = Math.max(1, w >> 1)
    h = Math.max(1, h >> 1)
    d = Math.max(1, d >> 1)
  }
  return total
}

/** Texture memory: explicit levels from `texImage*`, or a fixed total from `texStorage*`; `generateMipmap` adds the rest of the chain. */
interface TextureRecord { levels: Map<number, number>; fixed: number | null; mipped: boolean }

function textureBytes(record: TextureRecord): number {
  if (record.fixed !== null) return record.fixed
  const base = record.levels.get(0) ?? 0
  if (record.mipped) return Math.round(base * 4 / 3)
  let total = 0
  for (const bytes of record.levels.values()) total += bytes
  return total
}

export interface Cinema2GlFrameCounters {
  drawCalls: number
  triangles: number
  lines: number
  points: number
  programLinks: number
  shaderCompiles: number
  textureUploads: number
}

export interface Cinema2GlResourceSnapshot {
  trackedSince: number
  textures: Readonly<{ count: number; bytes: number }>
  buffers: Readonly<{ count: number; bytes: number }>
  renderbuffers: Readonly<{ count: number; bytes: number }>
  framebuffers: Readonly<{ count: number; createdTotal: number }>
  programs: Readonly<{ count: number; linkedTotal: number; compiledTotal: number; linkMsTotal: number }>
  estimatedGpuBytes: number
  /** Counters of the last completed frame. */
  lastFrame: Readonly<Cinema2GlFrameCounters>
  /** Counters of the frame in progress. */
  currentFrame: Readonly<Cinema2GlFrameCounters>
}

const WRAPPED = [
  'createTexture', 'deleteTexture', 'bindTexture', 'activeTexture', 'texImage2D', 'texImage3D', 'texStorage2D', 'texStorage3D',
  'compressedTexImage2D', 'compressedTexImage3D', 'generateMipmap',
  'createBuffer', 'deleteBuffer', 'bindBuffer', 'bufferData',
  'createRenderbuffer', 'deleteRenderbuffer', 'bindRenderbuffer', 'renderbufferStorage', 'renderbufferStorageMultisample',
  'createFramebuffer', 'deleteFramebuffer',
  'createProgram', 'deleteProgram', 'linkProgram', 'compileShader',
  'drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements',
] as const
type WrappedName = typeof WRAPPED[number]

function emptyCounters(): Cinema2GlFrameCounters {
  return { drawCalls: 0, triangles: 0, lines: 0, points: 0, programLinks: 0, shaderCompiles: 0, textureUploads: 0 }
}

function primitiveCount(mode: number, count: number): { triangles: number; lines: number; points: number } {
  switch (mode) {
    case GL.TRIANGLES: return { triangles: Math.floor(count / 3), lines: 0, points: 0 }
    case GL.TRIANGLE_STRIP:
    case GL.TRIANGLE_FAN: return { triangles: Math.max(0, count - 2), lines: 0, points: 0 }
    case GL.LINES: return { triangles: 0, lines: Math.floor(count / 2), points: 0 }
    case GL.LINE_STRIP: return { triangles: 0, lines: Math.max(0, count - 1), points: 0 }
    case GL.LINE_LOOP: return { triangles: 0, lines: count, points: 0 }
    case GL.POINTS: return { triangles: 0, lines: 0, points: count }
    default: return { triangles: 0, lines: 0, points: 0 }
  }
}

export class Cinema2GlResourceTracker {
  private readonly originals = new Map<WrappedName, unknown>()
  private readonly textures = new Map<WebGLTexture, TextureRecord>()
  private readonly buffers = new Map<WebGLBuffer, number>()
  private readonly renderbuffers = new Map<WebGLRenderbuffer, number>()
  private readonly framebuffers = new Set<WebGLFramebuffer>()
  private readonly programs = new Set<WebGLProgram>()
  private readonly boundTextures = new Map<string, WebGLTexture | null>()
  private readonly boundBuffers = new Map<number, WebGLBuffer | null>()
  private boundRenderbuffer: WebGLRenderbuffer | null = null
  private activeUnit = 0
  private current = emptyCounters()
  private last = emptyCounters()
  private framebuffersCreated = 0
  private programsLinked = 0
  private shadersCompiled = 0
  private linkMs = 0
  private attached = false
  private since = 0

  constructor(private readonly gl: WebGL2RenderingContext, private readonly now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {}

  get isAttached(): boolean {
    return this.attached
  }

  attach(): void {
    if (this.attached) return
    this.attached = true
    this.since = this.now()
    const gl = this.gl as unknown as Record<string, (...args: unknown[]) => unknown>
    const wrap = (name: WrappedName, make: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown): void => {
      const original = gl[name]
      if (typeof original !== 'function') return
      this.originals.set(name, Object.prototype.hasOwnProperty.call(this.gl, name) ? original : undefined)
      const bound = original.bind(this.gl)
      gl[name] = make(bound)
    }
    const key = (unit: number, target: number): string => `${unit}:${target}`
    const bound = (target: number): WebGLTexture | null => this.boundTextures.get(key(this.activeUnit, target)) ?? null
    const recordOf = (texture: WebGLTexture): TextureRecord => {
      let record = this.textures.get(texture)
      if (!record) { record = { levels: new Map(), fixed: null, mipped: false }; this.textures.set(texture, record) }
      return record
    }
    const addTexture = (target: number, bytes: number, level: number): void => {
      const texture = bound(target)
      if (!texture) return
      recordOf(texture).levels.set(level, bytes)
      this.current.textureUploads += 1
    }

    wrap('createTexture', original => () => { const texture = original() as WebGLTexture | null; if (texture) recordOf(texture); return texture })
    wrap('deleteTexture', original => (texture) => { this.textures.delete(texture as WebGLTexture); return original(texture) })
    wrap('activeTexture', original => (unit) => { this.activeUnit = (unit as number) - GL.TEXTURE0; return original(unit) })
    wrap('bindTexture', original => (target, texture) => { this.boundTextures.set(key(this.activeUnit, target as number), (texture as WebGLTexture | null) ?? null); return original(target, texture) })
    wrap('texImage2D', original => (...args) => {
      const target = args[0] as number
      const level = args[1] as number
      const internal = args[2] as number
      if (args.length >= 9) addTexture(target, levelBytes(args[3] as number, args[4] as number, 1, cinema2TexelBytes(internal, args[6] as number, args[7] as number)), level)
      else {
        const source = args[5] as { width?: number; height?: number; videoWidth?: number; videoHeight?: number } | undefined
        const width = source?.width ?? source?.videoWidth ?? 0
        const height = source?.height ?? source?.videoHeight ?? 0
        addTexture(target, levelBytes(width, height, 1, cinema2TexelBytes(internal, args[3] as number, args[4] as number)), level)
      }
      return original(...args)
    })
    wrap('texImage3D', original => (...args) => {
      addTexture(args[0] as number, levelBytes(args[3] as number, args[4] as number, args[5] as number, cinema2TexelBytes(args[2] as number, args[7] as number, args[8] as number)), args[1] as number)
      return original(...args)
    })
    wrap('texStorage2D', original => (target, levels, internal, width, height) => {
      const texture = bound(target as number)
      if (texture) {
        recordOf(texture).fixed = chainBytes(width as number, height as number, 1, levels as number, cinema2TexelBytes(internal as number))
        this.current.textureUploads += 1
      }
      return original(target, levels, internal, width, height)
    })
    wrap('texStorage3D', original => (target, levels, internal, width, height, depth) => {
      const texture = bound(target as number)
      if (texture) {
        recordOf(texture).fixed = chainBytes(width as number, height as number, depth as number, levels as number, cinema2TexelBytes(internal as number))
        this.current.textureUploads += 1
      }
      return original(target, levels, internal, width, height, depth)
    })
    const compressed = (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => {
      const data = args.find(arg => ArrayBuffer.isView(arg)) as ArrayBufferView | undefined
      const sizeArg = args.find((arg, index) => index >= 6 && typeof arg === 'number') as number | undefined
      addTexture(args[0] as number, data?.byteLength ?? sizeArg ?? 0, args[1] as number)
      return original(...args)
    }
    wrap('compressedTexImage2D', compressed)
    wrap('compressedTexImage3D', compressed)
    wrap('generateMipmap', original => (target) => {
      const texture = bound(target as number)
      const record = texture ? this.textures.get(texture) : undefined
      if (record) record.mipped = true
      return original(target)
    })

    wrap('createBuffer', original => () => { const buffer = original() as WebGLBuffer | null; if (buffer) this.buffers.set(buffer, 0); return buffer })
    wrap('deleteBuffer', original => (buffer) => { this.buffers.delete(buffer as WebGLBuffer); return original(buffer) })
    wrap('bindBuffer', original => (target, buffer) => { this.boundBuffers.set(target as number, (buffer as WebGLBuffer | null) ?? null); return original(target, buffer) })
    wrap('bufferData', original => (...args) => {
      const buffer = this.boundBuffers.get(args[0] as number)
      if (buffer) {
        const source = args[1] as number | ArrayBufferView | ArrayBuffer | null
        const bytes = typeof source === 'number' ? source : source ? source.byteLength : 0
        this.buffers.set(buffer, bytes)
      }
      return original(...args)
    })

    wrap('createRenderbuffer', original => () => { const rb = original() as WebGLRenderbuffer | null; if (rb) this.renderbuffers.set(rb, 0); return rb })
    wrap('deleteRenderbuffer', original => (rb) => { this.renderbuffers.delete(rb as WebGLRenderbuffer); return original(rb) })
    wrap('bindRenderbuffer', original => (target, rb) => { this.boundRenderbuffer = (rb as WebGLRenderbuffer | null) ?? null; return original(target, rb) })
    wrap('renderbufferStorage', original => (target, internal, width, height) => {
      if (this.boundRenderbuffer) this.renderbuffers.set(this.boundRenderbuffer, levelBytes(width as number, height as number, 1, cinema2TexelBytes(internal as number)))
      return original(target, internal, width, height)
    })
    wrap('renderbufferStorageMultisample', original => (target, samples, internal, width, height) => {
      if (this.boundRenderbuffer) this.renderbuffers.set(this.boundRenderbuffer, levelBytes(width as number, height as number, 1, cinema2TexelBytes(internal as number)) * Math.max(1, samples as number))
      return original(target, samples, internal, width, height)
    })

    wrap('createFramebuffer', original => () => { const fb = original() as WebGLFramebuffer | null; if (fb) { this.framebuffers.add(fb); this.framebuffersCreated += 1 } return fb })
    wrap('deleteFramebuffer', original => (fb) => { this.framebuffers.delete(fb as WebGLFramebuffer); return original(fb) })

    wrap('createProgram', original => () => { const program = original() as WebGLProgram | null; if (program) this.programs.add(program); return program })
    wrap('deleteProgram', original => (program) => { this.programs.delete(program as WebGLProgram); return original(program) })
    wrap('compileShader', original => (shader) => { this.shadersCompiled += 1; this.current.shaderCompiles += 1; return original(shader) })
    wrap('linkProgram', original => (program) => {
      const started = this.now()
      const result = original(program)
      this.linkMs += this.now() - started
      this.programsLinked += 1
      this.current.programLinks += 1
      return result
    })

    const draw = (kind: 'arrays' | 'elements') => (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => {
      const mode = args[0] as number
      const count = (kind === 'arrays' ? args[2] : args[1]) as number
      const primitives = primitiveCount(mode, count)
      this.current.drawCalls += 1
      this.current.triangles += primitives.triangles
      this.current.lines += primitives.lines
      this.current.points += primitives.points
      return original(...args)
    }
    wrap('drawArrays', draw('arrays'))
    wrap('drawElements', draw('elements'))
    // Instanced draws carry the instance count in the last positional argument.
    wrap('drawArraysInstanced', original => (mode, first, count, instances) => {
      const primitives = primitiveCount(mode as number, count as number)
      this.current.drawCalls += 1
      this.current.triangles += primitives.triangles * (instances as number)
      this.current.lines += primitives.lines * (instances as number)
      this.current.points += primitives.points * (instances as number)
      return original(mode, first, count, instances)
    })
    wrap('drawElementsInstanced', original => (mode, count, type, offset, instances) => {
      const primitives = primitiveCount(mode as number, count as number)
      this.current.drawCalls += 1
      this.current.triangles += primitives.triangles * (instances as number)
      this.current.lines += primitives.lines * (instances as number)
      this.current.points += primitives.points * (instances as number)
      return original(mode, count, type, offset, instances)
    })
    wrap('drawRangeElements', original => (mode, start, end, count, type, offset) => {
      const primitives = primitiveCount(mode as number, count as number)
      this.current.drawCalls += 1
      this.current.triangles += primitives.triangles
      this.current.lines += primitives.lines
      this.current.points += primitives.points
      return original(mode, start, end, count, type, offset)
    })
  }

  /** Removes every wrapper, leaving the context exactly as it was. */
  detach(): void {
    if (!this.attached) return
    this.attached = false
    const gl = this.gl as unknown as Record<string, unknown>
    for (const name of this.originals.keys()) delete gl[name]
    // A method that was an own property before attach (rare) is restored to its original value.
    for (const [name, original] of this.originals) if (original !== undefined) gl[name] = original
    this.originals.clear()
  }

  beginFrame(): void {
    this.current = emptyCounters()
  }

  endFrame(): void {
    this.last = this.current
    this.current = emptyCounters()
  }

  /** The context was lost: every handle is gone. Counters keep running for the restored context. */
  handleContextLost(): void {
    this.textures.clear()
    this.buffers.clear()
    this.renderbuffers.clear()
    this.framebuffers.clear()
    this.programs.clear()
    this.boundTextures.clear()
    this.boundBuffers.clear()
    this.boundRenderbuffer = null
  }

  getSnapshot(): Readonly<Cinema2GlResourceSnapshot> {
    let texBytes = 0
    for (const record of this.textures.values()) texBytes += textureBytes(record)
    let bufferBytes = 0
    for (const bytes of this.buffers.values()) bufferBytes += bytes
    let renderbufferBytes = 0
    for (const bytes of this.renderbuffers.values()) renderbufferBytes += bytes
    return Object.freeze({
      trackedSince: this.since,
      textures: Object.freeze({ count: this.textures.size, bytes: Math.round(texBytes) }),
      buffers: Object.freeze({ count: this.buffers.size, bytes: bufferBytes }),
      renderbuffers: Object.freeze({ count: this.renderbuffers.size, bytes: renderbufferBytes }),
      framebuffers: Object.freeze({ count: this.framebuffers.size, createdTotal: this.framebuffersCreated }),
      programs: Object.freeze({ count: this.programs.size, linkedTotal: this.programsLinked, compiledTotal: this.shadersCompiled, linkMsTotal: this.linkMs }),
      estimatedGpuBytes: Math.round(texBytes + bufferBytes + renderbufferBytes),
      lastFrame: Object.freeze({ ...this.last }),
      currentFrame: Object.freeze({ ...this.current }),
    })
  }
}
