import { describe, expect, it } from 'vitest'
import migrationSql from '../../supabase/migrations/0024_media_upload_deletion_recovery.sql?raw'

function compact(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

const sql = compact(migrationSql)
const beginUpload = sql.slice(
  sql.indexOf('CREATE OR REPLACE FUNCTION public.begin_media_upload'),
  sql.indexOf('CREATE OR REPLACE FUNCTION public.finalize_media_upload_atomic'),
)
const finalizeUpload = sql.slice(
  sql.indexOf('CREATE OR REPLACE FUNCTION public.finalize_media_upload_atomic'),
  sql.indexOf('CREATE OR REPLACE FUNCTION public.mark_media_upload_cleanup_pending'),
)
const requestDeletion = sql.slice(
  sql.indexOf('CREATE OR REPLACE FUNCTION public.request_media_deletion'),
  sql.indexOf('CREATE OR REPLACE FUNCTION public.finalize_media_deletion'),
)
const finalizeDeletion = sql.slice(
  sql.indexOf('CREATE OR REPLACE FUNCTION public.finalize_media_deletion'),
  sql.indexOf('CREATE OR REPLACE FUNCTION public.list_pending_media_cleanup'),
)

describe('0024 recoverable media upload and deletion migration contract', () => {
  it('adds a user-scoped idempotency key without invalidating historical rows', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS upload_operation_id uuid')
    expect(sql).toContain('UNIQUE (user_id, upload_operation_id)')
    expect(sql).toContain("lifecycle_status text NOT NULL DEFAULT 'complete'")
  })

  it('binds one operation ID to deterministic owned paths and permits status-only derivative retry', () => {
    expect(beginUpload).toContain('WHERE user_id = v_user_id AND operation_id = p_operation_id FOR UPDATE')
    expect(beginUpload).toContain('v_existing.original_path <> p_original_path')
    expect(beginUpload).toContain("requested->>'path' = bound->>'path'")
    expect(beginUpload).toContain("requested->>'kind' = bound->>'kind'")
    expect(beginUpload).toContain("(requested->>'required')::boolean = (bound->>'required')::boolean")
  })

  it('creates the media row and complete organization sets in one transaction', () => {
    expect(finalizeUpload).toContain('INSERT INTO public.media_items')
    expect(finalizeUpload).toContain('ON CONFLICT (user_id, upload_operation_id) DO UPDATE SET')
    expect(finalizeUpload).toContain('INSERT INTO public.media_tags')
    expect(finalizeUpload).toContain('DELETE FROM public.media_item_tags')
    expect(finalizeUpload).toContain('INSERT INTO public.media_item_tags')
    expect(finalizeUpload).toContain('DELETE FROM public.media_collection_items')
    expect(finalizeUpload).toContain('INSERT INTO public.media_collection_items')
    expect(finalizeUpload).toContain('public.media_item_canonical_payload(v_media_id, v_user_id)')
  })

  it('rejects invalid relationships before any canonical media insert', () => {
    const mediaInsert = finalizeUpload.indexOf('INSERT INTO public.media_items')
    expect(finalizeUpload.indexOf('Every tag must be non-empty text')).toBeLessThan(mediaInsert)
    expect(finalizeUpload.indexOf('owned_collection.user_id = v_user_id')).toBeLessThan(mediaInsert)
    expect(finalizeUpload.indexOf('Collection identifiers must be unique UUID strings.')).toBeLessThan(mediaInsert)
  })

  it('prevents required derivative failure from becoming a complete upload while preserving optional failure state', () => {
    expect(finalizeUpload).toContain("(derivative->>'required')::boolean = true AND derivative->>'status' <> 'ready'")
    expect(finalizeUpload).toContain('A required media derivative is not ready. The upload remains retryable.')
    expect(finalizeUpload).toContain("derivative_paths = EXCLUDED.derivative_paths")
  })

  it('keeps derivative retries from overwriting newer media edits or organization', () => {
    const retryBranch = finalizeUpload.slice(
      finalizeUpload.indexOf('Once a canonical row exists'),
      finalizeUpload.indexOf('Every tag must be non-empty text'),
    )
    expect(retryBranch).toContain("SET thumbnail_path = v_thumbnail_path, derivative_paths = COALESCE(p_derivative_paths, '[]'::jsonb)")
    expect(retryBranch).toContain('AND upload_operation_id = p_operation_id')
    expect(retryBranch).not.toContain('media_role =')
    expect(retryBranch).not.toContain('DELETE FROM public.media_item_tags')
    expect(retryBranch).not.toContain('DELETE FROM public.media_collection_items')
  })

  it('stores durable upload rollback jobs with exact paths and progress', () => {
    expect(sql).toContain("kind IN ('upload_rollback', 'media_deletion', 'derivative_cleanup')")
    expect(sql).toContain('storage_paths jsonb NOT NULL')
    expect(sql).toContain('completed_paths jsonb NOT NULL')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_media_upload_cleanup_pending')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.update_media_cleanup_job')
    expect(sql).toContain('A completed path is not part of this cleanup job.')
  })

  it('captures original, thumbnail, and derivative paths before tombstoning deletion', () => {
    expect(requestDeletion).toContain('v_paths := array_append(v_paths, v_media.storage_path)')
    expect(requestDeletion).toContain('v_media.thumbnail_path <> v_media.storage_path')
    expect(requestDeletion).toContain('public.media_paths_from_derivatives')
    expect(requestDeletion).toContain("'media_deletion', 'pending', v_paths_json")
    expect(requestDeletion).toContain("SET lifecycle_status = 'deletion_pending'")
  })

  it('does not destroy the canonical row until every exact storage path is complete', () => {
    const completenessCheck = finalizeDeletion.indexOf('Storage cleanup is incomplete')
    const deleteIndex = finalizeDeletion.indexOf('DELETE FROM public.media_items')
    expect(completenessCheck).toBeGreaterThanOrEqual(0)
    expect(completenessCheck).toBeLessThan(deleteIndex)
    expect(finalizeDeletion).toContain('WHERE id = v_media_id AND user_id = v_user_id')
  })

  it('prevents cross-user and traversal cleanup paths', () => {
    expect(sql).toContain("p_path LIKE p_user_id::text || '/%'")
    expect(sql).toContain("p_path !~ '(^|/)\\.\\.(/|$)'")
    expect(sql).toContain('Derivative metadata contains an invalid or foreign path')
    expect(requestDeletion).toContain('v_media.user_id IS DISTINCT FROM v_user_id')
  })

  it('keeps cleanup state user-scoped and RPC-only', () => {
    expect(sql).toContain('ALTER TABLE public.media_cleanup_jobs ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('USING (user_id = auth.uid())')
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.media_cleanup_jobs FROM authenticated')
    expect(sql).toContain('GRANT SELECT ON public.media_cleanup_jobs TO authenticated')
    expect(sql).not.toMatch(/service[_ -]?role[_ -]?key/i)
  })
})
