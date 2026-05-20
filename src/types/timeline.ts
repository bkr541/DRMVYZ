export type VzTransitionType =
  | 'cut'
  | 'crossfade'
  | 'flash'
  | 'glitch'
  | 'wipeLeft'
  | 'wipeRight'
  | 'wipeUp'
  | 'wipeDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'blurCrossfade'
  | 'lumaFade'
  | 'additiveBlend'
  | 'rgbTear'
  | 'datamoshCut'
  | 'scanlineWipe'
  | 'pixelSort'
  | 'radialWipe'
  | 'circleIris'
  | 'bassImpactZoom'
  | 'shockwaveReveal'
  | 'particleExplosion'

export type VzTransitionEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'

export interface VzTransitionConfig {
  type: VzTransitionType
  /** Overlap duration in seconds — both clips play simultaneously for this long. */
  durationSec: number
  easing?: VzTransitionEasing
  /** Canvas globalCompositeOperation for the incoming clip layer. */
  blendMode?: string
  /** 0–1 effect-strength multiplier. Undefined = 1 (full strength). */
  intensity?: number
  /** For directional transitions (wipe, radial). */
  direction?: 'left' | 'right' | 'up' | 'down' | 'center'
}

export interface VzTimelineClip {
  id: string
  mediaId: string
  startSec: number
  durationSec: number
  mediaInSec: number
  mediaOutSec?: number
  fitMode: 'cover' | 'contain'
  playbackMode: 'trim' | 'loop' | 'freeze'
  /** Transition that overlaps this clip's tail with the next clip's head. */
  transitionOut?: VzTransitionConfig
  /** @deprecated — kept for backwards-compat JSON deserialization. Use transitionOut. */
  transition?: { type: VzTransitionType; durationSec: number }
}

export interface VzTimeline {
  enabled: boolean
  loop: boolean
  clips: VzTimelineClip[]
}
