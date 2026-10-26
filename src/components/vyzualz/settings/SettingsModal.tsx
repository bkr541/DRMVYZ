import { AppIcon } from '../../shared/icons/AppIcon'
import { IconMorphToggle } from '../react/controls/IconMorphToggle'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVisualStore } from '../../../stores/visualStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { supabase, supabaseConfigured } from '../../../lib/supabase'
import { getProfile, updateProfile, uploadAvatar } from '../../../lib/profileDb'
import type { Profile } from '../../../types/database'
import { BrandKitSettingsPanel } from '../../../features/personalization/components/BrandKitSettingsPanel'
import { AppearanceSettingsPanel } from '../../../features/appearance/AppearanceSettingsPanel'
import { getRecentLogEntries } from '../../../lib/logger'
import { DeveloperPanel } from './developer/DeveloperPanel'
import { DjSoftwareSettingsPanel } from './DjSoftwareSettingsPanel'

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

  if (!supabaseConfigured) return <AccountPanelView state="offline" />
  if (loading) return <AccountPanelView state="loading" />

  return (
    <AccountPanelView
      state="ready"
      email={email}
      displayName={displayName}
      artistName={artistName}
      avatarUrl={avatarUrl}
      uploading={uploading}
      saving={saving}
      canSave={!!userId}
      saveMsg={saveMsg}
      onDisplayNameChange={setDisplayName}
      onArtistNameChange={setArtistName}
      onSave={handleSave}
      onAvatarFile={handleAvatarFile}
    />
  )
}

/** The Account tab's markup. Layout Lab mounts it with placeholder values instead of a signed-in profile. */
export function AccountPanelView(props: {
  state: 'offline' | 'loading' | 'ready'
  email?: string
  displayName?: string
  artistName?: string
  avatarUrl?: string | null
  uploading?: boolean
  saving?: boolean
  canSave?: boolean
  saveMsg?: { text: string; ok: boolean } | null
  onDisplayNameChange?: (value: string) => void
  onArtistNameChange?: (value: string) => void
  onSave?: () => void
  onAvatarFile?: (file: File) => void
}) {
  const {
    state, email = '', displayName = '', artistName = '', avatarUrl = null, uploading = false, saving = false,
    canSave = false, saveMsg = null, onDisplayNameChange, onArtistNameChange, onSave, onAvatarFile,
  } = props
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    onAvatarFile?.(file)
  }

  if (state === 'offline') {
    return (
      <div className="vsm-acct-offline">
        <AppIcon kind="warning" size="20" />
        Cloud sync is not configured. Profile settings require Supabase.
      </div>
    )
  }

  if (state === 'loading') {
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
            <AppIcon kind="upload" size="12" />
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
          <DreamVizTextInput
            className="vsm-acct-input vsm-acct-input--readonly"
            type="email"
            value={email}
            readOnly
            tabIndex={-1}
          />
        </div>

        <div className="vsm-acct-field">
          <label className="vsm-acct-label" htmlFor="vsm-display-name">Display Name</label>
          <DreamVizTextInput
            id="vsm-display-name"
            className="vsm-acct-input"
            type="text"
            placeholder="Your name"
            value={displayName}
            maxLength={80}
            onChange={e => onDisplayNameChange?.(e.target.value)}
          />
        </div>

        <div className="vsm-acct-field">
          <label className="vsm-acct-label" htmlFor="vsm-artist-name">Artist Name</label>
          <DreamVizTextInput
            id="vsm-artist-name"
            className="vsm-acct-input"
            type="text"
            placeholder="Stage name or alias"
            value={artistName}
            maxLength={80}
            onChange={e => onArtistNameChange?.(e.target.value)}
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
          disabled={saving || !canSave}
          onClick={onSave}
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

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function buildDiagnosticsReport(): string {
  const entries = getRecentLogEntries()
  const lines = [
    `DRMVYZ diagnostics — ${new Date().toISOString()}`,
    `Platform: ${window.drmvyzNative?.runtime?.platform ?? 'unknown'} (electron: ${window.drmvyzNative?.runtime?.isElectron ? 'yes' : 'no'})`,
    `User agent: ${navigator.userAgent}`,
    '',
    `Recent log entries (${entries.length}):`,
    ...entries.map(entry => {
      const time = new Date(entry.timestamp).toISOString()
      const context = entry.context !== undefined ? ` ${safeStringify(entry.context)}` : ''
      return `${time} [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${context}`
    }),
  ]
  return lines.join('\n')
}

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
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const diagnosticsStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (diagnosticsStatusTimer.current) clearTimeout(diagnosticsStatusTimer.current)
  }, [])

  const handleCopyDiagnostics = useCallback(() => {
    const write = navigator.clipboard?.writeText(buildDiagnosticsReport())
    if (!write) { setDiagnosticsStatus('error'); return }
    void write
      .then(() => setDiagnosticsStatus('copied'))
      .catch(() => setDiagnosticsStatus('error'))
      .finally(() => {
        if (diagnosticsStatusTimer.current) clearTimeout(diagnosticsStatusTimer.current)
        diagnosticsStatusTimer.current = setTimeout(() => setDiagnosticsStatus('idle'), 2000)
      })
  }, [])

  return (
    <SystemSettingsView
      quality={quality}
      onQualityChange={setQuality}
      autoQualityEnabled={autoQualityEnabled}
      autoQualityMin={autoQualityMin}
      autoQualityMax={autoQualityMax}
      autoQualityReason={autoQualityReason}
      onAutoQualityEnabledChange={setAutoQualityEnabled}
      onAutoQualityMinChange={setAutoQualityMin}
      onAutoQualityMaxChange={setAutoQualityMax}
      bpmSync={bpmSync}
      onToggleBpmSync={toggleBpmSync}
      bpm={bpm}
      storageAvailable={storageAvailable}
      authRequired={authRequired}
      onResetEffects={resetEffects}
      onResetModulation={resetModulationRoutes}
      diagnosticsStatus={diagnosticsStatus}
      onCopyDiagnostics={handleCopyDiagnostics}
    />
  )
}

type QualityLevel = typeof QUALITY_LEVELS[number]

/** The System Settings tab's markup. Layout Lab mounts it with placeholder values instead of the visual and media stores. */
export function SystemSettingsView({
  quality, onQualityChange, autoQualityEnabled, autoQualityMin, autoQualityMax, autoQualityReason,
  onAutoQualityEnabledChange, onAutoQualityMinChange, onAutoQualityMaxChange, bpmSync, onToggleBpmSync, bpm,
  storageAvailable, authRequired, onResetEffects, onResetModulation, diagnosticsStatus, onCopyDiagnostics,
}: {
  quality: QualityLevel
  onQualityChange: (quality: QualityLevel) => void
  autoQualityEnabled: boolean
  autoQualityMin: QualityLevel
  autoQualityMax: QualityLevel
  autoQualityReason?: string | null
  onAutoQualityEnabledChange: (enabled: boolean) => void
  onAutoQualityMinChange: (quality: QualityLevel) => void
  onAutoQualityMaxChange: (quality: QualityLevel) => void
  bpmSync: boolean
  onToggleBpmSync: () => void
  bpm: number
  storageAvailable: boolean
  authRequired: boolean
  onResetEffects: () => void
  onResetModulation: () => void
  diagnosticsStatus: 'idle' | 'copied' | 'error'
  onCopyDiagnostics: () => void
}) {
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
              onClick={() => onQualityChange(q)}
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
          <IconMorphToggle
            checked={autoQualityEnabled}
            onCheckedChange={onAutoQualityEnabledChange}
            className="vz-settings-seg-btn vsm-settings-toggle"
            aria-label="Auto Quality"
          />
        </div>
        {autoQualityEnabled && (
          <div className="vsm-auto-quality">
            <div className="vsm-auto-quality-row">
              <span>Min</span>
              <div className="vsm-settings-segment-row vsm-settings-segment-row--compact">
                {QUALITY_LEVELS.map(q => (
                  <button key={q}
                    className={`vz-settings-seg-btn${autoQualityMin === q ? ' vz-settings-seg-btn--active' : ''}`}
                    onClick={() => onAutoQualityMinChange(q)}
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
                    onClick={() => onAutoQualityMaxChange(q)}
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
          <IconMorphToggle
            checked={bpmSync}
            onCheckedChange={() => onToggleBpmSync()}
            className="vz-settings-seg-btn vsm-settings-toggle"
            aria-label="BPM Sync"
          />
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
            onClick={onResetEffects}
            title="Set all effect sliders back to defaults"
          >Reset Effects</button>
          <button
            className="vz-settings-reset-btn"
            onClick={onResetModulation}
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

      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>Diagnostics</h2>
            <p>Copy recent app activity to share when reporting an issue.</p>
          </div>
        </div>
        <div className="vsm-settings-actions">
          <button
            className="vz-settings-reset-btn"
            onClick={onCopyDiagnostics}
            title="Copy recent log activity and basic environment info to the clipboard"
          >Copy Diagnostics</button>
        </div>
        {diagnosticsStatus !== 'idle' && (
          <div
            className={`vsm-settings-detail${diagnosticsStatus === 'error' ? ' vsm-settings-detail--error' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span>{diagnosticsStatus === 'copied' ? 'Copied to clipboard.' : 'Could not copy — clipboard unavailable.'}</span>
          </div>
        )}
      </section>
    </div>
  )
}

export type SettingsTab = 'account' | 'appearance' | 'brand' | 'system' | 'dj-software' | 'developer'

export const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'account', label: 'Account' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'brand', label: 'Brand Kit' },
  { id: 'system', label: 'System Settings' },
  { id: 'dj-software', label: 'DJ Software' },
  { id: 'developer', label: 'Developer' },
]

/** The pop-up's surface: header, section navigation and content pane around whichever panel is active. Layout Lab renders it inline. */
export function SettingsModalFrame({
  tab, onTabChange, onClose, onSignOut, children, modalRef, dialog = true, idPrefix = 'vsm', className, style,
}: {
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  onClose: () => void
  onSignOut: () => void
  children: React.ReactNode
  modalRef?: React.Ref<HTMLDivElement>
  /** A real modal dialog (focus trap, aria-modal) or an inline copy of its surface. */
  dialog?: boolean
  idPrefix?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      ref={modalRef}
      className={`vsm-modal${className ? ` ${className}` : ''}`}
      style={style}
      role={dialog ? 'dialog' : 'group'}
      aria-modal={dialog ? true : undefined}
      aria-labelledby={`${idPrefix}-title`}
      tabIndex={-1}
      onMouseDown={event => event.stopPropagation()}
    >
        <div className="vsm-header">
          <div id={`${idPrefix}-title`} className="vsm-title">SETTINGS</div>
          <button type="button" className="vsm-close" onClick={onClose} aria-label="Close settings"><AppIcon kind="close" size={14} /></button>
        </div>
        <div className="vsm-body">
          <nav className="vsm-nav" role="tablist" aria-label="Settings sections">
            {SETTINGS_TABS.map(item => (
              <button
                key={item.id}
                id={`${idPrefix}-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`${idPrefix}-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className={`vsm-nav-item${tab === item.id ? ' vsm-nav-item--active' : ''}`}
                onClick={() => onTabChange(item.id)}
                onKeyDown={event => {
                  const index = SETTINGS_TABS.findIndex(candidate => candidate.id === item.id)
                  const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
                    : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1
                      : 0
                  if (!delta) return
                  event.preventDefault()
                  const next = SETTINGS_TABS[(index + delta + SETTINGS_TABS.length) % SETTINGS_TABS.length]
                  onTabChange(next.id)
                  requestAnimationFrame(() => document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus())
                }}
              >{item.label}</button>
            ))}
            <div className="vsm-nav-footer">
              <button
                type="button"
                className="vsm-nav-item vsm-nav-signout"
                onClick={onSignOut}
              >Sign Out</button>
            </div>
          </nav>
          <div
            id={`${idPrefix}-panel-${tab}`}
            className={`vsm-content${tab === 'brand' ? ' vsm-content--brand' : ''}${tab === 'developer' ? ' vsm-content--developer' : ''}`}
            role="tabpanel"
            aria-labelledby={`${idPrefix}-tab-${tab}`}
            tabIndex={0}
          >
            {children}
          </div>
        </div>
      </div>
  )
}

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
      <SettingsModalFrame
        tab={tab}
        onTabChange={setTab}
        onClose={onClose}
        onSignOut={() => { onClose(); void supabase.auth.signOut() }}
        modalRef={modalRef}
      >
        {tab === 'account' && <AccountPanel />}
        {tab === 'appearance' && <AppearanceSettingsPanel />}
        {tab === 'brand' && <BrandKitSettingsPanel />}
        {tab === 'system' && <SystemSettingsPanel />}
        {tab === 'dj-software' && <DjSoftwareSettingsPanel />}
        {tab === 'developer' && <DeveloperPanel />}
      </SettingsModalFrame>
    </div>
  )
}
