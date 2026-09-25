import type { Cinema2ModuleFrameReadContext } from './Cinema2ModuleContracts'

/**
 * Shared "BPM Sync" time base for shader-driven presets (Electric Storm,
 * Reactor) whose continuous motion is authored as many independent
 * `u_time`-scaled terms rather than Afterhours' single discrete phase value.
 * Off (or with no BPM available), it tracks elapsed time 1:1 — identical to
 * today's un-synced behavior. On, it scales its accumulation rate by
 * `bpm / REFERENCE_BPM` so every term already tuned against raw elapsed
 * seconds keeps its authored relative speed at the reference tempo and
 * speeds up/slows down proportionally with the track. Consumers substitute
 * this for `frame.elapsedTimeSec` wherever they currently feed `u_time`.
 */
export interface Cinema2SyncedMotionClockFrame {
  readonly syncEnabled: boolean
  readonly bpm: number | null
  readonly syncedTimeSec: number
}

// Matches Cinema2InterlockClock's FALLBACK_BPM so a synced preset at the
// reference tempo advances at the same visual rate as an un-synced one.
const REFERENCE_BPM = 120
const MIN_VALID_BPM = 20
const MAX_VALID_BPM = 400

export class Cinema2SyncedMotionClockResolver {
  private syncedTimeSec = 0
  private lastTrackId: string | null | undefined = undefined
  private lastContextGeneration: number | null = null
  private lastTransportTimeSec: number | null = null

  /**
   * `requireHostSync` (default true) composes the preset toggle with the host's global Audio Dock Sync (both must be on). A preset whose BPM Sync
   * is the single authority for its beat-locked behaviour (Threshold) passes false, so the toggle is never silently overridden by the dock.
   */
  resolve(frame: Readonly<Cinema2ModuleFrameReadContext>, presetSyncEnabled: boolean, options: Readonly<{ requireHostSync?: boolean }> = {}): Readonly<Cinema2SyncedMotionClockFrame> {
    const globallySynced = options.requireHostSync === false || frame.transport?.bpmSync === true
    const bpm = resolveEffectiveBpm(frame)
    const syncEnabled = presetSyncEnabled && globallySynced && bpm != null

    const transportTimeSec = frame.transport?.timeSec ?? frame.elapsedTimeSec
    const sourceReplaced = this.lastTrackId !== undefined && frame.transport?.trackId !== this.lastTrackId
    const contextChanged = this.lastContextGeneration != null && frame.contextGeneration !== this.lastContextGeneration
    const backwards = this.lastTransportTimeSec != null && transportTimeSec < this.lastTransportTimeSec - 1e-6
    if (sourceReplaced || contextChanged || backwards) this.syncedTimeSec = 0

    const active = frame.transport ? frame.transport.animationActive && !frame.transport.paused : true
    if (active) {
      const deltaTimeSec = Number.isFinite(frame.deltaTimeSec) ? Math.max(0, frame.deltaTimeSec) : 0
      const rate = syncEnabled && bpm != null ? bpm / REFERENCE_BPM : 1
      this.syncedTimeSec += deltaTimeSec * rate
    }

    this.lastTrackId = frame.transport?.trackId
    this.lastContextGeneration = frame.contextGeneration
    this.lastTransportTimeSec = transportTimeSec
    return Object.freeze({ syncEnabled, bpm, syncedTimeSec: this.syncedTimeSec })
  }

  reset(): void {
    this.syncedTimeSec = 0
    this.lastTrackId = undefined
    this.lastContextGeneration = null
    this.lastTransportTimeSec = null
  }
}

function resolveEffectiveBpm(frame: Readonly<Cinema2ModuleFrameReadContext>): number | null {
  const analyzed = frame.audio?.rhythm.bpm
  if (analyzed?.available && typeof analyzed.value === 'number' && validBpm(analyzed.value)) return analyzed.value
  const transportBpm = frame.transport?.bpm
  if (typeof transportBpm === 'number' && validBpm(transportBpm)) return transportBpm
  return null
}

function validBpm(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_VALID_BPM && value <= MAX_VALID_BPM
}
