import { describe, expect, it } from 'vitest'
import migrationSql from '../../supabase/migrations/0015_lyric_persistence_transactions.sql?raw'

function compact(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

const sql = compact(migrationSql)

describe('0015 lyric persistence migration contract', () => {
  it('installs the verified cascade and set-null relationships', () => {
    expect(sql).toContain('FOREIGN KEY (audio_track_id) REFERENCES public.audio_tracks(id) ON DELETE CASCADE')
    expect(sql).toContain('FOREIGN KEY (visual_session_id) REFERENCES public.visual_sessions(id) ON DELETE SET NULL')
    expect(sql).toContain('FOREIGN KEY (lyric_document_id) REFERENCES public.lyric_documents(id) ON DELETE CASCADE')
  })

  it('preserves legacy rows before validating new relationships', () => {
    expect(sql).toContain('SET audio_track_id = NULL')
    expect(sql).toContain('t.user_id = d.user_id')
    expect(sql).toContain('SET visual_session_id = NULL')
    expect(sql).toContain('s.user_id = d.user_id')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1')
  })

  it('enforces one active version per user and persisted track', () => {
    expect(sql).toContain('PARTITION BY user_id, audio_track_id')
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_lyric_documents_one_active_per_track')
    expect(sql).toContain('WHERE is_active = true AND audio_track_id IS NOT NULL')
  })

  it('prevents concurrent activation from producing two active versions', () => {
    const activation = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.activate_lyric_document'),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.save_lyric_document_atomic'),
    )
    expect(activation).toContain('FROM public.audio_tracks AS track')
    expect(activation).toContain('FOR UPDATE')
    expect(activation).toContain('SET is_active = false')
    expect(activation).toContain('SET is_active = true')
  })

  it('keeps document updates and complete cue replacement in one rollback boundary', () => {
    const save = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.save_lyric_document_atomic'))
    expect(save).toContain('DELETE FROM public.lyric_cues')
    expect(save).toContain('INSERT INTO public.lyric_cues')
    expect(save).toContain('FROM jsonb_to_recordset(p_cues)')
    expect(save).toContain('EXCEPTION WHEN unique_violation')
    expect(save).toContain("'status', 'validation_failure'")
  })

  it('uses revision checks for optimistic concurrency', () => {
    expect(sql).toContain('NEW.revision := OLD.revision + 1')
    expect(sql).toContain('p_document_id IS NOT NULL AND p_expected_revision IS NULL')
    expect(sql).toContain('v_existing.revision <> p_expected_revision')
    expect(sql).toContain("'status', 'conflict'")
  })

  it('hardens ownership checks and security-definer search paths', () => {
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBe(2)
    expect(sql.match(/SET search_path = pg_catalog, public/g)?.length).toBeGreaterThanOrEqual(3)
    expect(sql).toContain('track.user_id = auth.uid()')
    expect(sql).toContain('session.user_id = auth.uid()')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.save_lyric_document_atomic')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.save_lyric_document_atomic')
  })
})
