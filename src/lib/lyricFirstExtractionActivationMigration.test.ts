import { describe, expect, it } from 'vitest'
import migrationSql from '../../supabase/migrations/0028_lyric_first_extraction_activation.sql?raw'

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

const sql = compact(migrationSql)

describe('0028 first lyric extraction activation migration contract', () => {
  it('serializes extraction completion on the owned audio track before deciding activation', () => {
    expect(sql).toContain('from public.audio_tracks')
    expect(sql).toContain('where id = v_job.audio_track_id and user_id = v_user_id for update')
    expect(sql).toContain('v_should_activate := not exists')
    expect(sql).toContain('and is_active = true')
  })

  it('passes the atomic first-version decision into the existing lyric save transaction', () => {
    expect(sql).toContain('public.save_lyric_document_atomic( null, null, p_document, p_cues, v_should_activate )')
    expect(sql).toContain("jsonb_build_object('autoactivated', v_should_activate)")
    expect(sql).toContain("'auto_activated', v_should_activate")
  })

  it('preserves authenticated execution and does not weaken the one-active-version constraint', () => {
    expect(sql).toContain('security definer')
    expect(sql).toContain('revoke all on function public.complete_lyric_transcription_job')
    expect(sql).toContain('grant execute on function public.complete_lyric_transcription_job')
    expect(sql).not.toContain('drop index')
  })
})
