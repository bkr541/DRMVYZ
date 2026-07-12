import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('../../supabase/migrations/0025_media_library_scaling.sql', import.meta.url), 'utf8')

describe('media library scaling migration', () => {
  it('uses an RLS-safe stable cursor with a unique tie-breaker', () => {
    expect(sql).toContain('security invoker')
    expect(sql).toContain('auth.uid()')
    expect(sql).toContain('(m.created_at, m.id) < (p_cursor_created_at, p_cursor_id)')
    expect(sql).toContain('order by created_at desc, id desc')
    expect(sql).toContain('limit v_limit + 1')
    expect(sql).toContain("m.lifecycle_status = 'complete'")
  })

  it('applies search, filters, collection ownership, and relationship hydration on the server', () => {
    expect(sql).toContain("lower(coalesce(m.title, m.name)) like '%' || v_search || '%'")
    expect(sql).toContain('search_tag.name')
    expect(sql).toContain('p_collection_id')
    expect(sql).toContain('jsonb_agg(t.name')
    expect(sql).toContain('jsonb_agg(mci.collection_id')
    expect(sql).toContain("p_filter = 'favorites'")
    expect(sql).toContain("p_scope not in ('all', 'react')")
    expect(sql).toContain("p_scope = 'all'")
  })

  it('keeps the RPC authenticated and backward-compatible with additive indexes', () => {
    expect(sql).toContain('create index if not exists')
    expect(sql).toContain('revoke all on function public.list_media_library_page')
    expect(sql).toContain('grant execute on function public.list_media_library_page')
    expect(sql).not.toMatch(/service_role|service key/i)
  })
})
