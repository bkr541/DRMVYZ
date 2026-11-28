import type { ReactPerformancePad } from '../../components/vyzualz/react/ReactTypes'
import { PAD_SET_SCHEMA_VERSION, isStockPadSetFingerprint, padSetFingerprint, sanitizePadSet } from './performancePadSets'

export interface RemotePadSet { pads: unknown; revision: number; schemaVersion: number }

export interface PadSyncState {
  /** The cloud revision this device last read or wrote. 0 when it has never synced. */
  revision: number
  /** Fingerprint of the pads as of that revision. A different current fingerprint means unsynced local edits. */
  syncedFingerprint: string
}

export class StalePadRevisionError extends Error {
  constructor() { super('Stale pad revision'); this.name = 'StalePadRevisionError' }
}

export interface PadSyncDeps {
  fetchRemote(): Promise<RemotePadSet | null>
  /** Saves and returns the new revision. Throws StalePadRevisionError when `baseRevision` is no longer the latest. */
  save(pads: ReactPerformancePad[], schemaVersion: number, baseRevision: number): Promise<number>
  getLocalPads(): ReactPerformancePad[]
  /** Replaces the local pads. The caller guarantees this does not trigger a push (state is updated first). */
  applyRemotePads(pads: ReactPerformancePad[]): void
  /** Calls back whenever the local pads change. Returns an unsubscribe. */
  subscribeLocalPads(listener: () => void): () => void
  readState(): PadSyncState
  writeState(state: PadSyncState): void
  /** Keeps unsynced local pads that a newer cloud set replaced, so nothing is lost silently. */
  backupLocalPads(pads: ReactPerformancePad[]): void
  onError?(error: unknown): void
  /**
   * Whether the pads in the local store are this account's. False while another account's work (or none) is loaded: the sync then neither
   * reads, pushes nor replaces local pads, so one account's pads can never reach another account's cloud set, or the reverse.
   */
  ownsLocalPads?(): boolean
  debounceMs?: number
  setTimer?(callback: () => void, ms: number): unknown
  clearTimer?(handle: unknown): void
}

/**
 * Keeps one account's performance pads the same on every device.
 *
 * Rules: the cloud set carries a revision. A device that has unsynced edits pushes them against the revision it last saw. When the cloud has
 * moved on, the cloud set wins and this device's unsynced pads are backed up first (two devices editing at once is rare; losing silently is
 * not acceptable). A device that has never synced and still has the stock pads never pushes them, so a fresh phone cannot overwrite a
 * desktop's custom pads.
 */
export class PerformancePadSync {
  private unsubscribe: (() => void) | null = null
  private timer: unknown = null
  private running = false
  private busy: Promise<void> = Promise.resolve()
  private disposed = false

  constructor(private readonly deps: PadSyncDeps) {}

  /** Reconciles with the cloud, then watches for local edits. */
  start(): Promise<void> {
    this.disposed = false
    this.unsubscribe = this.deps.subscribeLocalPads(() => this.schedulePush())
    return this.refresh()
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.timer !== null) (this.deps.clearTimer ?? clearTimeout)(this.timer as never)
    this.timer = null
  }

  /** Resolves when the work queued so far has finished (used by tests and on sign-out). */
  idle(): Promise<void> { return this.busy }

  /** Reads the cloud set and applies or pushes as the rules above say. Safe to call often. */
  refresh(): Promise<void> { return this.enqueue(() => this.reconcile()) }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.busy = this.busy.then(task, task).catch(error => this.deps.onError?.(error))
    return this.busy
  }

  private schedulePush(): void {
    if (this.disposed) return
    if (this.timer !== null) (this.deps.clearTimer ?? clearTimeout)(this.timer as never)
    this.timer = (this.deps.setTimer ?? ((cb, ms) => setTimeout(cb, ms)))(() => {
      this.timer = null
      void this.enqueue(() => this.push())
    }, this.deps.debounceMs ?? 1500)
  }

  private dirty(state = this.deps.readState()): boolean {
    return padSetFingerprint(this.deps.getLocalPads()) !== state.syncedFingerprint
  }

  private ownsLocal(): boolean {
    return !this.disposed && this.deps.ownsLocalPads?.() !== false
  }

  private async reconcile(): Promise<void> {
    if (!this.ownsLocal() || this.running) return
    this.running = true
    try {
      const remote = await this.deps.fetchRemote()
      if (!this.ownsLocal()) return
      const state = this.deps.readState()
      const remotePads = remote ? sanitizePadSet(remote.pads) : null
      if (!remote || !remotePads) {
        // Nothing usable in the cloud. Push real customisations, but never the stock pads.
        if (!isStockPadSetFingerprint(padSetFingerprint(this.deps.getLocalPads()))) await this.pushAgainst(remote?.revision ?? 0)
        return
      }
      const localFingerprint = padSetFingerprint(this.deps.getLocalPads())
      if (state.revision === remote.revision) {
        if (localFingerprint !== state.syncedFingerprint) await this.pushAgainst(remote.revision)
        return
      }
      // The cloud has moved. Keep this device's unsynced edits (if any) in a backup, then take the cloud set.
      const unsynced = localFingerprint !== state.syncedFingerprint
        && !isStockPadSetFingerprint(localFingerprint)
        && localFingerprint !== padSetFingerprint(remotePads)
      if (unsynced) this.deps.backupLocalPads(this.deps.getLocalPads())
      this.adopt(remotePads, remote.revision)
    } finally {
      this.running = false
    }
  }

  private adopt(pads: ReactPerformancePad[], revision: number): void {
    // State first, so the change this causes is seen as already synced.
    this.deps.writeState({ revision, syncedFingerprint: padSetFingerprint(pads) })
    this.deps.applyRemotePads(pads)
  }

  private async push(): Promise<void> {
    if (!this.ownsLocal()) return
    const state = this.deps.readState()
    if (!this.dirty(state)) return
    await this.pushAgainst(state.revision)
  }

  private async pushAgainst(baseRevision: number): Promise<void> {
    if (!this.ownsLocal()) return
    const pads = this.deps.getLocalPads()
    const fingerprint = padSetFingerprint(pads)
    try {
      const revision = await this.deps.save(pads, PAD_SET_SCHEMA_VERSION, baseRevision)
      this.deps.writeState({ revision, syncedFingerprint: fingerprint })
    } catch (error) {
      if (!(error instanceof StalePadRevisionError)) throw error
      // Another device saved first: read what it saved and let the rules decide.
      const remote = await this.deps.fetchRemote()
      const remotePads = remote ? sanitizePadSet(remote.pads) : null
      if (!remote || !remotePads) throw error
      if (padSetFingerprint(remotePads) === fingerprint) {
        this.deps.writeState({ revision: remote.revision, syncedFingerprint: fingerprint })
        return
      }
      this.deps.backupLocalPads(pads)
      this.adopt(remotePads, remote.revision)
    }
  }
}
