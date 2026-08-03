import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  reactState: {
    pixGridDecks: [{ id: 'deck-one' }],
    replacePixGridDeckProject: vi.fn(),
  },
  exportBundle: vi.fn(),
  importBundle: vi.fn(),
}))

vi.mock('../../../../../stores/reactStore', () => ({
  useReactStore: { getState: () => runtime.reactState },
}))
vi.mock('../PixGridDeckProjectMedia', () => ({
  exportPixGridDeckProjectMediaBundle: runtime.exportBundle,
  importPixGridDeckProjectMediaBundle: runtime.importBundle,
}))

import {
  exportCurrentPixGridDeckProjectMediaBundle,
  importPixGridDeckProjectMediaBundleIntoStore,
} from '../PixGridDeckProjectPortability'

describe('PixGrid Deck production portability adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtime.reactState.pixGridDecks = [{ id: 'deck-one' }]
  })

  it('exports the current project-owned Deck collection through the canonical media packager', async () => {
    const bundle = { manifest: { schemaVersion: 1, decks: [], sources: [], missingMediaIds: [], conflictingMediaIds: [] }, files: [] }
    runtime.exportBundle.mockResolvedValue(bundle)

    await expect(exportCurrentPixGridDeckProjectMediaBundle()).resolves.toBe(bundle)
    expect(runtime.exportBundle).toHaveBeenCalledWith(runtime.reactState.pixGridDecks, {})
  })

  it('restores media before atomically replacing the project Deck graph', async () => {
    const bundle = { manifest: { schemaVersion: 1, decks: [], sources: [], missingMediaIds: [], conflictingMediaIds: [] }, files: [] }
    const result = { decks: [{ id: 'deck-restored' }], mediaIdMap: {}, missingMediaIds: [], errors: [] }
    runtime.importBundle.mockResolvedValue(result)

    await expect(importPixGridDeckProjectMediaBundleIntoStore(bundle as never)).resolves.toBe(result)
    expect(runtime.importBundle).toHaveBeenCalledWith(bundle)
    expect(runtime.reactState.replacePixGridDeckProject).toHaveBeenCalledWith(result.decks)
  })
})
