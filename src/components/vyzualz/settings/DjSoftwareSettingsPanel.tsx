import { useEffect, useState } from 'react'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'
import {
  getNativeRekordboxBridge,
  type RekordboxIndexStatus,
} from '../../../features/rekordboxImport/nativeBridge'
import { createLogger } from '../../../lib/logger'

type DjSoftware = 'rekordbox' | 'serato' | 'virtualdj' | 'traktor' | 'engine-dj'

const DJ_SOFTWARE_STORAGE_KEY = 'drmvyz.settings.djSoftware.v1'
const djSoftwareLog = createLogger('react', 'DjSoftwareSettings')

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
        <label className="vsm-dj-field-label" htmlFor="vsm-dj-software-select">Software</label>
        <DropdownSelect
          id="vsm-dj-software-select"
          value={software}
          onChange={event => handleSoftwareChange(event.target.value)}
          dropdownSize="default"
          className="vsm-dj-select"
          aria-label="DJ Software"
        >
          <option value="rekordbox">Rekordbox</option>
          <option value="serato">Serato DJ Pro — Coming soon</option>
          <option value="virtualdj">VirtualDJ — Coming soon</option>
          <option value="traktor">Traktor Pro — Coming soon</option>
          <option value="engine-dj">Engine DJ — Coming soon</option>
        </DropdownSelect>
        {!rekordboxSelected && (
          <div className="vsm-dj-coming-soon" role="status">
            This integration is not available yet. Rekordbox is currently the only functional provider.
          </div>
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

          <div className="vsm-dj-directory-row">
            <div className={`vsm-dj-directory${status?.selectedRootPath ? '' : ' is-empty'}`}>
              <span className="vsm-dj-directory-label">Directory</span>
              <span className="vsm-dj-directory-value" title={status?.selectedRootPath ?? undefined}>
                {status?.selectedRootPath ?? 'No directory selected'}
              </span>
            </div>
            <button
              type="button"
              className="vz-settings-reset-btn vsm-dj-button"
              onClick={() => void chooseDirectory()}
              disabled={!nativeIndexAvailable || busy !== null}
            >{busy === 'selecting' ? 'Choosing…' : 'Choose Directory'}</button>
            {status?.selectedRootPath && (
              <button
                type="button"
                className="vz-settings-reset-btn vsm-dj-button vsm-dj-button--primary"
                onClick={() => void syncDirectory()}
                disabled={!nativeIndexAvailable || busy !== null}
              >{busy === 'syncing' ? 'Syncing…' : 'Sync'}</button>
            )}
          </div>

          {!nativeIndexAvailable && busy !== 'loading' && (
            <div className="vsm-settings-detail vsm-settings-detail--error" role="status">
              <span>Library indexing requires the DRMVYZ desktop app.</span>
            </div>
          )}
          {error && (
            <div className="vsm-settings-detail vsm-settings-detail--error" role="alert"><span>{error}</span></div>
          )}
          {status?.selectedRootPath && (
            <div className="vsm-dj-index-status" aria-live="polite">
              <div><span>Status</span><strong>{busy === 'syncing' ? 'Scanning and indexing…' : status.hasIndex ? 'Indexed' : 'Ready to sync'}</strong></div>
              <div><span>Last sync</span><strong>{formatSyncDate(status.syncedAt)}</strong></div>
              <div><span>Tracks</span><strong>{(status.trackCount ?? 0).toLocaleString()}</strong></div>
              <div><span>ANLZ files</span><strong>{(status.detectedAnlzFiles ?? 0).toLocaleString()}</strong></div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
