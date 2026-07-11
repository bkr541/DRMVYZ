import { describe, expect, it } from 'vitest'
import migrationSql from '../../supabase/migrations/0023_media_atomic_mutations.sql?raw'

function compact(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

const sql = compact(migrationSql)
const save = sql.slice(
  sql.indexOf('CREATE OR REPLACE FUNCTION public.save_media_item_atomic'),
  sql.indexOf('CREATE OR REPLACE FUNCTION public.reorder_media_collection_atomic'),
)
const reorder = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.reorder_media_collection_atomic'))

describe('0023 media atomic mutation migration contract', () => {
  it('adds a backward-compatible revision and advances it from a database trigger', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1')
    expect(sql).toContain('NEW.revision := OLD.revision + 1')
    expect(sql).toContain('BEFORE UPDATE ON public.media_items')
  })

  it('locks and ownership-checks the canonical media row before revision validation', () => {
    expect(save).toContain('v_user_id uuid := auth.uid()')
    expect(save).toContain('FROM public.media_items WHERE id = p_media_item_id FOR UPDATE')
    expect(save).toContain('v_existing.user_id IS DISTINCT FROM v_user_id')
    expect(save).toContain('v_existing.revision <> p_expected_revision')
    expect(save).toContain("'status', 'conflict'")
    expect(save).toContain("'current_revision', v_existing.revision")
  })

  it('keeps metadata, tags, and collections inside one rollback boundary', () => {
    expect(save).toContain('UPDATE public.media_items SET media_role = CASE')
    expect(save).toContain('INSERT INTO public.media_tags')
    expect(save).toContain('DELETE FROM public.media_item_tags')
    expect(save).toContain('INSERT INTO public.media_item_tags')
    expect(save).toContain('DELETE FROM public.media_collection_items')
    expect(save).toContain('INSERT INTO public.media_collection_items')
    expect(save).toContain('EXCEPTION WHEN check_violation OR not_null_violation OR foreign_key_violation OR unique_violation')
    expect(save).toContain('no changes were saved')
  })

  it('validates complete relationship sets before canonical mutation', () => {
    const updateIndex = save.indexOf('UPDATE public.media_items SET')
    expect(save.indexOf('Collection identifiers must be unique UUID strings.')).toBeLessThan(updateIndex)
    expect(save.indexOf('owned_collection.user_id = v_user_id')).toBeLessThan(updateIndex)
    expect(save.indexOf('Every tag must be non-empty text')).toBeLessThan(updateIndex)
  })

  it('returns the complete canonical item only after all writes succeed', () => {
    expect(save).toContain('public.media_item_canonical_payload(p_media_item_id, v_user_id)')
    expect(save).toContain("'status', 'success', 'media_item', v_canonical")
    expect(sql).toContain("'tags', COALESCE")
    expect(sql).toContain("'collection_ids', COALESCE")
  })

  it('serializes membership changes with collection ordering', () => {
    expect(sql).toContain('CREATE TRIGGER trg_media_collection_items_lock_parent')
    expect(sql).toContain('BEFORE INSERT OR UPDATE OR DELETE ON public.media_collection_items')
    expect(save).toContain('Lock every current and desired collection in deterministic UUID order')
    expect(save).toContain('ORDER BY collection_row.id FOR UPDATE')
  })

  it('makes collection ordering complete, duplicate-safe, owned, and bulk atomic', () => {
    expect(reorder).toContain('FROM public.media_collections WHERE id = p_collection_id AND user_id = v_user_id FOR UPDATE')
    expect(reorder).toContain('count(DISTINCT requested.media_id)')
    expect(reorder).toContain('Collection order must include every current item exactly once.')
    expect(reorder).toContain('media_row.user_id = v_user_id')
    expect(reorder).toContain('UPDATE public.media_collection_items AS membership SET sort_order = desired.ordinal_position - 1')
    expect(reorder).toContain('ORDER BY membership.sort_order, membership.media_item_id')
    expect(reorder).toContain('The previous order was preserved.')
  })

  it('keeps service credentials out and grants only authenticated RPC execution', () => {
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(3)
    expect(sql.match(/SET search_path = pg_catalog, public/g)?.length).toBeGreaterThanOrEqual(4)
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.save_media_item_atomic')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.save_media_item_atomic')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.reorder_media_collection_atomic')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.reorder_media_collection_atomic')
  })
})
