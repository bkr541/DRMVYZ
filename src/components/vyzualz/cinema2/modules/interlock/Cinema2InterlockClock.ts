import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'

export type Cinema2InterlockClockSource = 'free-running' | 'analyzed-beat-grid' | 'transport-bpm' | 'visual-fallback-120'

export interface Cinema2InterlockClockFrame {
  readonly syncEnabled: boolean
  readonly source: Cinema2InterlockClockSource
  readonly bpm: number
  readonly canonicalBeatPosition: number
  readonly motionBeatPosition: number
  readonly beatPhase: number
  readonly twoBeatPhase: number
  readonly fourBeatPhase: number
  readonly eightBeatPhase: number
  readonly sixteenBeatPhase: number
  readonly freeRunningSec: number
  readonly reanchorGeneration: number
  readonly reanchoring: boolean
}

interface RawClockTarget {
  readonly source: Exclude<Cinema2InterlockClockSource, 'free-running'>
  readonly bpm: number
  readonly beatPosition: number
  readonly identity: string
}

const FALLBACK_BPM = 120
const FREE_RUNNING_BEATS_PER_SECOND = 2
const MIN_VALID_BPM = 20
const MAX_VALID_BPM = 400
const JUMP_TOLERANCE_BEATS = 0.75
const EPSILON = 1e-6

/**
 * Stateful Interlock-only timing resolver. It owns no UI or audio analysis: it
 * converts the read-only Cinema 2.0 frame into one continuous motion clock that
 * both native Interlock modules can resolve identically.
 */
export class Cinema2InterlockClockResolver {
  private initialized = false
  private freeRunningSec = 0
  private motionBeatPosition = 0
  private syncOffsetBeats = 0
  private freeOffsetBeats = 0
  private lastCanonicalBeat = 0
  private lastTransportTimeSec: number | null = null
  private lastTrackId: string | null | undefined = undefined
  private lastContextGeneration: number | null = null
  private lastSyncEnabled = false
  private lastIdentity = ''
  private reanchorGeneration = 0

  resolve(frame: Readonly<Cinema2ModuleFrameReadContext>, presetSyncEnabled = true): Readonly<Cinema2InterlockClockFrame> {
    // The authored BPM Sync toggle only ever narrows the global Audio Dock
    // Sync preference: off forces free-running even while the transport-wide
    // toggle is on, but it can never turn sync on by itself.
    const syncEnabled = presetSyncEnabled && frame.transport?.bpmSync === true
    const active = animationActive(frame)
    const deltaTimeSec = active ? finiteNonNegative(frame.deltaTimeSec) : 0
    const transportTimeSec = finiteNonNegative(frame.transport?.timeSec ?? frame.elapsedTimeSec)
    const raw = resolveRawTarget(frame)

    if (!this.initialized) {
      this.initialized = true
      this.freeRunningSec = finiteNonNegative(frame.elapsedTimeSec)
      this.motionBeatPosition = syncEnabled
        ? raw.beatPosition
        : this.freeRunningSec * FREE_RUNNING_BEATS_PER_SECOND
      this.lastCanonicalBeat = raw.beatPosition
      this.lastTransportTimeSec = transportTimeSec
      this.lastTrackId = frame.transport?.trackId
      this.lastContextGeneration = frame.contextGeneration
      this.lastSyncEnabled = syncEnabled
      this.lastIdentity = raw.identity
      return this.snapshot(syncEnabled, raw, false)
    }

    if (active) this.freeRunningSec += deltaTimeSec

    const sourceReplaced = this.lastTrackId !== undefined && frame.transport?.trackId !== this.lastTrackId
    const contextChanged = this.lastContextGeneration != null && frame.contextGeneration !== this.lastContextGeneration
    const backwards = this.lastTransportTimeSec != null && transportTimeSec < this.lastTransportTimeSec - EPSILON
    const audioDiscontinuity = Boolean(frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation')
    const identityChanged = raw.identity !== this.lastIdentity
    const syncToggled = syncEnabled !== this.lastSyncEnabled
    const expectedAdvance = deltaTimeSec * raw.bpm / 60
    const canonicalAdvance = raw.beatPosition - this.lastCanonicalBeat
    const suspiciousJump = syncEnabled
      && active
      && (canonicalAdvance < -EPSILON || Math.abs(canonicalAdvance - expectedAdvance) > Math.max(JUMP_TOLERANCE_BEATS, expectedAdvance * 4))
    const reanchor = sourceReplaced || contextChanged || backwards || audioDiscontinuity || identityChanged || syncToggled || suspiciousJump

    if (syncEnabled) {
      if (!active) {
        // Transport/audio clocks may continue publishing while paused. Keep the
        // visible pose frozen and move only the continuity offset underneath it.
        this.syncOffsetBeats = this.motionBeatPosition - raw.beatPosition
        if (reanchor) this.reanchorGeneration += 1
      } else {
        if (reanchor) {
          this.syncOffsetBeats = this.motionBeatPosition - raw.beatPosition
          this.reanchorGeneration += 1
        } else if (Math.abs(this.syncOffsetBeats) > EPSILON) {
          const correctionPerSecond = Math.max(1, raw.bpm / 60)
          const correction = Math.min(Math.abs(this.syncOffsetBeats), deltaTimeSec * correctionPerSecond)
          this.syncOffsetBeats -= Math.sign(this.syncOffsetBeats) * correction
        }
        this.motionBeatPosition = raw.beatPosition + this.syncOffsetBeats
      }
    } else {
      const freeTarget = this.freeRunningSec * FREE_RUNNING_BEATS_PER_SECOND
      if (reanchor) {
        this.freeOffsetBeats = this.motionBeatPosition - freeTarget
        this.reanchorGeneration += 1
      }
      this.motionBeatPosition = freeTarget + this.freeOffsetBeats
    }

    this.lastCanonicalBeat = raw.beatPosition
    this.lastTransportTimeSec = transportTimeSec
    this.lastTrackId = frame.transport?.trackId
    this.lastContextGeneration = frame.contextGeneration
    this.lastSyncEnabled = syncEnabled
    this.lastIdentity = raw.identity
    return this.snapshot(syncEnabled, raw, reanchor || (syncEnabled && Math.abs(this.syncOffsetBeats) > EPSILON))
  }

  reset(): void {
    this.initialized = false
    this.freeRunningSec = 0
    this.motionBeatPosition = 0
    this.syncOffsetBeats = 0
    this.freeOffsetBeats = 0
    this.lastCanonicalBeat = 0
    this.lastTransportTimeSec = null
    this.lastTrackId = undefined
    this.lastContextGeneration = null
    this.lastSyncEnabled = false
    this.lastIdentity = ''
    this.reanchorGeneration = 0
  }

  private snapshot(syncEnabled: boolean, raw: Readonly<RawClockTarget>, reanchoring: boolean): Readonly<Cinema2InterlockClockFrame> {
    const motionBeatPosition = finiteNonNegative(this.motionBeatPosition)
    return Object.freeze({
      syncEnabled,
      source: syncEnabled ? raw.source : 'free-running',
      bpm: syncEnabled ? raw.bpm : FALLBACK_BPM,
      canonicalBeatPosition: syncEnabled ? raw.beatPosition : motionBeatPosition,
      motionBeatPosition,
      beatPhase: phase(motionBeatPosition, 1),
      twoBeatPhase: phase(motionBeatPosition, 2),
      fourBeatPhase: phase(motionBeatPosition, 4),
      eightBeatPhase: phase(motionBeatPosition, 8),
      sixteenBeatPhase: phase(motionBeatPosition, 16),
      freeRunningSec: this.freeRunningSec,
      reanchorGeneration: this.reanchorGeneration,
      reanchoring,
    })
  }
}

export function resolveCinema2InterlockSegmentClockPhase(
  clock: Readonly<Cinema2InterlockClockFrame>,
  speed: number,
): number {
  const normalizedSpeed = clamp01(speed)
  if (normalizedSpeed <= EPSILON) return 0
  const stepBeats = normalizedSpeed >= 0.5 ? 0.25 : 0.5
  return fract(clock.motionBeatPosition / stepBeats)
}

export function resolveCinema2InterlockBackgroundClockTime(
  clock: Readonly<Cinema2InterlockClockFrame>,
  flow: number,
): number {
  const normalizedFlow = clamp01(flow)
  const cycleBeats = normalizedFlow >= 0.5 ? 8 : 16
  return clock.motionBeatPosition * ((Math.PI * 2) / cycleBeats)
}

export function nextCinema2InterlockBeatBoundary(beatPosition: number): number {
  const safe = finiteNonNegative(beatPosition)
  return Math.floor(safe + EPSILON) + 1
}

function resolveRawTarget(frame: Readonly<Cinema2ModuleFrameReadContext>): Readonly<RawClockTarget> {
  const rhythm = frame.audio?.rhythm
  const analyzedBpm = numericSignalValue(rhythm?.bpm)
  const beatIndex = numericSignalValue(rhythm?.beatIndex)
  const beatPhase = numericSignalValue(rhythm?.beatPhase)
  if (validBpm(analyzedBpm) && beatIndex != null && beatPhase != null) {
    return Object.freeze({
      source: 'analyzed-beat-grid' as const,
      bpm: analyzedBpm,
      beatPosition: Math.max(0, beatIndex + clamp01(beatPhase)),
      identity: [
        'analysis',
        frame.transport?.trackId ?? frame.audio?.upstream.trackId ?? 'unbound',
        frame.audio?.upstream.analysisRevision ?? 'runtime',
        frame.audio?.upstream.timelineRevision ?? 'timeline',
        frame.audio?.discontinuity.generation ?? 0,
      ].join(':'),
    })
  }

  const transportBpm = frame.transport?.bpm
  if (validBpm(transportBpm)) {
    const timeSec = finiteNonNegative(frame.transport?.timeSec ?? frame.elapsedTimeSec)
    return Object.freeze({
      source: 'transport-bpm' as const,
      bpm: transportBpm,
      beatPosition: timeSec * transportBpm / 60,
      identity: `transport:${frame.transport?.trackId ?? 'unbound'}:${transportBpm.toFixed(6)}`,
    })
  }

  const timeSec = finiteNonNegative(frame.transport?.timeSec ?? frame.elapsedTimeSec)
  return Object.freeze({
    source: 'visual-fallback-120' as const,
    bpm: FALLBACK_BPM,
    beatPosition: timeSec * FALLBACK_BPM / 60,
    identity: `fallback:${frame.transport?.trackId ?? 'unbound'}`,
  })
}



function numericSignalValue(signal: { available: boolean; value: number | null } | null | undefined): number | null {
  return signal?.available === true && typeof signal.value === 'number' && Number.isFinite(signal.value)
    ? signal.value
    : null
}

function validBpm(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_VALID_BPM && value <= MAX_VALID_BPM
}

function animationActive(frame: Readonly<Cinema2ModuleFrameReadContext>): boolean {
  if (!frame.transport) return true
  return frame.transport.animationActive && !frame.transport.paused
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function phase(beatPosition: number, lengthBeats: number): number {
  return fract(beatPosition / lengthBeats)
}

function fract(value: number): number {
  return value - Math.floor(value)
}
