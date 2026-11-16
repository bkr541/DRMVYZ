import { useEffect } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useReactStore } from '../../stores/reactStore'
import type { ReactPerformancePad } from '../../components/vyzualz/react/ReactTypes'
import { PerformancePadSync, StalePadRevisionError, type PadSyncState, type RemotePadSet } from './PerformancePadSync'

interface PgError { code?: string; message: string }
interface UntypedClient {
  from(table: string): { select(columns: string): { maybeSingle(): PromiseLike<{ data: { pads: unknown; revision: number | string; schema_version: number } | null; error: PgError | null }> } }
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: PgError | null }>
}

const STATE_KEY = (userId: string) => `drmvyz.padSync.v1.${userId}`
const BACKUP_KEY = (userId: string) => `drmvyz.padSync.backup.v1.${userId}`
const DEVICE_KEY = 'drmvyz.deviceId.v1'
const REFRESH_MIN_INTERVAL_MS = 15_000
const POLL_MS = 60_000

function readJson<T>(key: string): T | null {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null } catch { return null }
}
function writeJson(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage can be full or blocked; syncing still works for this page load. */ }
}

/** A stable id for this browser, sent with saves so the cloud knows which device wrote last. */
export function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY)
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

/** Binds a PerformancePadSync to Supabase, the React store and localStorage for one signed-in account. */
export function createPerformancePadSync(userId: string): PerformancePadSync {
  const client = supabase as unknown as UntypedClient
  const deviceId = getDeviceId()
  return new PerformancePadSync({
    async fetchRemote(): Promise<RemotePadSet | null> {
      const { data, error } = await client.from('performance_pad_sets').select('pads, revision, schema_version').maybeSingle()
      if (error) throw new Error(error.message)
      return data ? { pads: data.pads, revision: Number(data.revision), schemaVersion: data.schema_version } : null
    },
    async save(pads, schemaVersion, baseRevision) {
      const { data, error } = await client.rpc('save_performance_pad_set', {
        p_pads: pads, p_schema_version: schemaVersion, p_base_revision: baseRevision, p_device_id: deviceId,
      })
      if (error) throw error.code === '40001' ? new StalePadRevisionError() : new Error(error.message)
      return Number(data)
    },
    getLocalPads: () => useReactStore.getState().performancePads,
    applyRemotePads: (pads: ReactPerformancePad[]) => useReactStore.setState({ performancePads: pads }),
    subscribeLocalPads: listener => useReactStore.subscribe((state, previous) => { if (state.performancePads !== previous.performancePads) listener() }),
    readState: () => readJson<PadSyncState>(STATE_KEY(userId)) ?? { revision: 0, syncedFingerprint: '' },
    writeState: state => writeJson(STATE_KEY(userId), state),
    backupLocalPads: pads => writeJson(BACKUP_KEY(userId), { savedAt: new Date().toISOString(), pads }),
    onError: error => { console.warn('[pad sync]', error instanceof Error ? error.message : error) },
  })
}

/** Syncs this account's performance pads for as long as the user is signed in. Used by both the desktop and the mobile app. */
export function usePerformancePadSync(userId: string | null): void {
  useEffect(() => {
    if (!userId || !supabaseConfigured) return
    const sync = createPerformancePadSync(userId)
    let lastRefresh = 0
    const refresh = () => {
      const now = Date.now()
      if (now - lastRefresh < REFRESH_MIN_INTERVAL_MS) return
      lastRefresh = now
      void sync.refresh()
    }
    lastRefresh = Date.now()
    void sync.start()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      window.clearInterval(poll)
      sync.dispose()
    }
  }, [userId])
}
