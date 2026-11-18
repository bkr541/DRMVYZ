import { useCallback, useEffect, useMemo, useState } from 'react'
import { LibrarySearchRow } from '../../../components/vyzualz/react/controls/LibrarySearchRow'
import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { Collapsible, TextInputRow } from '../../../components/vyzualz/react/ReactControlRows'
import { formatDate, formatDateTime } from '../formatting'
import { loadAdminUsers } from './usersApi'
import { filterUsers, sortUsers, userLabel, type AdminUser, type SortDirection, type UserSortKey } from './userDirectory'

const NOOP = () => undefined
const COLUMNS: readonly { key: UserSortKey; label: string }[] = [
  { key: 'name', label: 'User' }, { key: 'artist', label: 'Artist / DJ' }, { key: 'email', label: 'Email' },
  { key: 'created', label: 'Registered' }, { key: 'lastSignIn', label: 'Last sign-in' }, { key: 'updated', label: 'Updated' },
]

function Avatar({ user, size = 28 }: { user: AdminUser; size?: number }) {
  const initials = userLabel(user).slice(0, 2).toUpperCase()
  return (
    <span className="vz-header-avatar adm-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {user.avatar_url ? <img src={user.avatar_url} alt="" className="vz-header-avatar-img" /> : <span className="vz-header-avatar-initials">{initials}</span>}
    </span>
  )
}

function UserDetail({ user }: { user: AdminUser }) {
  return (
    <div className="rv-workspace-panel" aria-label={`${userLabel(user)} profile`}>
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="adm-detail-identity"><Avatar user={user} size={64} /><strong>{userLabel(user)}</strong></div>
          <div className="rv-ctrl-group">
            <Collapsible label="Profile">
              <TextInputRow label="User ID" value={user.id} onChange={NOOP} readOnly maxLength={64} />
              <TextInputRow label="Email" value={user.email ?? '—'} onChange={NOOP} readOnly maxLength={320} />
              <TextInputRow label="Display Name" value={user.display_name ?? '—'} onChange={NOOP} readOnly maxLength={200} />
              <TextInputRow label="Artist / DJ Name" value={user.artist_name ?? '—'} onChange={NOOP} readOnly maxLength={200} />
              <TextInputRow label="Profile Picture" value={user.avatar_url ?? '—'} onChange={NOOP} readOnly maxLength={1000} />
            </Collapsible>
            <Collapsible label="Account">
              <TextInputRow label="Account Created" value={formatDateTime(user.created_at)} onChange={NOOP} readOnly maxLength={64} />
              <TextInputRow label="Last Updated" value={formatDateTime(user.updated_at)} onChange={NOOP} readOnly maxLength={64} />
              <TextInputRow label="Last Sign-In" value={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Never signed in'} onChange={NOOP} readOnly maxLength={64} />
            </Collapsible>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Read-only user directory: no editing, deleting or suspending. */
export function UsersTab() {
  const [users, setUsers] = useState<readonly AdminUser[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sortKey, setSortKey] = useState<UserSortKey>('created')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(() => {
    setStatus('loading'); setError(null)
    loadAdminUsers().then(rows => { setUsers(rows); setStatus('ready') }).catch((reason: Error) => { setError(reason.message); setStatus('error') })
  }, [])
  useEffect(load, [load])

  const visible = useMemo(() => sortUsers(filterUsers(users, { query, registeredFrom: from, registeredTo: to }), sortKey, direction), [users, query, from, to, sortKey, direction])
  const selected = users.find(user => user.id === selectedId) ?? null
  const sortBy = (key: UserSortKey) => {
    if (key === sortKey) setDirection(current => (current === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setDirection(key === 'created' || key === 'lastSignIn' || key === 'updated' ? 'desc' : 'asc') }
  }

  return (
    <div className="adm-split">
      <section className="adm-main" aria-label="Registered users">
        <div className="adm-toolbar">
          <LibrarySearchRow value={query} onChange={setQuery} placeholder="Search name or email" label="Search users" clearable className="adm-search" />
          <label className="adm-date"><span>Registered from</span><DreamVizTextInput type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} aria-label="Registered from" /></label>
          <label className="adm-date"><span>to</span><DreamVizTextInput type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} aria-label="Registered to" /></label>
          <span className="adm-count" role="status" aria-live="polite">
            <strong>{users.length.toLocaleString()}</strong> registered{visible.length !== users.length ? ` · ${visible.length.toLocaleString()} shown` : ''}
          </span>
        </div>
        {status === 'error' && <NoticeCard tone="warning" title="Users could not be loaded" role="alert">{error} <button type="button" className="adm-link" onClick={load}>Try again</button></NoticeCard>}
        {status === 'loading' && <p className="adm-empty" role="status">Loading users…</p>}
        {status === 'ready' && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  {COLUMNS.map(column => (
                    <th key={column.key} scope="col" aria-sort={sortKey === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="adm-sort" onClick={() => sortBy(column.key)}>
                        {column.label}<span aria-hidden="true">{sortKey === column.key ? (direction === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(user => (
                  <tr key={user.id} className={user.id === selectedId ? 'is-selected' : undefined} onClick={() => setSelectedId(user.id)}>
                    <td>
                      <button type="button" className="adm-row-button" aria-pressed={user.id === selectedId} onClick={event => { event.stopPropagation(); setSelectedId(user.id) }}>
                        <Avatar user={user} /><span>{userLabel(user)}</span>
                      </button>
                    </td>
                    <td>{user.artist_name ?? '—'}</td>
                    <td className="adm-ellipsis" title={user.email ?? undefined}>{user.email ?? '—'}</td>
                    <td>{formatDate(user.created_at)}</td>
                    <td>{user.last_sign_in_at ? formatDate(user.last_sign_in_at) : '—'}</td>
                    <td>{formatDate(user.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p className="adm-empty">{users.length === 0 ? 'No users yet.' : 'No users match.'}</p>}
          </div>
        )}
      </section>
      <aside className="adm-detail" aria-label="User profile">
        {selected ? <UserDetail user={selected} /> : <p className="adm-empty">Select a user to see their profile.</p>}
      </aside>
    </div>
  )
}
