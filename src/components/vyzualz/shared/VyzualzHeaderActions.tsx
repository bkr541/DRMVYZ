import { useState, useEffect } from 'react'
import { SettingsModal } from '../settings/SettingsModal'
import { supabase, supabaseConfigured } from '../../../lib/supabase'
import { getProfile } from '../../../lib/profileDb'

export function VyzualzHeaderActions() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null)
  const [initials,     setInitials]     = useState('')

  useEffect(() => {
    if (!supabaseConfigured) return
    let alive = true
    async function loadAvatar() {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (!user || !alive) return
      const { profile } = await getProfile(user.id)
      if (!alive) return
      setAvatarUrl(profile?.avatar_url ?? null)
      const name = profile?.display_name ?? user.email ?? ''
      setInitials(name.slice(0, 2).toUpperCase())
    }
    loadAvatar()
    return () => { alive = false }
  }, [settingsOpen])

  return (
    <>
      <button
        className="vsm-settings-btn"
        title="Settings"
        onClick={() => setSettingsOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
      </button>

      {supabaseConfigured && (
        <div className="vz-header-avatar" title={initials || 'Profile'}>
          {avatarUrl
            ? <img src={avatarUrl} alt="Profile" className="vz-header-avatar-img" />
            : <span className="vz-header-avatar-initials">{initials}</span>
          }
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
