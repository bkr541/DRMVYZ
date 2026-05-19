export interface VzTimelineClip {
  id: string
  mediaId: string
  startSec: number
  durationSec: number
  mediaInSec: number
  mediaOutSec?: number
  fitMode: 'cover' | 'contain'
  playbackMode: 'trim' | 'loop' | 'freeze'
  transition?: {
    type: 'cut' | 'crossfade' | 'glitch' | 'flash'
    durationSec: number
  }
}

export interface VzTimeline {
  enabled: boolean
  loop: boolean
  clips: VzTimelineClip[]
}
