import type {
  ShaderParamValue,
  ShaderRuntimeParameterController,
  ShaderRuntimeParameterControllerInput,
} from '../registry/shaderRegistryTypes'
import type { PrismRadialTopologyElement } from './prismRadialTopology'

export const PRISM_APERTURE_PARAMETER_ID = 'aperture' as const

export const PRISM_APERTURE_LIMITS = Object.freeze({
  min: 0,
  max: 2,
  default: 1,
  smoothingSeconds: 0.12,
  temporaryOffsetMin: -1,
  temporaryOffsetMax: 1,
})

/**
 * Clamp the persisted aperture plus a runtime-only offset into the supported
 * range. This is deliberately separate from topology/base-radius ownership.
 */
export function resolvePrismApertureTarget(baseAperture: number, temporaryOffset = 0): number {
  const base = finiteOr(baseAperture, PRISM_APERTURE_LIMITS.default)
  const offset = clamp(
    finiteOr(temporaryOffset, 0),
    PRISM_APERTURE_LIMITS.temporaryOffsetMin,
    PRISM_APERTURE_LIMITS.temporaryOffsetMax,
  )
  return clamp(base + offset, PRISM_APERTURE_LIMITS.min, PRISM_APERTURE_LIMITS.max)
}

/**
 * CPU mirror of the production GLSL transform. It derives aperture radii from
 * Stage 1 topology without changing stable element identity or base radius.
 */
export function applyPrismApertureTransform(
  element: Readonly<PrismRadialTopologyElement>,
  aperture: number,
): PrismRadialTopologyElement {
  const baseRadius = Math.max(0.001, finiteOr(element.baseRadius, 0.001))
  const resolvedAperture = resolvePrismApertureTarget(aperture)
  const radialOffset = (resolvedAperture - PRISM_APERTURE_LIMITS.default) * baseRadius * 0.3
  const innerRadius = Math.max(baseRadius * 0.015, element.innerRadius + radialOffset)
  const outerRadius = Math.max(
    innerRadius + baseRadius * 0.18,
    element.outerRadius + radialOffset * 0.62,
  )

  return {
    ...element,
    innerRadius,
    outerRadius,
  }
}

/**
 * Per-renderer runtime owner for Prism's resolved aperture. The canonical
 * authored value remains in ordinary Shader/Cinema parameter persistence;
 * smoothing and temporary offsets live only here.
 */
export class PrismApertureController implements ShaderRuntimeParameterController {
  private resolvedAperture: number = PRISM_APERTURE_LIMITS.default
  private temporaryOffset = 0
  private initialized = false

  reset(): void {
    this.resolvedAperture = PRISM_APERTURE_LIMITS.default
    this.temporaryOffset = 0
    this.initialized = false
  }

  setTemporaryOffset(parameterId: string, offset: number): void {
    if (parameterId !== PRISM_APERTURE_PARAMETER_ID) return
    this.temporaryOffset = clamp(
      finiteOr(offset, 0),
      PRISM_APERTURE_LIMITS.temporaryOffsetMin,
      PRISM_APERTURE_LIMITS.temporaryOffsetMax,
    )
  }

  clearTemporaryOffset(parameterId: string): void {
    if (parameterId !== PRISM_APERTURE_PARAMETER_ID) return
    this.temporaryOffset = 0
  }

  resolve(input: ShaderRuntimeParameterControllerInput): Record<string, ShaderParamValue> {
    const authored = input.values[PRISM_APERTURE_PARAMETER_ID]
    const baseAperture = typeof authored === 'number'
      ? authored
      : PRISM_APERTURE_LIMITS.default

    if (input.reconstruct) {
      // Runtime offsets are intentionally ephemeral. Re-entry/seek rebuilds
      // directly from the canonical user setting.
      this.temporaryOffset = 0
      this.resolvedAperture = resolvePrismApertureTarget(baseAperture)
      this.initialized = true
    } else {
      const target = resolvePrismApertureTarget(baseAperture, this.temporaryOffset)
      if (!this.initialized) {
        this.resolvedAperture = target
        this.initialized = true
      } else {
        this.resolvedAperture = smoothExp(
          this.resolvedAperture,
          target,
          input.deltaTimeSec,
          PRISM_APERTURE_LIMITS.smoothingSeconds,
        )
      }
    }

    return {
      ...input.values,
      [PRISM_APERTURE_PARAMETER_ID]: this.resolvedAperture,
    }
  }
}

export function createPrismApertureController(): ShaderRuntimeParameterController {
  return new PrismApertureController()
}

/** GLSL mirror of applyPrismApertureTransform(). */
export const PRISM_APERTURE_GLSL = `
PrismRadialElement prismApplyAperture(PrismRadialElement element, float baseRadius, float resolvedAperture) {
  float safeBaseRadius = max(baseRadius, 0.001);
  float aperture = clamp(resolvedAperture, ${PRISM_APERTURE_LIMITS.min.toFixed(1)}, ${PRISM_APERTURE_LIMITS.max.toFixed(1)});
  float radialOffset = (aperture - ${PRISM_APERTURE_LIMITS.default.toFixed(1)}) * safeBaseRadius * 0.3;
  element.innerRadius = max(safeBaseRadius * 0.015, element.innerRadius + radialOffset);
  element.outerRadius = max(
    element.innerRadius + safeBaseRadius * 0.18,
    element.outerRadius + radialOffset * 0.62
  );
  return element;
}
`

function smoothExp(current: number, target: number, deltaTimeSec: number, timeConstantSec: number): number {
  if (!Number.isFinite(current)) return target
  const dt = Math.max(0, finiteOr(deltaTimeSec, 0))
  if (dt <= 0 || timeConstantSec <= 0) return current
  const alpha = 1 - Math.exp(-dt / timeConstantSec)
  return current + (target - current) * alpha
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
