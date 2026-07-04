-- Persist the full Music Intelligence payload so saved tracks can hydrate
-- trustworthy beat grids, downbeats, sections, and phrases without waiting for
-- a fresh browser analysis pass.

alter table public.track_analyses
  add column if not exists analysis_payload jsonb;

comment on column public.track_analyses.analysis_payload is
  'Full TrackIntelligenceAnalysis payload used by Lyric Manager and React timing tools to hydrate beat grids and sections for saved tracks.';

-- Existing RLS only allowed inserts. Upserted analysis payloads require updates
-- when a track is reanalyzed or its grid is rebuilt.
drop policy if exists "analyses: track owner update" on public.track_analyses;
create policy "analyses: track owner update" on public.track_analyses for update
  using (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));
