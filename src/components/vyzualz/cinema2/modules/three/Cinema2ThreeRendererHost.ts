import type * as ThreeNamespace from 'three'
import type { Cinema2ThreeLibrary } from './Cinema2ThreeLibrary'

/**
 * One Three renderer per WebGL context, kept for the context's lifetime.
 *
 * `WebGLRenderer.dispose()` does not delete the scratch framebuffers and empty textures its constructor creates, and
 * `PMREMGenerator` leaves a buffer behind on every use (measured on 0.186 in the #5 spike). Creating a renderer or an
 * environment per preset switch would therefore leak steadily. Modules dispose their scene content (geometry, materials,
 * textures) but never the renderer; the renderer and the generated environment are dropped only when the context is lost,
 * because GPU-generated resources come back empty after a restore.
 */
export interface Cinema2ThreeRendererEntry {
  readonly renderer: ThreeNamespace.WebGLRenderer
  /** Image-based lighting texture, generated on first use and reused by every module on this context. */
  getEnvironment(): ThreeNamespace.Texture
  /**
   * A shipped equirectangular `.hdr` environment, fetched and filtered into an image-based-lighting texture once per URL and shared by every module
   * on this context. Rejects when the file cannot be fetched or decoded (callers fall back to `getEnvironment`).
   */
  loadEnvironment(url: string): Promise<ThreeNamespace.Texture>
}

const entries = new WeakMap<WebGL2RenderingContext, Cinema2ThreeRendererEntry>()

export function getCinema2ThreeRenderer(library: Cinema2ThreeLibrary, gl: WebGL2RenderingContext): Cinema2ThreeRendererEntry {
  const existing = entries.get(gl)
  if (existing) return existing
  const { THREE, RoomEnvironment } = library
  const canvas = gl.canvas as HTMLCanvasElement
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, alpha: false, depth: false, stencil: false })
  // The engine owns clearing and grading: Three only draws lit geometry into the engine target as display-referred sRGB.
  renderer.autoClear = false
  renderer.toneMapping = THREE.NoToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace

  let environment: ThreeNamespace.Texture | null = null
  const shipped = new Map<string, Promise<ThreeNamespace.Texture>>()
  const entry: Cinema2ThreeRendererEntry = Object.freeze({
    renderer,
    getEnvironment() {
      if (!environment) {
        const generator = new THREE.PMREMGenerator(renderer)
        const room = new RoomEnvironment()
        const target = generator.fromScene(room as ThreeNamespace.Scene, 0.04)
        room.dispose()
        generator.dispose()
        renderer.resetState()
        environment = target.texture
      }
      return environment
    },
    loadEnvironment(url: string) {
      const cached = shipped.get(url)
      if (cached) return cached
      const pending = (async () => {
        // A dev server or the app protocol can answer a missing file with an HTML fallback page and status 200; the loader would then fail
        // with a confusing parse error, so check what came back first.
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Environment request for "${url}" failed with HTTP ${response.status}.`)
        const buffer = await response.arrayBuffer()
        const head = new TextDecoder('latin1').decode(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)))
        if (!/^#\?(RADIANCE|RGBE)/.test(head)) throw new Error(`Environment "${url}" is not a Radiance .hdr file.`)
        const data = new library.HDRLoader().parse(buffer)
        const source = new THREE.DataTexture(data.data, data.width, data.height, data.format, data.type)
        source.mapping = THREE.EquirectangularReflectionMapping
        source.minFilter = THREE.LinearFilter
        source.magFilter = THREE.LinearFilter
        source.generateMipmaps = false
        source.flipY = true
        source.needsUpdate = true
        const generator = new THREE.PMREMGenerator(renderer)
        const target = generator.fromEquirectangular(source)
        source.dispose()
        generator.dispose()
        renderer.resetState()
        return target.texture
      })()
      // A failed load is not cached, so a later activation can retry.
      pending.catch(() => { if (shipped.get(url) === pending) shipped.delete(url) })
      shipped.set(url, pending)
      return pending
    },
  })
  entries.set(gl, entry)

  const onContextLost = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost)
    if (entries.get(gl) === entry) entries.delete(gl)
    try { renderer.dispose() } catch { /* The context is already gone; Three only needs its listeners removed. */ }
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  return entry
}

/** Test seam: forget the renderer for a context. */
export function forgetCinema2ThreeRendererForTests(gl: WebGL2RenderingContext): void {
  entries.delete(gl)
}
