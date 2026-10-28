import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../shared/icons/AppIcon'
import { SettingsModal } from '../settings/SettingsModal'
import { supabase, supabaseConfigured } from '../../../lib/supabase'
import { getProfile } from '../../../lib/profileDb'

/** One persistent account/settings entry in the application's left navigation. */
export function VyzualzProfileControl() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [initials, setInitials] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)

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
    // Account loading may be unavailable offline; settings must stay reachable.
    void loadAvatar().catch(() => {})
    return () => { alive = false }
  }, [settingsOpen])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="az-nav-item vz-profile-control"
        title="Profile and settings"
        aria-label="Profile and settings"
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen(true)}
      >
        <span className="vz-header-avatar" aria-hidden="true">
          {supabaseConfigured && (avatarUrl || initials)
            ? avatarUrl
              ? <img src={avatarUrl} alt="" className="vz-header-avatar-img" />
              : <span className="vz-header-avatar-initials">{initials}</span>
            : <AppIcon kind="settings" size={18} />}
        </span>
        <span className="az-nav-label">Profile</span>
      </button>
      {settingsOpen && createPortal(
        <SettingsModal onClose={() => setSettingsOpen(false)} />,
        buttonRef.current?.closest('.az-root') ?? document.body,
      )}
    </>
  )
}
