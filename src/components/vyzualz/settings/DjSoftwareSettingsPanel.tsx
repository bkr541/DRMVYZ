import { useEffect, useState } from 'react'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { IconChipButton } from '../react/controls/IconChipButton'
import { NoticeCard } from '../react/controls/NoticeCard'
import { StatusBadge } from '../react/controls/StatusBadge'
import { UnderlineDropdown } from '../react/controls/UnderlineDropdown'
import {
  getNativeRekordboxBridge,
  type RekordboxIndexStatus,
} from '../../../features/rekordboxImport/nativeBridge'
import { createLogger } from '../../../lib/logger'

type DjSoftware = 'rekordbox' | 'serato' | 'virtualdj' | 'traktor' | 'engine-dj'

const DJ_SOFTWARE_STORAGE_KEY = 'drmvyz.settings.djSoftware.v1'
const djSoftwareLog = createLogger('react', 'DjSoftwareSettings')
const DJ_SOFTWARE_OPTIONS = [
  { value: 'rekordbox', label: 'Rekordbox' },
  { value: 'serato', label: 'Serato DJ Pro', description: 'Coming soon' },
  { value: 'virtualdj', label: 'VirtualDJ', description: 'Coming soon' },
  { value: 'traktor', label: 'Traktor Pro', description: 'Coming soon' },
  { value: 'engine-dj', label: 'Engine DJ', description: 'Coming soon' },
] as const

function readSelectedSoftware(): DjSoftware {
  try {
    const stored = window.localStorage.getItem(DJ_SOFTWARE_STORAGE_KEY)
    if (stored === 'serato' || stored === 'virtualdj' || stored === 'traktor' || stored === 'engine-dj') return stored
  } catch {
    // Keep the production default when storage is unavailable.
  }
  return 'rekordbox'
}

function formatSyncDate(value?: string | null): string {
  if (!value) return 'Not synced yet'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export function DjSoftwareSettingsPanel() {
  const [software, setSoftware] = useState<DjSoftware>(readSelectedSoftware)
  const [status, setStatus] = useState<RekordboxIndexStatus | null>(null)
  const [busy, setBusy] = useState<'loading' | 'selecting' | 'syncing' | null>('loading')
  const [error, setError] = useState<string | null>(null)
  const bridge = getNativeRekordboxBridge()

  useEffect(() => {
    let active = true
    if (!bridge?.getIndexStatus) {
      setBusy(null)
      return
    }
    void bridge.getIndexStatus()
      .then(next => { if (active) setStatus(next) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)) })
      .finally(() => { if (active) setBusy(null) })
    return () => { active = false }
  }, [bridge])

  const handleSoftwareChange = (value: string) => {
    const next = value as DjSoftware
    setSoftware(next)
    setError(null)
    try { window.localStorage.setItem(DJ_SOFTWARE_STORAGE_KEY, next) } catch { /* optional preference */ }
  }

  const chooseDirectory = async () => {
    if (!bridge?.selectIndexDirectory) return
    setBusy('selecting')
    setError(null)
    try {
      const next = await bridge.selectIndexDirectory()
      if (!next.cancelled) {
        setStatus(next)
        djSoftwareLog.info('Rekordbox index directory selected', { rootName: next.selectedRootName })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }

  const syncDirectory = async () => {
    if (!bridge?.syncIndex || !status?.selectedRootPath) return
    setBusy('syncing')
    setError(null)
    try {
      const next = await bridge.syncIndex()
      setStatus(next)
      djSoftwareLog.info('Rekordbox index sync completed', {
        rootName: next.selectedRootName,
        trackCount: next.trackCount,
        detectedAnlzFiles: next.detectedAnlzFiles,
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      djSoftwareLog.error('Rekordbox index sync failed', { error: message })
    } finally {
      setBusy(null)
    }
  }

  const rekordboxSelected = software === 'rekordbox'
  const nativeIndexAvailable = Boolean(bridge?.getIndexStatus && bridge.selectIndexDirectory && bridge.syncIndex)

  return (
    <div className="vsm-dj-software">
      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>DJ Software</h2>
            <p>Select the DJ library provider DRMVYZ should use for track metadata.</p>
          </div>
        </div>
        <div className="vsm-acct-field vsm-dj-provider-control">
          <UnderlineDropdown
            id="vsm-dj-software-select"
            triggerId="vsm-dj-software-select-trigger"
            eyebrow="Software"
            ariaLabel="DJ Software"
            menuLabel="DJ Software"
            value={software}
            options={DJ_SOFTWARE_OPTIONS}
            onChange={handleSoftwareChange}
            size="compact"
          />
        </div>
        {!rekordboxSelected && (
          <NoticeCard title="Integration coming soon" tone="info" role="status">
            This integration is not available yet. Rekordbox is currently the only functional provider.
          </NoticeCard>
        )}
      </section>

      {rekordboxSelected && (
        <section className="vsm-settings-group" aria-busy={busy === 'syncing'}>
          <div className="vsm-settings-group-heading">
            <div>
              <h2>Rekordbox Library Index</h2>
              <p>Pre-scan a Rekordbox library or prepared USB so metadata is ready before a performance.</p>
            </div>
          </div>

          <div className="vsm-settings-inline-row vsm-dj-directory-row">
            <div className="vsm-acct-field vsm-dj-directory-control">
              <label className="vsm-acct-label" htmlFor="vsm-dj-directory">Directory</label>
              <DreamVizTextInput
                id="vsm-dj-directory"
                value={status?.selectedRootPath ?? ''}
                placeholder="No directory selected"
                title={status?.selectedRootPath ?? undefined}
                readOnly
                tabIndex={-1}
              />
            </div>
            <IconChipButton
              onClick={() => void chooseDirectory()}
              disabled={!nativeIndexAvailable || busy !== null}
            >{busy === 'selecting' ? 'Choosing…' : 'Choose Directory'}</IconChipButton>
            {status?.selectedRootPath && (
              <IconChipButton
                tone="primary"
                onClick={() => void syncDirectory()}
                disabled={!nativeIndexAvailable || busy !== null}
              >{busy === 'syncing' ? 'Syncing…' : 'Sync'}</IconChipButton>
            )}
          </div>

          {!nativeIndexAvailable && busy !== 'loading' && (
            <NoticeCard title="Desktop app required" tone="warning" role="status">
              Library indexing requires the DRMVYZ desktop app.
            </NoticeCard>
          )}
          {error && (
            <NoticeCard title="Rekordbox sync failed" tone="error" role="alert">{error}</NoticeCard>
          )}
          {status?.selectedRootPath && (
            <div className="vsm-settings-inline-row vsm-dj-index-summary" aria-live="polite">
              <StatusBadge tone={busy === 'syncing' ? 'playing' : status.hasIndex ? 'loaded' : 'dirty'}>
                {busy === 'syncing' ? 'Syncing' : status.hasIndex ? 'Indexed' : 'Ready to sync'}
              </StatusBadge>
              <span>
                Last sync: {formatSyncDate(status.syncedAt)}
                {' · '}{(status.trackCount ?? 0).toLocaleString()} tracks
                {' · '}{(status.detectedAnlzFiles ?? 0).toLocaleString()} ANLZ files
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
