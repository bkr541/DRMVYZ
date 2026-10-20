import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../../supabase/migrations/0039_preset_organization.sql', import.meta.url),
  'utf8',
)

describe('preset organization migration', () => {
  it('keeps preset organization separate from Media Manager item membership', () => {
    expect(migration).toContain('create table if not exists public.preset_organization')
    expect(migration).toContain('tags text[]')
    expect(migration).toContain('collection_ids uuid[]')
    expect(migration).not.toMatch(/insert\s+into\s+public\.media_collection_items/i)
    expect(migration).not.toMatch(/insert\s+into\s+public\.media_item_tags/i)
  })

  it('restricts every preset organization operation to its owner', () => {
    expect(migration).toContain('"preset_organization: own select"')
    expect(migration).toContain('"preset_organization: own insert"')
    expect(migration).toContain('"preset_organization: own update"')
    expect(migration).toContain('"preset_organization: own delete"')
  })
})
