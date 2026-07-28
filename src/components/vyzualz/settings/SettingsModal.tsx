import { useState, useEffect, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVisualStore } from '../../../stores/visualStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { supabase, supabaseConfigured } from '../../../lib/supabase'
import { getProfile, updateProfile, uploadAvatar } from '../../../lib/profileDb'
import type { Profile } from '../../../types/database'
import { BrandKitSettingsPanel } from '../../../features/personalization/components/BrandKitSettingsPanel'
import { AppearanceSettingsPanel } from '../../../features/appearance/AppearanceSettingsPanel'

// ── AccountPanel ──────────────────────────────────────────────────────────────

function AccountPanel() {
  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [userId,       setUserId]       = useState<string | null>(null)
  const [email,        setEmail]        = useState('')
  const [displayName,  setDisplayName]  = useState('')
  const [artistName,   setArtistName]   = useState('')
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ text: string; ok: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showMsg = useCallback((text: string, ok: boolean) => {
    if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current)
    setSaveMsg({ text, ok })
    saveMsgTimer.current = setTimeout(() => setSaveMsg(null), 3000)
  }, [])

  useEffect(() => {
    return () => { if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current) }
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      if (!supabaseConfigured) { setLoading(false); return }
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (!user || !alive) { setLoading(false); return }
      setUserId(user.id)
      setEmail(user.email ?? '')
      const { profile: p } = await getProfile(user.id)
      if (!alive) return
      if (p) {
        setProfile(p)
        setDisplayName(p.display_name ?? '')
        setArtistName(p.artist_name ?? '')
        setAvatarUrl(p.avatar_url ?? null)
      }
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    const { error } = await updateProfile(userId, {
      display_name: displayName.trim() || null,
      artist_name:  artistName.trim()  || null,
    })
    setSaving(false)
    if (error) {
      showMsg('Failed to save changes', false)
    } else {
      showMsg('Profile saved', true)
    }
  }

  async function handleAvatarFile(file: File) {
    if (!userId) return
    setUploading(true)
    const { avatarUrl: newUrl, error } = await uploadAvatar(userId, file)
    setUploading(false)
    if (error || !newUrl) {
      showMsg('Avatar upload failed', false)
    } else {
      setAvatarUrl(newUrl)
      showMsg('Avatar updated', true)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    handleAvatarFile(file)
  }

  if (!supabaseConfigured) {
    return (
      <div className="vsm-acct-offline">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 7v5M12 16v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Cloud sync is not configured. Profile settings require Supabase.
      </div>
    )
  }

  if (loading) {
    return <div className="vsm-acct-loading">Loading profile…</div>
  }

  const initials = (displayName || email || '?').slice(0, 2).toUpperCase()

  return (
    <div className="vsm-acct">
      {/* ── Avatar row ─────────────────────────────────── */}
      <div className="vsm-acct-avatar-row">
        <div className="vsm-acct-avatar-wrap">
          {avatarUrl
            ? <img src={avatarUrl} alt="Profile avatar" className="vsm-acct-avatar-img" />
            : <div className="vsm-acct-avatar-initials">{initials}</div>
          }
          {uploading && <div className="vsm-acct-avatar-uploading" aria-label="Uploading" />}
          <button
            className="vsm-acct-avatar-upload-btn"
            title="Upload new profile photo"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload profile photo"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
        <div className="vsm-acct-avatar-hint">
          Click the upload icon to change your profile photo.<br />
          JPG, PNG, WebP, GIF — max 5 MB.
        </div>
      </div>

      {/* ── Fields ─────────────────────────────────────── */}
      <div className="vsm-acct-fields">
        <div className="vsm-acct-field">
          <label className="vsm-acct-label">Email</label>
          <input
            className="vsm-acct-input vsm-acct-input--readonly"
            type="email"
            value={email}
            readOnly
            tabIndex={-1}
          />
        </div>

        <div className="vsm-acct-field">
          <label className="vsm-acct-label" htmlFor="vsm-display-name">Display Name</label>
          <input
            id="vsm-display-name"
            className="vsm-acct-input"
            type="text"
            placeholder="Your name"
            value={displayName}
            maxLength={80}
            onChange={e => setDisplayName(e.target.value)}
          />
        </div>

        <div className="vsm-acct-field">
          <label className="vsm-acct-label" htmlFor="vsm-artist-name">Artist Name</label>
          <input
            id="vsm-artist-name"
            className="vsm-acct-input"
            type="text"
            placeholder="Stage name or alias"
            value={artistName}
            maxLength={80}
            onChange={e => setArtistName(e.target.value)}
          />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="vsm-acct-footer">
        {saveMsg && (
          <span className={`vsm-acct-save-msg${saveMsg.ok ? ' vsm-acct-save-msg--ok' : ' vsm-acct-save-msg--err'}`}>
            {saveMsg.text}
          </span>
        )}
        <button
          className="vsm-acct-save-btn"
          disabled={saving || !userId}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── Shortcuts ─────────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { key: '1–5', desc: 'Switch Preset' },
  { key: 'F',   desc: 'Fullscreen' },
  { key: 'G',   desc: 'Glitch Punch' },
  { key: 'B',   desc: 'Bass Pulse' },
  { key: 'SPC', desc: 'Beat Flash' },
  { key: 'V',   desc: 'Next Media' },
]

function ShortcutPanel() {
  return (
    <div className="vz-shortcuts-section vz-shortcuts-section--settings">
      <div className="vz-shortcut-grid">
        {SHORTCUTS.map(s => (
          <div key={s.key} className="vz-shortcut-card">
            <span className="vz-shortcut-key">{s.key}</span>
            <span className="vz-shortcut-desc">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const QUALITY_LEVELS = ['Low', 'Medium', 'High'] as const

function SystemSettingsPanel() {
  const {
    quality, setQuality, bpmSync, toggleBpmSync, bpm,
    resetEffects, resetModulationRoutes,
    autoQualityEnabled, autoQualityMin, autoQualityMax, autoQualityReason,
    setAutoQualityEnabled, setAutoQualityMin, setAutoQualityMax,
  } = useVisualStore()
  const { storageAvailable, authRequired } = useMediaStore(useShallow(state => ({
    storageAvailable: state.storageAvailable,
    authRequired: state.authRequired,
  })))

  return (
    <div className="vsm-system-settings">
      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>Canvas Quality</h2>
            <p>Set the base renderer quality used by the visual canvas.</p>
          </div>
        </div>
        <div className="vsm-settings-segment-row">
          {QUALITY_LEVELS.map(q => (
            <button
              key={q}
              className={`vz-settings-seg-btn${quality === q ? ' vz-settings-seg-btn--active' : ''}`}
              onClick={() => setQuality(q)}
            >{q}</button>
          ))}
        </div>
      </section>

      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading vsm-settings-group-heading--action">
          <div>
            <h2>Auto Quality</h2>
            <p>Allow DRMVYZ to adjust quality inside the selected bounds.</p>
          </div>
          <button
            className={`vz-settings-seg-btn vsm-settings-toggle${autoQualityEnabled ? ' vz-settings-seg-btn--active' : ''}`}
            onClick={() => setAutoQualityEnabled(!autoQualityEnabled)}
          >{autoQualityEnabled ? 'ON' : 'OFF'}</button>
        </div>
        {autoQualityEnabled && (
          <div className="vsm-auto-quality">
            <div className="vsm-auto-quality-row">
              <span>Min</span>
              <div className="vsm-settings-segment-row vsm-settings-segment-row--compact">
                {QUALITY_LEVELS.map(q => (
                  <button key={q}
                    className={`vz-settings-seg-btn${autoQualityMin === q ? ' vz-settings-seg-btn--active' : ''}`}
                    onClick={() => setAutoQualityMin(q)}
                  >{q}</button>
                ))}
              </div>
            </div>
            <div className="vsm-auto-quality-row">
              <span>Max</span>
              <div className="vsm-settings-segment-row vsm-settings-segment-row--compact">
                {QUALITY_LEVELS.map(q => (
                  <button key={q}
                    className={`vz-settings-seg-btn${autoQualityMax === q ? ' vz-settings-seg-btn--active' : ''}`}
                    onClick={() => setAutoQualityMax(q)}
                  >{q}</button>
                ))}
              </div>
            </div>
            <div className="vsm-settings-detail">
              Current: <span>{quality}</span>
              {autoQualityReason && <span className="vsm-settings-detail-reason">{autoQualityReason}</span>}
            </div>
          </div>
        )}
      </section>

      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>BPM Sync</h2>
            <p>Lock visual timing to the active track tempo.</p>
          </div>
        </div>
        <div className="vsm-settings-inline-row">
          <button
            className={`vz-settings-seg-btn vsm-settings-toggle${bpmSync ? ' vz-settings-seg-btn--active' : ''}`}
            onClick={toggleBpmSync}
          >{bpmSync ? 'ON' : 'OFF'}</button>
          <span>{bpmSync ? `Locked to ${bpm} BPM` : 'Free-running beat phase'}</span>
        </div>
      </section>

      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>Media Sync</h2>
            <p>Shows whether media changes can be persisted to cloud storage.</p>
          </div>
        </div>
        <div className="vsm-settings-inline-row">
          <span
            className={`vsm-media-sync-dot${storageAvailable && !authRequired ? ' is-online' : ''}`}
            aria-hidden="true"
          />
          <span>
            {!storageAvailable ? 'Local only — Supabase not configured'
              : authRequired   ? 'Signed out — media stored locally'
              :                  'Cloud sync enabled'}
          </span>
        </div>
      </section>

      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>Reset</h2>
            <p>Restore effect or modulation settings without changing saved media.</p>
          </div>
        </div>
        <div className="vsm-settings-actions">
          <button
            className="vz-settings-reset-btn"
            onClick={resetEffects}
            title="Set all effect sliders back to defaults"
          >Reset Effects</button>
          <button
            className="vz-settings-reset-btn"
            onClick={resetModulationRoutes}
            title="Restore default audio modulation routing"
          >Reset Modulation</button>
        </div>
      </section>

      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>Keyboard Shortcuts</h2>
            <p>Quick performance controls available from the main workspace.</p>
          </div>
        </div>
        <ShortcutPanel />
      </section>
    </div>
  )
}

type SettingsTab = 'account' | 'appearance' | 'brand' | 'system'

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'account', label: 'Account' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'brand', label: 'Brand Kit' },
  { id: 'system', label: 'System Settings' },
]

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>('account')
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    modalRef.current?.focus()
    return () => previousFocusRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !modalRef.current) return
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.hasAttribute('hidden'))
      if (focusable.length === 0) {
        event.preventDefault()
        modalRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="vsm-backdrop" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className="vsm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vsm-title"
        tabIndex={-1}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="vsm-header">
          <div id="vsm-title" className="vsm-title">SETTINGS</div>
          <button type="button" className="vsm-close" onClick={onClose} aria-label="Close settings">×</button>
        </div>
        <div className="vsm-body">
          <nav className="vsm-nav" role="tablist" aria-label="Settings sections">
            {SETTINGS_TABS.map(item => (
              <button
                key={item.id}
                id={`vsm-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`vsm-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className={`vsm-nav-item${tab === item.id ? ' vsm-nav-item--active' : ''}`}
                onClick={() => setTab(item.id)}
                onKeyDown={event => {
                  const index = SETTINGS_TABS.findIndex(candidate => candidate.id === item.id)
                  const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
                    : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1
                      : 0
                  if (!delta) return
                  event.preventDefault()
                  const next = SETTINGS_TABS[(index + delta + SETTINGS_TABS.length) % SETTINGS_TABS.length]
                  setTab(next.id)
                  requestAnimationFrame(() => document.getElementById(`vsm-tab-${next.id}`)?.focus())
                }}
              >{item.label}</button>
            ))}
          </nav>
          <div
            id={`vsm-panel-${tab}`}
            className={`vsm-content${tab === 'brand' ? ' vsm-content--brand' : ''}`}
            role="tabpanel"
            aria-labelledby={`vsm-tab-${tab}`}
            tabIndex={0}
          >
            {tab === 'account' && <AccountPanel />}
            {tab === 'appearance' && <AppearanceSettingsPanel />}
            {tab === 'brand' && <BrandKitSettingsPanel />}
            {tab === 'system' && <SystemSettingsPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
