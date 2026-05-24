import { useState, useEffect, useRef, useCallback } from 'react'
import { useVisualStore } from '../../../stores/visualStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { supabase, supabaseConfigured } from '../../../lib/supabase'
import { getProfile, updateProfile, uploadAvatar } from '../../../lib/profileDb'
import type { Profile } from '../../../types/database'

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
    <div className="vz-shortcuts-section">
      <span className="vz-shortcuts-label">Shortcuts</span>
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
  const { storageAvailable, authRequired } = useMediaStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="az-popover-section-title">Canvas Quality</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {QUALITY_LEVELS.map(q => (
            <button
              key={q}
              className={`vz-settings-seg-btn${quality === q ? ' vz-settings-seg-btn--active' : ''}`}
              onClick={() => setQuality(q)}
            >{q}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="az-popover-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Auto Quality
          <button
            className={`vz-settings-seg-btn${autoQualityEnabled ? ' vz-settings-seg-btn--active' : ''}`}
            style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px' }}
            onClick={() => setAutoQualityEnabled(!autoQualityEnabled)}
          >{autoQualityEnabled ? 'ON' : 'OFF'}</button>
        </div>
        {autoQualityEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'rgba(245,248,250,0.5)', width: 28 }}>Min</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {QUALITY_LEVELS.map(q => (
                  <button key={q}
                    className={`vz-settings-seg-btn${autoQualityMin === q ? ' vz-settings-seg-btn--active' : ''}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setAutoQualityMin(q)}
                  >{q}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'rgba(245,248,250,0.5)', width: 28 }}>Max</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {QUALITY_LEVELS.map(q => (
                  <button key={q}
                    className={`vz-settings-seg-btn${autoQualityMax === q ? ' vz-settings-seg-btn--active' : ''}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setAutoQualityMax(q)}
                  >{q}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(245,248,250,0.45)', fontFamily: 'var(--az-font-data)', lineHeight: 1.5 }}>
              Current: <span style={{ color: 'rgba(74,199,219,0.85)' }}>{quality}</span>
              {autoQualityReason && (
                <span style={{ marginLeft: 8, color: 'rgba(245,248,250,0.3)' }}>{autoQualityReason}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="az-popover-section-title">BPM Sync</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`vz-settings-seg-btn${bpmSync ? ' vz-settings-seg-btn--active' : ''}`}
            onClick={toggleBpmSync}
            style={{ minWidth: 54 }}
          >{bpmSync ? 'ON' : 'OFF'}</button>
          <span style={{ fontSize: 11, color: 'rgba(245,248,250,0.45)', fontFamily: 'var(--az-font-data)' }}>
            {bpmSync ? `Locked to ${bpm} BPM` : 'Free-running beat phase'}
          </span>
        </div>
      </div>

      <div>
        <div className="az-popover-section-title">Media Sync</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: storageAvailable && !authRequired ? '#61d6aa' : 'rgba(245,248,250,0.2)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: 'rgba(245,248,250,0.55)', fontFamily: 'var(--az-font-data)' }}>
            {!storageAvailable ? 'Local only — Supabase not configured'
              : authRequired   ? 'Signed out — media stored locally'
              :                  'Cloud sync enabled'}
          </span>
        </div>
      </div>

      <div>
        <div className="az-popover-section-title">Reset</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
      </div>
    </div>
  )
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'account' | 'shortcuts' | 'system'>('account')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="vsm-backdrop" onMouseDown={onClose}>
      <div className="vsm-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <div className="vsm-header">
          <div className="vsm-title">SETTINGS</div>
          <button className="vsm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="vsm-body">
          <nav className="vsm-nav">
            <div
              className={`vsm-nav-item${tab === 'account' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('account')}
            >Account</div>
            <div
              className={`vsm-nav-item${tab === 'shortcuts' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('shortcuts')}
            >Shortcuts</div>
            <div
              className={`vsm-nav-item${tab === 'system' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('system')}
            >System Settings</div>
          </nav>
          <div className="vsm-content">
            {tab === 'account' && <AccountPanel />}
            {tab === 'shortcuts' && <ShortcutPanel />}
            {tab === 'system' && <SystemSettingsPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
