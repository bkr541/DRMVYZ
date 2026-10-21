import { AppIcon } from '../../shared/icons/AppIcon'
import { useState, useEffect, type ReactNode } from 'react'
import { SettingsModal } from '../settings/SettingsModal'
import { supabase, supabaseConfigured } from '../../../lib/supabase'
import { getProfile } from '../../../lib/profileDb'
import { HeaderSystemStatus } from './HeaderSystemStatus'
import type { AppPageId } from '../../../stores/pageActivityStore'

/**
 * Header tail shared by every page: optional page status (`leading`), CPU + activity status, then the profile / settings button.
 * A page that arranges the status elements itself (React) passes them as `status`, which replaces the default cluster.
 */
export function VyzualzHeaderActions({ page, leading, status }: { page: AppPageId; leading?: ReactNode; status?: ReactNode }) {
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
      {leading}
      {status ?? <HeaderSystemStatus page={page} />}
      {supabaseConfigured ? (
        <button
          type="button"
          className="vz-header-avatar"
          title={initials || 'Settings'}
          onClick={() => setSettingsOpen(true)}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="Profile" className="vz-header-avatar-img" />
            : <span className="vz-header-avatar-initials">{initials}</span>
          }
        </button>
      ) : (
        <button
          className="vsm-settings-btn"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <AppIcon kind="settings" size={18} />
        </button>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
