import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasShowManagerShow } from '../components/vyzualz/showManager/CanvasShowManagerDomain'
import type { ShowManagerShowRecord } from '../components/vyzualz/showManager/ShowManagerDomain'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  },
}))

import { saveShowManagerCloudBundle } from './showManagerDb'

const show: ShowManagerShowRecord = {
  schemaVersion: 2,
  id: 'show-manager-show-test',
  name: 'Cloud Show',
  linkedAudioTrackId: '11111111-1111-4111-8111-111111111111',
  tags: ['Festival'],
  groupId: null,
  engineIds: ['canvas'],
  trackMap: null,
}

const canvas: CanvasShowManagerShow = {
  schemaVersion: 4,
  id: show.id,
  name: show.name,
  sections: [],
  mediaElements: [],
}

describe('Show Manager Supabase repository', () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.rpc.mockReset()
  })

  it('saves the shared Show and Canvas payload through one transactional RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        status: 'success',
        show: {
          id: show.id,
          user_id: 'user-1',
          name: show.name,
          linked_audio_track_id: show.linkedAudioTrackId,
          tags: show.tags,
          group_id: null,
          engine_ids: show.engineIds,
          track_map: null,
          schema_version: 2,
          revision: 3,
          created_at: '2026-08-11T00:00:00.000Z',
          updated_at: '2026-08-11T00:00:00.000Z',
        },
        engine_configs: [{
          show_id: show.id,
          engine_id: 'canvas',
          schema_version: 4,
          payload: canvas,
          revision: 3,
          created_at: '2026-08-11T00:00:00.000Z',
          updated_at: '2026-08-11T00:00:00.000Z',
        }],
      },
      error: null,
    })

    const result = await saveShowManagerCloudBundle({ show, canvas, laserDmx: null }, 2)

    expect(result).toEqual(expect.objectContaining({ ok: true, mode: 'cloud' }))
    if (result.ok && result.mode === 'cloud') expect(result.bundle.revision).toBe(3)
    expect(mocks.rpc).toHaveBeenCalledWith('save_show_bundle', {
      p_show_id: show.id,
      p_expected_revision: 2,
      p_show: {
        name: show.name,
        linked_audio_track_id: show.linkedAudioTrackId,
        tags: show.tags,
        group_id: null,
        engine_ids: ['canvas'],
        track_map: null,
        schema_version: 2,
      },
      p_engine_configs: [{
        engine_id: 'canvas',
        schema_version: 4,
        payload: canvas,
      }],
    })
  })

  it('surfaces optimistic-concurrency conflicts returned by Supabase', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        status: 'conflict',
        message: 'This Show changed in another session.',
        current_revision: 9,
      },
      error: null,
    })

    const result = await saveShowManagerCloudBundle({ show, canvas, laserDmx: null }, 8)

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      kind: 'conflict',
      currentRevision: 9,
    }))
  })
})
