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
