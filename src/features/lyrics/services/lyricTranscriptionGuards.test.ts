import { beforeEach, describe, expect, it, vi } from 'vitest'
import guardsMigrationSql from '../../../../supabase/migrations/0042_lyric_transcription_guards.sql?raw'
import edgeFunctionSource from '../../../../supabase/functions/lyric-transcription/index.ts?raw'

const calls: string[] = []
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: (...args: unknown[]) => mocks.limit(...args),
          }),
        }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}))

import { getRecentLyricTranscriptionJobs } from './lyricExtraction'

const sql = guardsMigrationSql.replace(/\s+/g, ' ').trim()

beforeEach(() => {
  calls.length = 0
  mocks.rpc.mockReset()
  mocks.limit.mockReset()
  mocks.rpc.mockImplementation(async () => { calls.push('sweep'); return { data: 0, error: null } })
  mocks.limit.mockImplementation(async () => { calls.push('list'); return { data: [], error: null } })
})

describe('stale AI transcription jobs', () => {
  it('are failed in the database before a track\'s jobs are listed, so the list is never stale', async () => {
    await expect(getRecentLyricTranscriptionJobs('track-1')).resolves.toEqual([])
    expect(mocks.rpc).toHaveBeenCalledWith('fail_stale_lyric_transcription_jobs')
    expect(calls).toEqual(['sweep', 'list'])
  })

  it('never stop the list loading when the sweep itself is unavailable', async () => {
    mocks.rpc.mockRejectedValue(new Error('function does not exist'))
    await expect(getRecentLyricTranscriptionJobs('track-1')).resolves.toEqual([])
    expect(mocks.limit).toHaveBeenCalledTimes(1)
  })

  it('are failed by the migration after 15 minutes untouched, retryably, and only for the calling user', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.fail_stale_lyric_transcription_jobs(p_user_id uuid DEFAULT NULL)')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = public')
    expect(sql).toContain('v_user_id uuid := COALESCE(auth.uid(), p_user_id)')
    expect(sql).toContain("status IN ('queued', 'processing')")
    expect(sql).toContain("updated_at < now() - interval '15 minutes'")
    expect(sql).toContain("SET status = 'failed'")
    expect(sql).toContain('WHERE user_id = v_user_id')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.fail_stale_lyric_transcription_jobs(uuid) FROM PUBLIC, anon')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.fail_stale_lyric_transcription_jobs(uuid) TO authenticated, service_role')
  })

  it('are swept by the edge function before it handles any action', () => {
    const handler = edgeFunctionSource.slice(edgeFunctionSource.indexOf('Deno.serve('))
    const auth = handler.indexOf('await authenticatedClients(req)')
    const sweep = handler.indexOf('await failStaleJobs(adminClient, userId)')
    const parse = handler.indexOf('await req.json()')
    expect(auth).toBeGreaterThanOrEqual(0)
    expect(sweep).toBeGreaterThan(auth)
    expect(parse).toBeGreaterThan(sweep)
    expect(edgeFunctionSource).toContain("adminClient.rpc('fail_stale_lyric_transcription_jobs', { p_user_id: userId })")
  })
})

describe('AI transcription daily limit', () => {
  it('is enforced by a before-insert trigger at 10 jobs per account per 24 hours, counted under a per-account lock', () => {
    expect(sql).toContain('v_limit CONSTANT integer := 10')
    expect(sql).toContain("created_at > now() - interval '24 hours'")
    expect(sql).toContain('WHERE user_id = NEW.user_id')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain("RAISE EXCEPTION 'lyric_transcription_daily_limit'")
    expect(sql).toContain('BEFORE INSERT ON public.lyric_transcription_jobs')
    expect(sql).toContain('FOR EACH ROW EXECUTE FUNCTION public.enforce_lyric_transcription_daily_limit()')
  })

  it('reaches the user as a clear 429 from the edge function instead of a generic failure', () => {
    expect(edgeFunctionSource).toContain("error.message?.includes('lyric_transcription_daily_limit')")
    expect(edgeFunctionSource).toContain("'daily_limit_reached'")
    expect(edgeFunctionSource).toContain('You have reached the limit of 10 AI lyric extractions in 24 hours. Try again later.')
    const mapped = edgeFunctionSource.indexOf("'daily_limit_reached'")
    expect(edgeFunctionSource.slice(mapped, mapped + 200)).toContain('429')
  })

  it('does not count a duplicate request, which returns the existing job before anything is inserted', () => {
    const create = edgeFunctionSource.slice(edgeFunctionSource.indexOf('async function createJob('), edgeFunctionSource.indexOf('async function updateJob('))
    expect(create.indexOf('if (existing) return { job: existing, duplicate: true }')).toBeLessThan(create.indexOf('.insert({'))
  })
})
