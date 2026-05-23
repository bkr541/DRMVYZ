/**
 * Pure, testable utilities for selecting the active renderer type.
 *
 * Kept separate from WebGL2Renderer so they can run in Node/Vitest
 * without a real browser environment (probe functions guard with typeof checks).
 */

/**
 * Returns true if the current environment can create a WebGL2 context.
 * Attempts a real canvas.getContext('webgl2') and immediately tears it down.
 */
export function probeWebGL2Support(): boolean {
  if (typeof document === 'undefined') return false
  if (typeof WebGL2RenderingContext === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    if (!gl) return false
    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
    return true
  } catch {
    return false
  }
}

export interface RendererResolution {
  type: 'canvas2d' | 'webgl2'
  fallbackReason: string | null
}

/**
 * Resolves a user GPU preference into the renderer type that should actually
 * be used, probing hardware support when required.
 *
 * 'auto'    → WebGL2 if available, otherwise Canvas 2D
 * 'webgl2'  → WebGL2 if available, otherwise Canvas 2D + reason
 * 'canvas2d'→ Canvas 2D unconditionally
 */
export function resolveRendererType(
  preference: 'auto' | 'webgl2' | 'canvas2d',
): RendererResolution {
  if (preference === 'canvas2d') {
    return { type: 'canvas2d', fallbackReason: null }
  }
  if (!probeWebGL2Support()) {
    return {
      type: 'canvas2d',
      fallbackReason: preference === 'webgl2'
        ? 'WebGL2 not available in this browser'
        : null,
    }
  }
  return { type: 'webgl2', fallbackReason: null }
}
