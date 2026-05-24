/**
 * Pure, testable utilities for selecting the active renderer type and
 * computing renderer fallback status for diagnostics.
 *
 * Kept separate from WebGL2Renderer so they can run in Node/Vitest
 * without a real browser environment (probe functions guard with typeof checks).
 */

export type GpuPreference = 'auto' | 'webgl2' | 'canvas2d'

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
 * 'auto'    → WebGL2 if available, otherwise Canvas 2D (silent)
 * 'webgl2'  → WebGL2 if available, otherwise Canvas 2D + reason
 * 'canvas2d'→ Canvas 2D unconditionally
 */
export function resolveRendererType(
  preference: GpuPreference,
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

/**
 * Pure 2-argument renderer decision function.
 * Accepts an already-resolved `webgl2Available` flag so callers control
 * when/how support is probed (useful for testing without a real browser).
 *
 * resolvePreferredRenderer('canvas2d', *)     → 'canvas2d'
 * resolvePreferredRenderer('auto',    true)   → 'webgl2'
 * resolvePreferredRenderer('auto',    false)  → 'canvas2d'
 * resolvePreferredRenderer('webgl2',  true)   → 'webgl2'
 * resolvePreferredRenderer('webgl2',  false)  → 'canvas2d'
 */
export function resolvePreferredRenderer(
  preference: GpuPreference,
  webgl2Available: boolean,
): 'webgl2' | 'canvas2d' {
  if (preference === 'canvas2d') return 'canvas2d'
  return webgl2Available ? 'webgl2' : 'canvas2d'
}

// ── Fallback status ───────────────────────────────────────────────────────────

export type FallbackSeverity = 'none' | 'info' | 'warning' | 'critical'

export interface FallbackStatus {
  /** True when the UI should display a fallback/warning notice. */
  showFallbackWarning: boolean
  /** Severity level for styling: none = no notice, info = subtle, warning = amber, critical = red. */
  severity: FallbackSeverity
}

/**
 * Pure function: computes whether and how prominently to surface renderer
 * fallback information to the performer.
 *
 * Rules:
 * - Canvas 2D was intentionally chosen → no warning (never a fallback scenario)
 * - Auto or GPU preference, context lost → elevated warning (severity depends on preference)
 * - Auto or GPU preference, init failed  → informational (or warning for explicit webgl2)
 * - Everything working                  → no warning
 */
export function computeFallbackStatus(
  gpuPreference: GpuPreference,
  activeRenderer: 'canvas2d' | 'webgl2',
  contextLost: boolean,
  fallbackReason: string | null,
): FallbackStatus {
  // Intentional Canvas 2D — never a failure, never show a warning
  if (gpuPreference === 'canvas2d') {
    return { showFallbackWarning: false, severity: 'none' }
  }

  // Runtime context loss — GPU went away during playback
  if (contextLost) {
    return {
      showFallbackWarning: true,
      severity: gpuPreference === 'webgl2' ? 'critical' : 'warning',
    }
  }

  // Initialisation failure — GPU couldn't start
  if (fallbackReason !== null && activeRenderer === 'canvas2d') {
    return {
      showFallbackWarning: true,
      severity: gpuPreference === 'webgl2' ? 'warning' : 'info',
    }
  }

  return { showFallbackWarning: false, severity: 'none' }
}
