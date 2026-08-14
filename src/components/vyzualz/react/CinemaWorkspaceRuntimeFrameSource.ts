import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { MusicIntelligenceAnalyserFramePump } from '../../../features/musicIntelligence/MusicIntelligenceAnalyserFramePump'
import type { LyricPlaybackState } from '../../../features/lyrics/runtime/lyricPlaybackResolver'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import type { CinemaFrameBuilderState, CinemaFrameContext } from '../cinema'
import type { CinemaRuntimeFrameSourceSample } from '../cinema/runtime/CinemaRuntimeFrameClock'
import {
  buildCinemaWorkspaceFrameBridge,
  type CinemaWorkspaceFrameBridgeInput,
  type CinemaWorkspaceFrameBridgeResult,
} from './CinemaWorkspaceFrameBridge'

export interface CinemaWorkspaceRuntimeFrameConfig extends Omit<
  CinemaWorkspaceFrameBridgeInput,
  | 'width'
  | 'height'
  | 'dpr'
  | 'audioTimeSec'
  | 'elapsedTimeSec'
  | 'deltaTimeSec'
  | 'timingDiscontinuity'
  | 'visibilitySuspended'
  | 'musicIntelligence'
  | 'lyrics'
  | 'previousState'
> {
  readonly analyser: AnalyserNode | null
  readonly getAudioTime: () => number
  readonly getMusicIntelligence?: () => Readonly<MusicIntelligenceFrame>
  readonly getLyrics?: () => Readonly<LyricPlaybackState> | null
}
/** Stateful adapter owned by the one live Cinema runtime, never by React cadence. */
export class CinemaWorkspaceRuntimeFrameSource {
  private state: Readonly<CinemaFrameBuilderState> | null = null
  private lastResult: CinemaWorkspaceFrameBridgeResult | null = null
  private readonly analyserPump = new MusicIntelligenceAnalyserFramePump({ publisherId: 'react:cinema' })
  private disposed = false

  constructor(
    private readonly getConfig: () => Readonly<CinemaWorkspaceRuntimeFrameConfig> | null,
  ) {}

  sample(sample: Readonly<CinemaRuntimeFrameSourceSample>): Readonly<CinemaFrameContext> | null {
    const config = this.getConfig()
    if (this.disposed || !config) return null
    const audioTimeSec = finiteNonNegative(config.getAudioTime(), this.state?.audioTimeSec ?? 0)
    const analysisActive = config.analysisActive ?? config.playing
    const musicIntelligence = config.analyser
      ? this.analyserPump.sample({
          analyser: config.analyser,
          audioTime: audioTimeSec,
          isPlaying: analysisActive && !config.paused,
          trackIdentity: config.trackId,
        })
      : (config.getMusicIntelligence?.() ?? AudioFeatureBus.getFrame())
    const elapsedTimeSec = this.state
      ? this.state.elapsedTimeSec + (analysisActive && !config.paused ? sample.deltaTimeSec : 0)
      : audioTimeSec

    const result = buildCinemaWorkspaceFrameBridge({
      ...config,
      width: sample.viewport.width,
      height: sample.viewport.height,
      dpr: sample.viewport.dpr,
      audioTimeSec,
      elapsedTimeSec,
      deltaTimeSec: sample.deltaTimeSec,
      timingDiscontinuity: sample.timingDiscontinuity,
      visibilitySuspended: false,
      musicIntelligence,
      lyrics: config.getLyrics?.() ?? null,
      previousState: this.state,
    })
    this.state = result.state
    this.lastResult = result
    return result.frame
  }

  get result(): CinemaWorkspaceFrameBridgeResult | null {
    return this.lastResult
  }

  dispose(): void {
    this.disposed = true
    this.state = null
    this.lastResult = null
    this.analyserPump.dispose()
  }
}

function finiteNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback
}
