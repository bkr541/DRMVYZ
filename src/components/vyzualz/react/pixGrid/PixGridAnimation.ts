import type {
  PixGridAudioFrame,
  PixGridBuiltInAssetManifestEntry,
  PixGridLayer,
  PixGridLayerAnimation,
} from './PixGridTypes'

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
  if (source === 'kick') return (frame.kickHit ?? frame.beatHit) ? 1 : 0
  if (source === 'snare') return frame.snareHit ? 1 : 0
  if (source === 'hat') return frame.hatHit ? 1 : 0
  if (source === 'mid') return clamp01(frame.mid)
  if (source === 'high') return clamp01(frame.high)
  if (source === 'volume') return clamp01(frame.volume)
  return clamp01(frame.bass)
}

function animationTime(frame: PixGridAudioFrame, animation: PixGridLayerAnimation, motionMultiplier: number): number {
  return frame.audioTime * Math.max(0, animation.speed) * Math.max(0, motionMultiplier) + animation.phase
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
        resolved.revealRow = animation.boundary === 'bounce' ? triangle(time) : clamp01(fract(time) / Math.max(0.01, amount || 1))
        break
      case 'revealColumn':
        resolved.revealColumn = animation.boundary === 'bounce' ? triangle(time) : clamp01(fract(time) / Math.max(0.01, amount || 1))
        break
      case 'checkerAlternate':
        resolved.checkerAlternate = Math.floor(time) % 2 !== 0
        break
      case 'frameCycle': {
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
        const beatIndex = frame.beatIndex ?? Math.floor(frame.audioTime * 2)
        const step = Math.floor((beatIndex + animation.phase) * Math.max(0.01, animation.speed))
        const offset = step * amount
        if (animation.axis === 'y') resolved.positionY = resolvePixGridBoundedValue(layer.position.y, offset, animation.boundary)
        else resolved.positionX = resolvePixGridBoundedValue(layer.position.x, offset, animation.boundary)
        break
      }
    }
  }

  return resolved
}
