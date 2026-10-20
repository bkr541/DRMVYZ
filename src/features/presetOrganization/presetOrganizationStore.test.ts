import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}))

vi.mock('./presetOrganizationDb', () => ({
  loadPresetOrganizations: dbMocks.load,
  savePresetOrganization: dbMocks.save,
}))

import { usePresetOrganizationStore } from './presetOrganizationStore'

beforeEach(() => {
  dbMocks.load.mockReset().mockResolvedValue({})
  dbMocks.save.mockReset().mockResolvedValue(true)
  usePresetOrganizationStore.setState({ records: {}, status: 'idle', error: null })
})

describe('preset organization store', () => {
  it('loads user-authored preset tags and collections independently', async () => {
    dbMocks.load.mockResolvedValue({
      'cinema2:afterhours': { tags: ['club'], collectionIds: ['collection-1'] },
    })

    await usePresetOrganizationStore.getState().load()

    expect(usePresetOrganizationStore.getState().records['cinema2:afterhours']).toEqual({
      tags: ['club'],
      collectionIds: ['collection-1'],
    })
  })

  it('optimistically updates and persists organization by preset key', async () => {
    const organization = { tags: ['laser'], collectionIds: ['collection-2'] }

    await expect(usePresetOrganizationStore.getState().update('cinema2:afterhours', organization)).resolves.toBe(true)

    expect(usePresetOrganizationStore.getState().records['cinema2:afterhours']).toEqual(organization)
    expect(dbMocks.save).toHaveBeenCalledWith('cinema2:afterhours', organization)
  })
})
