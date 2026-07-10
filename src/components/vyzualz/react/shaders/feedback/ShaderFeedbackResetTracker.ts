import {
  DEFAULT_FEEDBACK_RESET_CONFIG,
  type FeedbackFrameSignals,
  type FeedbackResetConfig,
} from './shaderFeedbackTypes'

/**
 * Pure cross-frame reset detector shared by graph-owned and controller-owned
 * feedback. It deliberately detects drop impact on the rising threshold edge so
 * a sustained drop envelope cannot clear history on every frame.
 */
export class ShaderFeedbackResetTracker {
  private _lastSceneId: string | null = null
  private _lastTrackId: string | null = null
  private _lastPlaybackTime = -1
  private _lastSectionType: string | null = null
  private _lastW = 0
  private _lastH = 0
  private _dropImpactAboveThreshold = false

  update(signals: FeedbackFrameSignals, config: FeedbackResetConfig = {}): boolean {
    const cfg: Required<FeedbackResetConfig> = {
      ...DEFAULT_FEEDBACK_RESET_CONFIG,
      ...config,
    }

    const sceneChanged = signals.sceneId !== this._lastSceneId
    const trackChanged = signals.trackId !== null
      && signals.trackId !== this._lastTrackId
    const playbackRestarted = this._lastPlaybackTime > 0
      && signals.playbackTime < this._lastPlaybackTime - 0.5
    const sectionChanged = signals.sectionType !== this._lastSectionType
    const resolutionChanged = signals.w !== this._lastW || signals.h !== this._lastH
    const dropImpactAboveThreshold = signals.dropImpact > cfg.dropImpactThreshold
    const dropImpactEdge = dropImpactAboveThreshold && !this._dropImpactAboveThreshold

    const shouldReset = (cfg.onSceneChange && sceneChanged)
      || (cfg.onTrackChange && trackChanged)
      || (cfg.onPlaybackRestart && playbackRestarted)
      || (cfg.onSectionChange && sectionChanged)
      || (cfg.onDropImpact && dropImpactEdge)
      || (cfg.onResolutionChange && resolutionChanged)
      || (cfg.onContextRestore && signals.contextJustRestored === true)

    this._lastSceneId = signals.sceneId
    this._lastTrackId = signals.trackId
    this._lastPlaybackTime = signals.playbackTime
    this._lastSectionType = signals.sectionType
    this._lastW = signals.w
    this._lastH = signals.h
    this._dropImpactAboveThreshold = dropImpactAboveThreshold

    return shouldReset
  }

  resetTracking(): void {
    this._lastSceneId = null
    this._lastTrackId = null
    this._lastPlaybackTime = -1
    this._lastSectionType = null
    this._lastW = 0
    this._lastH = 0
    this._dropImpactAboveThreshold = false
  }
}
