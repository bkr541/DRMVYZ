import { supabase } from '../../../../lib/supabase'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ThreeLoadedAsset } from '../modules/three/Cinema2ThreeAssetCache'
import type { Cinema2UserModelLease } from './Cinema2UserModelCache'
import { cinema2UserModelCache, Cinema2UserModelCache } from './Cinema2UserModelCache'
import { DEFAULT_MODEL_BINDING, parseUserModelBinding } from './Cinema2ModelBinding'
import { classifyCinema2UserModelError, type Cinema2UserModelStatus } from './Cinema2UserModelResolver'
export interface Cinema2UserModelSlotSnapshot { status: Cinema2UserModelStatus; message: string | null; binding: string }
export function subscribeCinema2ModelAccount(listener: () => void): () => void {
  let owner: string | null | undefined
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null
    if (owner !== undefined && next !== owner) listener()
    owner = next
  })
  return () => data.subscription.unsubscribe()
}
/** One scene slot. Attachment is synchronous; release follows bridge removal, never precedes it. */
export class Cinema2UserModelSlot {
  private controller: AbortController | null = null
  private validation: AbortController | null = null
  private lease: Cinema2UserModelLease | null = null
  private generation = 0
  private disposed = false
  private readonly unsubscribe: () => void
  private snapshot: Cinema2UserModelSlotSnapshot = { status: 'ready', message: null, binding: DEFAULT_MODEL_BINDING }
  constructor(private readonly library: Cinema2ThreeLibrary,
    private readonly attach: (asset: Cinema2ThreeLoadedAsset | null) => void, private readonly cache: Cinema2UserModelCache = cinema2UserModelCache,
    subscribeAccount = subscribeCinema2ModelAccount) {
    this.unsubscribe = subscribeAccount(() => { const value = this.snapshot.binding; this.select(value, true) })
  }
  getSnapshot(): Cinema2UserModelSlotSnapshot { return this.snapshot }
  select(value: unknown, force = false): void {
    if (this.disposed || (!force && value === this.snapshot.binding)) return
    this.validation?.abort(); this.controller?.abort(); const token = ++this.generation
    const binding = typeof value === 'string' ? value : ''
    this.clear()
    try {
      const parsed = parseUserModelBinding(value)
      if (parsed.kind === 'default-model') { this.snapshot = { binding, status: 'ready', message: null }; return }
      this.controller = new AbortController(); const signal = this.controller.signal
      this.snapshot = { binding, status: 'loading', message: null }
      void this.cache.acquire(this.library, parsed, signal).then(lease => {
        if (this.disposed || token !== this.generation) { lease.release(); return }
        try { this.attach(lease.asset) } catch (error) { lease.release(); throw error }
        const previous = this.lease; this.lease = lease; previous?.release()
        this.snapshot = { binding, status: 'ready', message: null }
      }).catch(error => {
        if (this.disposed || token !== this.generation) return
        this.clear()
        const problem = classifyCinema2UserModelError(error); this.snapshot = { binding, status: problem.status, message: problem.message }
      })
    } catch (error) { this.clear(); const problem = classifyCinema2UserModelError(error); this.snapshot = { binding, status: problem.status, message: problem.message } }
  }
  /** Reauthorize the exact pinned version after a local library mutation, without
   * reloading a still-valid mesh or advancing to the latest version. */
  revalidate(): void {
    if (this.disposed || this.snapshot.binding === DEFAULT_MODEL_BINDING) return
    let parsed: ReturnType<typeof parseUserModelBinding>
    try { parsed = parseUserModelBinding(this.snapshot.binding) } catch { return }
    if (parsed.kind !== 'user-model') return
    this.validation?.abort()
    const validation = this.validation = new AbortController(), token = this.generation
    const current = () => !this.disposed && !validation.signal.aborted && token === this.generation
    void this.cache.resolver.authorize(parsed, validation.signal).then(() => {
      if (!current()) return
      if (this.snapshot.status === 'missing' || this.snapshot.status === 'unauthorized') this.select(this.snapshot.binding, true)
    }).catch(error => {
      if (!current()) return
      const problem = classifyCinema2UserModelError(error)
      // A transient metadata/network failure is not evidence that an already
      // authorized model was deleted. Confirmed missing/denied content is removed.
      if (problem.status !== 'missing' && problem.status !== 'unauthorized') return
      this.generation++; this.controller?.abort(); this.clear()
      this.snapshot = { binding: this.snapshot.binding, status: problem.status, message: problem.message }
    })
  }
  private clear(): void { this.attach(null); const previous = this.lease; this.lease = null; previous?.release() }
  stop(): void { if (this.disposed) return; this.disposed = true; this.generation++; this.validation?.abort(); this.controller?.abort(); this.unsubscribe() }
  dispose(): void { this.stop(); this.lease?.release(); this.lease = null }
}
