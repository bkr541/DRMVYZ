import { describe, expect, it } from 'vitest'
import migrationSql from '../../supabase/migrations/0032_show_manager_cloud_persistence.sql?raw'

function compact(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

const sql = compact(migrationSql)
const saveBundle = sql.slice(
  sql.indexOf('CREATE OR REPLACE FUNCTION public.save_show_bundle'),
  sql.indexOf('CREATE OR REPLACE FUNCTION public.delete_show'),
)

describe('0032 Show Manager cloud persistence migration contract', () => {
  it('creates a user-owned Show registry and versioned Canvas/LaserDMX payload table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.shows')
    expect(sql).toContain('linked_audio_track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE RESTRICT')
    expect(sql).toContain('track_map jsonb NULL')
    expect(sql).toContain("engine_ids <@ ARRAY['pixGrid', 'laserDmx', 'canvas']::text[]")
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.show_engine_configs')
    expect(sql).toContain("engine_id IN ('canvas', 'laserDmx')")
    expect(sql).toContain('payload jsonb NOT NULL')
  })

  it('keeps direct mutations RPC-only and scopes reads to the authenticated Show owner', () => {
    expect(sql).toContain('ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE public.show_engine_configs ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('USING (auth.uid() = user_id)')
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.shows FROM anon, authenticated')
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.show_engine_configs FROM anon, authenticated')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.save_show_bundle(text, bigint, jsonb, jsonb) TO authenticated')
  })

  it('validates ownership, Track Map binding, engine payloads, and schema versions before mutating the Show', () => {
    const firstShowMutation = Math.min(
      saveBundle.indexOf('UPDATE public.shows'),
      saveBundle.indexOf('INSERT INTO public.shows'),
    )
    expect(saveBundle.indexOf("track.user_id = v_user_id")).toBeGreaterThanOrEqual(0)
    expect(saveBundle.indexOf("track.lifecycle_status = 'complete'")).toBeGreaterThanOrEqual(0)
    expect(saveBundle.indexOf("v_track_map->>'linkedAudioTrackId'")).toBeLessThan(firstShowMutation)
    expect(saveBundle.indexOf("config->>'engine_id' NOT IN ('canvas', 'laserDmx')")).toBeLessThan(firstShowMutation)
    expect(saveBundle.indexOf('Engine schema versions must be positive.')).toBeLessThan(firstShowMutation)
  })

  it('uses optimistic revision checks and atomically updates the shared Show plus engine payloads', () => {
    expect(saveBundle).toContain('v_existing.revision <> p_expected_revision')
    expect(saveBundle).toContain('v_next_revision := v_existing.revision + 1')
    expect(saveBundle).toContain('INSERT INTO public.show_engine_configs')
    expect(saveBundle).toContain('ON CONFLICT (show_id, engine_id) DO UPDATE')
    expect(saveBundle).toContain("'show', to_jsonb(v_saved)")
    expect(saveBundle).toContain("'engine_configs', v_configs")
  })

  it('indexes Canvas media dependencies and blocks audio/media deletion while a Show still references them', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.show_media_refs')
    expect(saveBundle).toContain("v_engine_payload->'mediaElements'")
    expect(saveBundle).toContain("v_media_element->>'mediaId'")
    expect(saveBundle).toContain('INSERT INTO public.show_media_refs')
    expect(sql).toContain('CREATE TRIGGER trg_audio_tracks_show_delete_guard')
    expect(sql).toContain('CREATE TRIGGER trg_media_items_show_delete_guard')
  })

  it('provides an ownership/revision-safe Show delete RPC with cascading Show-owned rows only', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.delete_show')
    expect(sql).toContain('This Show changed in another session. Reload the Show library before deleting it.')
    expect(sql).toContain('DELETE FROM public.shows')
    expect(sql).toContain('show_id text NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE')
  })
})
