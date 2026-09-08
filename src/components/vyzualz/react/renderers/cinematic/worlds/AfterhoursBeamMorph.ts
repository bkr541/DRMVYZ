import {
  AFTERHOURS_MAX_BEAMS,
  intersectAfterhoursRayWithViewport,
  normalizeAfterhoursRayDirection,
  type AfterhoursBeamDescriptor,
  type AfterhoursEmitter,
  type AfterhoursRayDirection,
} from './AfterhoursBeamGeometry'

export interface AfterhoursRenderBeam {
  active: boolean
  origin: AfterhoursEmitter
  direction: AfterhoursRayDirection
  endpoint: AfterhoursEmitter
  /** Compatibility alias; always identical to the derived viewport-exit endpoint. */
  target: AfterhoursEmitter
  accent: boolean
  /** Hard scanner blanking state; retrace must never become a visible morph segment. */
  blanked: boolean
  /** 0..1 render weight — drives per-beam fade in/out across a variation morph. */
  weight: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smooth(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/**
 * Blend two deterministic generator frames while preserving the Stage 1-5 ray
 * contract. Emitter origins remain fixed and ray directions are re-intersected
 * with the viewport, so choreography morphs cannot create floating endpoints.
 */
export function blendAfterhoursBeamFrames(
  previous: readonly AfterhoursBeamDescriptor[],
  next: readonly AfterhoursBeamDescriptor[],
  transition: number,
  viewportAspectRatio = 16 / 9,
): readonly AfterhoursRenderBeam[] {
  const k = smooth(transition)
  const out: AfterhoursRenderBeam[] = []
  for (let index = 0; index < AFTERHOURS_MAX_BEAMS; index += 1) {
    const a = previous[index]
    const b = next[index]
    if (a.active && b.active) {
      const direction = normalizeAfterhoursRayDirection({
        x: mix(a.direction.x, b.direction.x, k),
        y: mix(a.direction.y, b.direction.y, k),
      }, b.direction)
      const endpoint = intersectAfterhoursRayWithViewport(b.origin, direction, viewportAspectRatio)
      out.push({
        active: true,
        origin: b.origin,
        direction,
        endpoint,
        target: endpoint,
        accent: b.accent,
        blanked: a.blanked || b.blanked,
        weight: 1,
      })
    } else if (b.active) {
      out.push({ active: true, origin: b.origin, direction: b.direction, endpoint: b.endpoint, target: b.endpoint, accent: b.accent, blanked: b.blanked, weight: k })
    } else if (a.active) {
      out.push({ active: true, origin: a.origin, direction: a.direction, endpoint: a.endpoint, target: a.endpoint, accent: a.accent, blanked: a.blanked, weight: 1 - k })
    } else {
      out.push({ active: false, origin: b.origin, direction: b.direction, endpoint: b.endpoint, target: b.endpoint, accent: false, blanked: false, weight: 0 })
    }
  }
  return out
}
