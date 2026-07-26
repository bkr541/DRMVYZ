import type { LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import { clipLaserDmxSceneSegment, projectLaserDmxScenePoint } from './LaserDmxSpatialModel'
import {
  buildLaserDmxScannerExposurePlan,
  resolveLaserDmxScannerExposureDensity,
  type LaserDmxScannerExposureGeometry,
  type LaserDmxScannerWebGLInputValidation,
} from './LaserDmxScannerWebGLPlan'

export interface LaserDmxCanvas2DScannerSegment {
  id: string
  fixtureId: string
  geometry: LaserDmxScannerExposureGeometry
  origin: { x: number; y: number }
  target: { x: number; y: number }
  color: { r: number; g: number; b: number; a: number }
  density: number
  dwellWeight: number
  velocityRatio: number
  historyWeight: number
  stable: boolean
  animated: boolean
}

export interface LaserDmxCanvas2DScannerPlan {
  segments: LaserDmxCanvas2DScannerSegment[]
  validation: LaserDmxScannerWebGLInputValidation
  averageHistoryWeight: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function rgba(color: LaserDmxCanvas2DScannerSegment['color'], alpha: number): string {
  return `rgba(${Math.round(clamp01(color.r) * 255)}, ${Math.round(clamp01(color.g) * 255)}, ${Math.round(clamp01(color.b) * 255)}, ${clamp01(alpha)})`
}

/**
 * Projects the exact same authoritative scanner exposure plan used by WebGL.
 * No Canvas-local oscillator, phase advance, fan sweep, or retrace is allowed.
 */
export function buildLaserDmxCanvas2DScannerPlan(
  frame: LaserDmxSceneFrame,
  width: number,
  height: number,
): LaserDmxCanvas2DScannerPlan {
  const scannerPlan = buildLaserDmxScannerExposurePlan(frame)
  const aspect = Math.max(0.5, width / Math.max(1, height))
  const segments = scannerPlan.segments.flatMap((segment): LaserDmxCanvas2DScannerSegment[] => {
    const clipped = clipLaserDmxSceneSegment(frame.camera, segment.origin, segment.target)
    if (!clipped) return []
    const origin = projectLaserDmxScenePoint(frame.camera, clipped.origin, aspect)
    const target = projectLaserDmxScenePoint(frame.camera, clipped.target, aspect)
    if (!origin.visible && !target.visible) return []
    const density = resolveLaserDmxScannerExposureDensity(frame, segment)
    if (density <= 0) return []
    return [{
      id: segment.id,
      fixtureId: segment.fixtureId,
      geometry: segment.geometry,
      origin: { x: origin.x * width, y: (1 - origin.y) * height },
      target: { x: target.x * width, y: (1 - target.y) * height },
      color: { ...segment.color },
      density,
      dwellWeight: segment.dwellWeight,
      velocityRatio: segment.velocityRatio,
      historyWeight: segment.historyWeight,
      stable: segment.stable,
      animated: segment.animated,
    }]
  })
  const averageHistoryWeight = segments.length > 0
    ? segments.reduce((sum, segment) => sum + segment.historyWeight, 0) / segments.length
    : 0
  return { segments, validation: scannerPlan.validation, averageHistoryWeight }
}

export function renderLaserDmxCanvas2DScannerPlan(
  ctx: CanvasRenderingContext2D,
  frame: LaserDmxSceneFrame,
  plan: LaserDmxCanvas2DScannerPlan,
  intensity: number,
  glow: number,
): void {
  if (frame.output.blackout || plan.segments.length === 0) return
  const atmosphere = frame.atmosphere.enabled
    ? clamp01(frame.atmosphere.opacity * 0.42 + frame.atmosphere.beamScatter * 0.58)
    : 0
  const globalWidth = clamp(frame.output.globalBeamWidth, 0.1, 6)
  const masterIntensity = clamp01(intensity)
  const globalGlow = clamp01(glow)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const segment of plan.segments) {
    const scannerIntensity = clamp(segment.density * masterIntensity, 0, 1.25)
    if (scannerIntensity <= 0.001) continue
    const isStroke = segment.geometry === 'scanStroke'
    const isIntegrated = segment.geometry === 'scanExposure'
    const speedTightening = isStroke ? 0.78 + (1 - segment.velocityRatio) * 0.12 : 1
    const bodyWidth = clamp((isIntegrated ? 1.3 : isStroke ? 0.62 : 0.9) * globalWidth * speedTightening, 0.45, isIntegrated ? 4.2 : isStroke ? 2.2 : 3.1)
    const glowWidth = clamp(bodyWidth * (isIntegrated ? 4.2 : 2.4 + atmosphere * 2 + globalGlow * 1.2), bodyWidth * 1.8, isIntegrated ? 22 : isStroke ? 9 : 14)
    const glowAlpha = clamp(scannerIntensity * (isIntegrated ? 0.045 : 0.055 + atmosphere * 0.12 + globalGlow * 0.055), 0, isIntegrated ? 0.15 : 0.24)
    const bodyAlpha = clamp(scannerIntensity * (isIntegrated ? 0.26 : isStroke ? 0.62 : 0.76), 0, isIntegrated ? 0.48 : 0.9)
    const coreAlpha = clamp(Math.sqrt(scannerIntensity) * (isIntegrated ? 0.18 : isStroke ? 0.58 : 0.72), 0, isIntegrated ? 0.34 : 0.94)

    ctx.beginPath()
    ctx.moveTo(segment.origin.x, segment.origin.y)
    ctx.lineTo(segment.target.x, segment.target.y)
    ctx.lineWidth = glowWidth
    ctx.strokeStyle = rgba(segment.color, glowAlpha)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(segment.origin.x, segment.origin.y)
    ctx.lineTo(segment.target.x, segment.target.y)
    ctx.lineWidth = bodyWidth
    ctx.strokeStyle = rgba(segment.color, bodyAlpha)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(segment.origin.x, segment.origin.y)
    ctx.lineTo(segment.target.x, segment.target.y)
    ctx.lineWidth = clamp(bodyWidth * 0.34, 0.3, 0.9)
    ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha})`
    ctx.stroke()
  }
  ctx.restore()
}
