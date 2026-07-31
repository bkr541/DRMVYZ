import type {
  PixGridAudioFrame,
  PixGridBuiltInAssetManifestEntry,
  PixGridLayer,
  PixGridLayerAnimation,
} from './PixGridTypes'
import {
  PIX_GRID_NEON_MARQUEE_ASSET_ID,
  PIX_GRID_NEON_MARQUEE_LAYER_ID,
  resolvePixGridNeonMarqueePerformance,
} from './PixGridNeonMarqueePerformance'
import { resolvePixGridMotionMultiplier } from './PixGridRuntimeControls'

export interface PixGridResolvedLayerAnimation {
  positionX: number
  positionY: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
  paletteOffset: number
  revealRow: number
  revealColumn: number
  revealRowFrom: 'start' | 'end' | 'center'
  revealColumnFrom: 'start' | 'end' | 'center'
  checkerAlternate: boolean
  frameIndex: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function triangle(value: number): number {
  const phase = fract(value)
  return 1 - Math.abs(phase * 2 - 1)
}

export function resolvePixGridBoundedValue(
  base: number,
  offset: number,
  boundary: PixGridLayerAnimation['boundary'],
  min = 0,
  max = 1,
): number {
  const range = Math.max(0.000001, max - min)
  const raw = base + offset
  if (boundary === 'clamp') return Math.max(min, Math.min(max, raw))
  if (boundary === 'bounce') return min + triangle((raw - min) / (range * 2)) * range
  return min + fract((raw - min) / range) * range
}

function audioValue(frame: PixGridAudioFrame, source: PixGridLayerAnimation['audioSource']): number {
  if (source === 'kick') return clamp01(frame.sourceValues?.kick ?? ((frame.kickHit ?? frame.beatHit) ? 1 : 0))
  if (source === 'snare') return frame.snareHit ? 1 : 0
  if (source === 'hat') return frame.hatHit ? 1 : 0
  if (source === 'mid') return clamp01(frame.mid)
  if (source === 'high') return clamp01(frame.high)
  if (source === 'volume') return clamp01(frame.volume)
  return clamp01(frame.bass)
}

function animationClockValue(frame: PixGridAudioFrame, animation: PixGridLayerAnimation): number {
  switch (animation.clock ?? 'time') {
    case 'beat': return frame.motionClockBeat ?? ((frame.beatIndex ?? 0) + clamp01(frame.beatPhase))
    case 'bar': return frame.motionClockBar ?? ((frame.barIndex ?? 0) + ((frame.beatIndex ?? 0) % 4 + clamp01(frame.beatPhase)) / 4)
    case 'cue': return 0
    case 'time':
    default: return frame.motionClockTime ?? frame.audioTime
  }
}

function animationTime(frame: PixGridAudioFrame, animation: PixGridLayerAnimation, sceneMotionMultiplier: number): number {
  const hasIntegratedClock = frame.motionClockTime != null || frame.motionClockBeat != null || frame.motionClockBar != null
  const effectiveMotion = hasIntegratedClock
    ? Math.max(0, Number.isFinite(sceneMotionMultiplier) ? sceneMotionMultiplier : 1)
    : resolvePixGridMotionMultiplier(frame.motionMultiplier, sceneMotionMultiplier)
  return animationClockValue(frame, animation) * animation.speed * effectiveMotion + animation.phase
}

export function resolvePixGridLayerAnimation(
  layer: PixGridLayer,
  asset: PixGridBuiltInAssetManifestEntry,
  frame: PixGridAudioFrame,
  motionMultiplier = 1,
): PixGridResolvedLayerAnimation {
  const resolved: PixGridResolvedLayerAnimation = {
    positionX: layer.position.x,
    positionY: layer.position.y,
    scaleX: layer.scale.x,
    scaleY: layer.scale.y,
    rotation: layer.rotation,
    opacity: 1,
    paletteOffset: 0,
    revealRow: 1,
    revealColumn: 1,
    revealRowFrom: 'start',
    revealColumnFrom: 'start',
    checkerAlternate: false,
    frameIndex: 0,
  }

  for (const animation of layer.animations) {
    const time = animationTime(frame, animation, motionMultiplier)
    const amount = animation.amount
    switch (animation.mode) {
      case 'static':
        break
      case 'pulse': {
        const pulse = 0.5 + 0.5 * Math.sin(time * Math.PI * 2)
        const multiplier = 1 + pulse * amount
        resolved.scaleX *= multiplier
        resolved.scaleY *= multiplier
        break
      }
      case 'bounce': {
        const offset = (triangle(time) * 2 - 1) * amount
        if (animation.axis === 'x') resolved.positionX = resolvePixGridBoundedValue(layer.position.x, offset, animation.boundary)
        else resolved.positionY = resolvePixGridBoundedValue(layer.position.y, offset, animation.boundary)
        break
      }
      case 'horizontalScroll':
        resolved.positionX = resolvePixGridBoundedValue(layer.position.x, time * amount, animation.boundary)
        break
      case 'verticalScroll':
        resolved.positionY = resolvePixGridBoundedValue(layer.position.y, time * amount, animation.boundary)
        break
      case 'pingPong': {
        const offset = (triangle(time) * 2 - 1) * amount
        if (animation.axis === 'y') resolved.positionY = resolvePixGridBoundedValue(layer.position.y, offset, 'clamp')
        else resolved.positionX = resolvePixGridBoundedValue(layer.position.x, offset, 'clamp')
        break
      }
      case 'rotate': {
        const turns = animation.stepped ? Math.floor(time) : time
        resolved.rotation += turns * amount * 360
        break
      }
      case 'paletteCycle':
        resolved.paletteOffset += Math.floor(time * Math.max(1, Math.abs(amount)))
        break
      case 'blink': {
        const on = fract(time) < clamp01(amount || 0.5)
        resolved.opacity *= on ? 1 : 0
        break
      }
      case 'revealRow':
        resolved.revealRowFrom = animation.revealFrom ?? 'start'
        resolved.revealRow = animation.clock === 'cue'
          ? clamp01(time)
          : animation.boundary === 'bounce' ? triangle(time) : clamp01(fract(time) / Math.max(0.01, amount || 1))
        break
      case 'revealColumn':
        resolved.revealColumnFrom = animation.revealFrom ?? 'start'
        resolved.revealColumn = animation.clock === 'cue'
          ? clamp01(time)
          : animation.boundary === 'bounce' ? triangle(time) : clamp01(fract(time) / Math.max(0.01, amount || 1))
        break
      case 'checkerAlternate':
        resolved.checkerAlternate = Math.floor(time) % 2 !== 0
        break
      case 'frameCycle': {
        if (asset.id === PIX_GRID_NEON_MARQUEE_ASSET_ID && layer.id === PIX_GRID_NEON_MARQUEE_LAYER_ID) {
          const performance = resolvePixGridNeonMarqueePerformance(frame, motionMultiplier)
          resolved.frameIndex = performance.frameIndex
          resolved.positionX = Math.max(0, Math.min(1, layer.position.x + performance.positionOffsetX))
          resolved.positionY = Math.max(0, Math.min(1, layer.position.y + performance.positionOffsetY))
          resolved.scaleX *= performance.scaleMultiplier
          resolved.scaleY *= performance.scaleMultiplier
          break
        }
        const count = Math.max(1, asset.frameCount ?? 1)
        const rawFrame = Math.floor(time * Math.max(1, amount || 1))
        resolved.frameIndex = ((rawFrame % count) + count) % count
        break
      }
      case 'audioAmplitudeScale': {
        const multiplier = 1 + audioValue(frame, animation.audioSource) * amount
        resolved.scaleX *= multiplier
        resolved.scaleY *= multiplier
        break
      }
      case 'beatStepMovement': {
        const step = Math.floor(time)
        const offset = step * amount
        if (animation.axis === 'y') resolved.positionY = resolvePixGridBoundedValue(layer.position.y, offset, animation.boundary)
        else resolved.positionX = resolvePixGridBoundedValue(layer.position.x, offset, animation.boundary)
        break
      }
    }
  }

  return resolved
}
