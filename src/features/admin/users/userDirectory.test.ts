import { describe, expect, it } from 'vitest'
import { filterUsers, sortUsers, userLabel, type AdminUser } from './userDirectory'

const user = (id: string, patch: Partial<AdminUser> = {}): AdminUser => ({
  id, email: `${id}@example.com`, display_name: null, artist_name: null, avatar_url: null,
  created_at: '2026-03-10T12:00:00Z', updated_at: '2026-03-11T12:00:00Z', last_sign_in_at: null, ...patch,
})
const USERS = [
  user('ada', { display_name: 'Ada Lovelace', artist_name: 'DJ Analytical', created_at: '2026-01-05T09:00:00Z', last_sign_in_at: '2026-04-01T00:00:00Z' }),
  user('bob', { display_name: 'Bob', created_at: '2026-02-20T09:00:00Z' }),
  user('cy', { artist_name: 'Cy Phase', created_at: '2026-03-30T23:30:00Z', last_sign_in_at: '2026-03-31T00:00:00Z' }),
]

describe('user directory', () => {
  it('labels a user by display name, then the email name, then the id', () => {
    expect(userLabel(USERS[0]!)).toBe('Ada Lovelace')
    expect(userLabel(USERS[2]!)).toBe('cy')
    expect(userLabel({ ...USERS[2]!, email: null })).toBe('cy')
  })

  it('searches name, artist name and email, ignoring case', () => {
    const find = (query: string) => filterUsers(USERS, { query, registeredFrom: '', registeredTo: '' }).map(entry => entry.id)
    expect(find('LOVELACE')).toEqual(['ada'])
    expect(find('phase')).toEqual(['cy'])
    expect(find('bob@')).toEqual(['bob'])
    expect(find('example.com')).toEqual(['ada', 'bob', 'cy'])
    expect(find('nobody')).toEqual([])
  })

  it('filters by registration date, both ends inclusive of the whole day', () => {
    const range = (registeredFrom: string, registeredTo: string) => filterUsers(USERS, { query: '', registeredFrom, registeredTo }).map(entry => entry.id)
    expect(range('2026-02-01', '')).toEqual(['bob', 'cy'])
    expect(range('', '2026-02-20')).toEqual(['ada', 'bob'])
    expect(range('2026-03-30', '2026-03-30')).toEqual(['cy'])
    expect(range('2026-04-01', '')).toEqual([])
  })

  it('sorts either way and always puts empty values last', () => {
    expect(sortUsers(USERS, 'name', 'asc').map(entry => entry.id)).toEqual(['ada', 'bob', 'cy'])
    expect(sortUsers(USERS, 'created', 'desc').map(entry => entry.id)).toEqual(['cy', 'bob', 'ada'])
    expect(sortUsers(USERS, 'lastSignIn', 'desc').map(entry => entry.id)).toEqual(['ada', 'cy', 'bob'])
    expect(sortUsers(USERS, 'lastSignIn', 'asc').map(entry => entry.id)).toEqual(['cy', 'ada', 'bob'])
    expect(sortUsers(USERS, 'artist', 'asc').map(entry => entry.id)).toEqual(['cy', 'ada', 'bob'])
  })
})
