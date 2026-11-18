export interface AdminUser {
  id: string
  email: string | null
  display_name: string | null
  artist_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string | null
  last_sign_in_at: string | null
}

export type UserSortKey = 'name' | 'artist' | 'email' | 'created' | 'lastSignIn' | 'updated'
export type SortDirection = 'asc' | 'desc'

export interface UserFilter {
  query: string
  /** Inclusive, as the yyyy-mm-dd a date input gives. Empty = no limit. */
  registeredFrom: string
  registeredTo: string
}

const norm = (value: string | null | undefined) => (value ?? '').toLowerCase()

/** What to show for a user whose profile has no display name: the part of the email before the @, then the id. */
export function userLabel(user: AdminUser): string {
  return user.display_name?.trim() || user.email?.split('@')[0] || user.id
}

export function filterUsers(users: readonly AdminUser[], filter: UserFilter): AdminUser[] {
  const query = filter.query.trim().toLowerCase()
  // A date input has no time or zone: from starts at the beginning of that day and to ends at the end of it, in the viewer's local time.
  const from = filter.registeredFrom ? new Date(`${filter.registeredFrom}T00:00:00`).getTime() : null
  const to = filter.registeredTo ? new Date(`${filter.registeredTo}T23:59:59.999`).getTime() : null
  return users.filter(user => {
    if (query && ![user.display_name, user.artist_name, user.email].some(value => norm(value).includes(query))) return false
    const created = new Date(user.created_at).getTime()
    if (from !== null && created < from) return false
    if (to !== null && created > to) return false
    return true
  })
}

const text = (user: AdminUser, key: UserSortKey): string | number | null => {
  switch (key) {
    case 'name': return userLabel(user).toLowerCase()
    case 'artist': return user.artist_name?.trim().toLowerCase() || null
    case 'email': return norm(user.email) || null
    case 'created': return new Date(user.created_at).getTime()
    case 'lastSignIn': return user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : null
    case 'updated': return user.updated_at ? new Date(user.updated_at).getTime() : null
  }
}

/** Empty values always sort last, whichever way the column runs. */
export function sortUsers(users: readonly AdminUser[], key: UserSortKey, direction: SortDirection): AdminUser[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...users].sort((a, b) => {
    const left = text(a, key), right = text(b, key)
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    return (left < right ? -1 : left > right ? 1 : 0) * sign
  })
}
