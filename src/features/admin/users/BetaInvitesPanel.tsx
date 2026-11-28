import { useCallback, useEffect, useState } from 'react'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { Collapsible, TextInputRow } from '../../../components/vyzualz/react/ReactControlRows'
import { formatDate } from '../formatting'
import { addBetaInvite, isValidInviteEmail, loadBetaInvites, normalizeInviteEmail, removeBetaInvite, type BetaInvite } from './betaInvitesApi'

/**
 * Who may join the private beta. Sign-up through the app is refused for any email not listed here (migration 0065); a listed email becomes
 * "Joined" when its account is created. Withdrawing an invite does not remove an account that already exists.
 */
export function BetaInvitesPanel() {
  const [invites, setInvites] = useState<readonly BetaInvite[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    setStatus('loading')
    loadBetaInvites().then(rows => { setInvites(rows); setStatus('ready') }).catch((error: Error) => { setMessage(error.message); setStatus('error') })
  }, [])
  useEffect(load, [load])

  const normalized = normalizeInviteEmail(email)
  const duplicate = invites.some(invite => invite.email === normalized)
  const canAdd = !busy && isValidInviteEmail(email) && !duplicate

  const add = async () => {
    if (!canAdd) return
    setBusy(true); setMessage(null)
    try {
      const created = await addBetaInvite(email, note)
      setInvites(current => [created, ...current]); setEmail(''); setNote('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The invite was not saved.')
    } finally { setBusy(false) }
  }
  const remove = async (target: string) => {
    setBusy(true); setMessage(null)
    try {
      await removeBetaInvite(target)
      setInvites(current => current.filter(invite => invite.email !== target))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The invite was not withdrawn.')
    } finally { setBusy(false) }
  }

  return (
    <div className="rv-workspace-panel" aria-label="Beta invites">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group">
            <Collapsible label="Invite a Tester">
              <TextInputRow label="Email" value={email} onChange={setEmail} maxLength={320} placeholder="tester@example.com"
                description="They sign up in the app with this email. No email is sent: let them know yourself." />
              {email.trim() && !isValidInviteEmail(email) && <p className="adm-field-error" role="alert">Enter a full email address.</p>}
              {duplicate && <p className="adm-field-error" role="alert">This email is already invited.</p>}
              <TextInputRow label="Note" value={note} onChange={setNote} maxLength={200} placeholder="Optional, for example: Tester 2, Cinema 2.0" />
              <div className="adm-inline-actions"><IconChipButton tone="primary" disabled={!canAdd} onClick={() => void add()}>Invite</IconChipButton></div>
            </Collapsible>
            <Collapsible label={`Invites (${invites.length})`}>
              {status === 'loading' && <p className="adm-empty" role="status">Loading invites…</p>}
              {status === 'ready' && invites.length === 0 && <p className="adm-muted">No one is invited yet.</p>}
              <ul className="adm-members" aria-label="Beta invites">
                {invites.map(invite => (
                  <li key={invite.email} className="adm-member">
                    <span className="adm-member-name">{invite.email}<small>{invite.accepted_at ? `Joined ${formatDate(invite.accepted_at)}` : `Invited ${formatDate(invite.created_at)}`}{invite.note ? ` · ${invite.note}` : ''}</small></span>
                    <IconChipButton disabled={busy} onClick={() => void remove(invite.email)} aria-label={`Withdraw the invite for ${invite.email}`}>Withdraw</IconChipButton>
                  </li>
                ))}
              </ul>
            </Collapsible>
            {message && <NoticeCard tone="warning" title="Not saved" role="alert">{message} {status === 'error' && <IconChipButton onClick={load}>Try again</IconChipButton>}</NoticeCard>}
          </div>
        </div>
      </div>
    </div>
  )
}
