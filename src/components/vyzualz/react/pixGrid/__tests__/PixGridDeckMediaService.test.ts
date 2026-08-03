// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  mediaState: {
    items: [] as any[],
    uploadCanonicalVisualFile: vi.fn(),
    removeItem: vi.fn(),
  },
  reactState: {
    pixGridDecks: [] as any[],
    pixGridDeckProjectEpoch: 0,
    pixGridState: { matrixWidth: 160, matrixHeight: 90 },
    canvasEngineSettings: { mediaIds: [] as string[], selectedMediaId: null as string | null, manualMediaOverrideId: null as string | null },
    canvasMediaItems: [] as Array<{ id: string }>,
    selectedCanvasMediaId: null as string | null,
    activeCanvasMediaId: null as string | null,
    canvasOrchestrationSettings: { mediaPoolIds: [] as string[], mediaLocksByLayer: {} as Record<string, string> },
    createPixGridDeck: vi.fn(),
    updatePixGridDeck: vi.fn(),
  },
  preflight: vi.fn(),
  brandState: {
    activeKit: { palette: { background: '#112233', primary: '#445566' } },
  },
}))

vi.mock('../../../../../stores/mediaStore', () => ({
  MEDIA_BATCH_CONCURRENCY: 4,
  mapWithConcurrency: async <T, R>(values: readonly T[], _limit: number, worker: (value: T, index: number) => Promise<R>) => (
    Promise.all(values.map((value, index) => worker(value, index)))
  ),
  useMediaStore: { getState: () => runtime.mediaState },
}))
vi.mock('../../../../../stores/reactStore', () => ({
  useReactStore: { getState: () => runtime.reactState },
}))
vi.mock('../../../../../features/personalization/brandKitStore', () => ({
  useBrandKitStore: { getState: () => runtime.brandState },
}))
vi.mock('../PixGridDeckCompilerPreflight', () => ({
  preflightPixGridDeckSources: runtime.preflight,
}))

import { ingestPixGridDeckSourceFiles } from '../PixGridDeckMediaService'

const fixtureRoot = new URL('../../../../../test/fixtures/pixGridDeck/', import.meta.url)
function fixture(name: string, type: string): File {
  return new File([readFileSync(new URL(name, fixtureRoot))], name, { type })
}

function uploaded(id: string, name: string) {
  return {
    id, dbId: id.replace(/^db-/, ''), name, type: 'image' as const, url: 'https://signed.example/source',
    thumbnailUrl: null, meta: '2×2', favorite: false, mediaRole: 'other' as const, tags: [], collectionIds: [],
    metadata: {}, revision: 7,
  }
}

function deckItem(id: string, mediaId: string, order: number, enabled = true) {
  return {
    id,
    mediaId,
    enabled,
    order,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: 1,
      fingerprint: `sha256:${mediaId.padEnd(64, '0').slice(0, 64)}`,
      fileName: `${mediaId}.png`,
      mimeType: 'image/png',
      width: 2,
      height: 2,
      hasAlpha: false,
      transparentBackground: '#000000',
    },
  }
}

function existingDeck(id = 'deck-existing') {
  return {
    schemaVersion: 1,
    id,
    name: 'Existing Deck',
    revision: 3,
    generatedPresetId: `pix-grid-deck:${id}`,
    items: [
      deckItem('item-a', 'media-a', 0),
      deckItem('item-b', 'media-b', 1),
      deckItem('item-c', 'media-c', 2),
    ],
    configuration: {
      playbackOrder: 'forward',
      loop: true,
      reactionProfileId: 'balanced',
      transitionPolicy: { mode: 'auto', durationFraction: 0.25, pairOverrides: [], style: 'wipe', durationBeats: 1 },
      defaultItemDurationBeats: 4,
      sectionTimingBeats: {},
      sectionItemAssignments: {},
      sceneItemAssignments: {},
      preDropBehavior: 'hold',
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(resolver => { resolve = resolver })
  return { promise, resolve }
}

function queueUploads(...items: Array<ReturnType<typeof uploaded>>) {
  runtime.mediaState.uploadCanonicalVisualFile.mockReset()
  for (const item of items) runtime.mediaState.uploadCanonicalVisualFile.mockResolvedValueOnce({ ok: true, item })
}

describe('PixGrid Deck media ingestion service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => (
      { width: 2, height: 2, close: vi.fn() } as unknown as ImageBitmap
    )))
    runtime.reactState.pixGridDecks = []
    runtime.reactState.pixGridDeckProjectEpoch = 0
    runtime.reactState.canvasEngineSettings = { mediaIds: [], selectedMediaId: null, manualMediaOverrideId: null }
    runtime.reactState.canvasMediaItems = []
    runtime.reactState.selectedCanvasMediaId = null
    runtime.reactState.activeCanvasMediaId = null
    runtime.reactState.canvasOrchestrationSettings = { mediaPoolIds: [], mediaLocksByLayer: {} }
    runtime.brandState.activeKit = { palette: { background: '#112233', primary: '#445566' } }
    runtime.mediaState.items = []
    runtime.mediaState.removeItem.mockResolvedValue(true)
    runtime.preflight.mockImplementation(async (entries: Array<{ item: { id: string } }>) => ({
      acceptedItemIds: entries.map(entry => entry.item.id),
      rejected: [],
    }))
    runtime.reactState.pixGridState = { matrixWidth: 160, matrixHeight: 90 }
    queueUploads(uploaded('db-one', 'opaque.png'), uploaded('db-two', 'safe.svg'))
    runtime.reactState.createPixGridDeck.mockImplementation((input: any) => {
      runtime.reactState.pixGridDecks.push({ ...existingDeck(input.id ?? 'deck-new'), name: input.name, items: input.items })
      return { ok: true, deckId: input.id ?? 'deck-new' }
    })
    runtime.reactState.updatePixGridDeck.mockImplementation((deckId: string, patch: any) => {
      const index = runtime.reactState.pixGridDecks.findIndex((deck: any) => deck.id === deckId)
      if (index < 0) return { ok: false, error: { code: 'deck-not-found', message: 'Deck missing.' } }
      runtime.reactState.pixGridDecks[index] = {
        ...runtime.reactState.pixGridDecks[index],
        ...patch,
        revision: runtime.reactState.pixGridDecks[index].revision + 1,
      }
      return { ok: true, deckId }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects a batch containing no valid source before media upload or project mutation', async () => {
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', name: 'Rejected' },
      files: [new File(['GIF89a'], 'bad.gif', { type: 'image/gif' })],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'unsupported-format', fileName: 'bad.gif' } })
    expect(runtime.mediaState.uploadCanonicalVisualFile).not.toHaveBeenCalled()
    expect(runtime.reactState.createPixGridDeck).not.toHaveBeenCalled()
  })

  it('partially accepts valid files while reporting validation failures', async () => {
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', id: 'deck-new', name: 'Partial validation' },
      files: [
        fixture('opaque.png', 'image/png'),
        new File(['GIF89a'], 'bad.gif', { type: 'image/gif' }),
        fixture('safe.svg', 'image/svg+xml'),
      ],
    })
    expect(result).toMatchObject({
      ok: true,
      deckId: 'deck-new',
      mediaIds: ['db-one', 'db-two'],
      rejected: [{ fileName: 'bad.gif' }],
    })
    expect(runtime.mediaState.uploadCanonicalVisualFile).toHaveBeenCalledTimes(2)
  })

  it('uploads through mediaStore and commits stable source snapshots in one Deck action', async () => {
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', id: 'deck-new', name: 'My Deck' },
      files: [fixture('opaque.png', 'image/png'), fixture('safe.svg', 'image/svg+xml')],
    })
    expect(result).toEqual({ ok: true, deckId: 'deck-new', mediaIds: ['db-one', 'db-two'] })
    const input = runtime.reactState.createPixGridDeck.mock.calls[0][0]
    expect(input.items).toHaveLength(2)
    expect(input.items[0]).toMatchObject({
      mediaId: 'db-one', source: { mediaRevision: 7, mimeType: 'image/png', hasAlpha: false, transparentBackground: '#000000' },
    })
    expect(input.items[1]).toMatchObject({
      mediaId: 'db-two', source: { mediaRevision: 7, mimeType: 'image/svg+xml', hasAlpha: true, transparentBackground: '#112233' },
    })
    expect(input.items[0].source.fingerprint).toMatch(/^sha256:/)
  })

  it('cancels after finalized uploads without committing a Deck and cleans canonical media', async () => {
    const controller = new AbortController()
    runtime.mediaState.uploadCanonicalVisualFile
      .mockReset()
      .mockImplementationOnce(async () => {
        controller.abort()
        return { ok: true, item: uploaded('db-one', 'opaque.png') }
      })
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', name: 'Cancelled' },
      files: [fixture('opaque.png', 'image/png'), fixture('safe.svg', 'image/svg+xml')],
      signal: controller.signal,
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    expect(runtime.mediaState.removeItem).toHaveBeenCalledWith('db-one')
    expect(runtime.reactState.createPixGridDeck).not.toHaveBeenCalled()
  })

  it('removes a failed new image while preserving compiled successes', async () => {
    queueUploads(
      uploaded('db-one', 'opaque.png'),
      uploaded('db-two', 'safe.svg'),
      uploaded('db-three', 'transparent.png'),
    )
    runtime.preflight.mockImplementationOnce(async (entries: Array<{ item: { id: string; mediaId: string } }>) => ({
      acceptedItemIds: [entries[0].item.id, entries[2].item.id],
      rejected: [{
        itemId: entries[1].item.id,
        mediaId: entries[1].item.mediaId,
        error: { code: 'decode-failed', message: 'The SVG could not be decoded.', retryable: false },
      }],
    }))
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', id: 'deck-new', name: 'Partial Deck' },
      files: [fixture('opaque.png', 'image/png'), fixture('safe.svg', 'image/svg+xml'), fixture('transparent.png', 'image/png')],
    })
    expect(result).toMatchObject({
      ok: true,
      mediaIds: ['db-one', 'db-three'],
      rejected: [{ fileName: 'safe.svg', message: 'The SVG could not be decoded.' }],
    })
    expect(runtime.mediaState.removeItem).toHaveBeenCalledWith('db-two')
  })

  it('merges into the latest Deck and preserves reorder, enablement, removal, rename, and settings edits', async () => {
    const original = existingDeck()
    runtime.reactState.pixGridDecks = [original]
    queueUploads(uploaded('db-new', 'opaque.png'))
    const gate = deferred<{ acceptedItemIds: string[]; rejected: never[] }>()
    runtime.preflight.mockImplementationOnce(async (entries: Array<{ item: { id: string } }>) => {
      const result = await gate.promise
      return { ...result, acceptedItemIds: entries.map(entry => entry.item.id) }
    })

    const pending = ingestPixGridDeckSourceFiles({
      target: { kind: 'append', deckId: original.id },
      files: [fixture('opaque.png', 'image/png')],
    })
    await vi.waitFor(() => expect(runtime.preflight).toHaveBeenCalledTimes(1))

    runtime.reactState.pixGridDecks = [{
      ...original,
      name: 'Renamed during upload',
      revision: 8,
      configuration: { ...original.configuration, loop: false },
      items: [
        { ...original.items[2], order: 0, enabled: false },
        { ...original.items[0], order: 1 },
      ],
    }]
    gate.resolve({ acceptedItemIds: [], rejected: [] })

    const result = await pending
    expect(result).toMatchObject({ ok: true, deckId: original.id, mediaIds: ['db-new'] })
    expect(runtime.reactState.updatePixGridDeck).toHaveBeenCalledTimes(1)
    const latest = runtime.reactState.pixGridDecks[0]
    expect(latest.name).toBe('Renamed during upload')
    expect(latest.configuration.loop).toBe(false)
    expect(latest.items.map((item: any) => [item.id, item.enabled, item.order])).toEqual([
      ['item-c', false, 0],
      ['item-a', true, 1],
      [expect.any(String), true, 2],
    ])
    expect(latest.items.some((item: any) => item.id === 'item-b')).toBe(false)
  })

  it('does not resurrect a Deck deleted while preflight is pending', async () => {
    const original = existingDeck()
    runtime.reactState.pixGridDecks = [original]
    queueUploads(uploaded('db-new', 'opaque.png'))
    const gate = deferred<void>()
    runtime.preflight.mockImplementationOnce(async (entries: Array<{ item: { id: string } }>) => {
      await gate.promise
      return { acceptedItemIds: entries.map(entry => entry.item.id), rejected: [] }
    })

    const pending = ingestPixGridDeckSourceFiles({
      target: { kind: 'append', deckId: original.id },
      files: [fixture('opaque.png', 'image/png')],
    })
    await vi.waitFor(() => expect(runtime.preflight).toHaveBeenCalledTimes(1))
    runtime.reactState.pixGridDecks = []
    gate.resolve()

    expect(await pending).toMatchObject({ ok: false, error: { code: 'deck-not-found' } })
    expect(runtime.reactState.updatePixGridDeck).not.toHaveBeenCalled()
    expect(runtime.mediaState.removeItem).toHaveBeenCalledWith('db-new')
  })

  it('rejects a late commit after whole-project replacement', async () => {
    const original = existingDeck()
    runtime.reactState.pixGridDecks = [original]
    queueUploads(uploaded('db-new', 'opaque.png'))
    const gate = deferred<void>()
    runtime.preflight.mockImplementationOnce(async (entries: Array<{ item: { id: string } }>) => {
      await gate.promise
      return { acceptedItemIds: entries.map(entry => entry.item.id), rejected: [] }
    })

    const pending = ingestPixGridDeckSourceFiles({
      target: { kind: 'append', deckId: original.id },
      files: [fixture('opaque.png', 'image/png')],
    })
    await vi.waitFor(() => expect(runtime.preflight).toHaveBeenCalledTimes(1))
    runtime.reactState.pixGridDeckProjectEpoch += 1
    runtime.reactState.pixGridDecks = [existingDeck('same-id-in-new-project')]
    gate.resolve()

    expect(await pending).toMatchObject({ ok: false, error: { code: 'project-replaced' } })
    expect(runtime.reactState.updatePixGridDeck).not.toHaveBeenCalled()
    expect(runtime.mediaState.removeItem).toHaveBeenCalledWith('db-new')
  })

  it('serializes overlapping completions against the latest Deck without losing the first append', async () => {
    const original = existingDeck()
    runtime.reactState.pixGridDecks = [original]
    queueUploads(uploaded('db-first', 'opaque.png'), uploaded('db-second', 'safe.svg'))
    const gates = [deferred<void>(), deferred<void>()]
    let preflightIndex = 0
    runtime.preflight.mockImplementation(async (entries: Array<{ item: { id: string } }>) => {
      const current = preflightIndex++
      await gates[current].promise
      return { acceptedItemIds: entries.map(entry => entry.item.id), rejected: [] }
    })

    const first = ingestPixGridDeckSourceFiles({
      target: { kind: 'append', deckId: original.id },
      files: [fixture('opaque.png', 'image/png')],
    })
    const second = ingestPixGridDeckSourceFiles({
      target: { kind: 'append', deckId: original.id },
      files: [fixture('safe.svg', 'image/svg+xml')],
    })
    await vi.waitFor(() => expect(runtime.preflight).toHaveBeenCalledTimes(1))
    gates[0].resolve()
    expect(await first).toMatchObject({ ok: true, mediaIds: ['db-first'] })
    await vi.waitFor(() => expect(runtime.preflight).toHaveBeenCalledTimes(2))
    gates[1].resolve()
    expect(await second).toMatchObject({ ok: true, mediaIds: ['db-second'] })

    expect(runtime.reactState.pixGridDecks[0].items.map((item: any) => item.mediaId)).toEqual([
      'media-a', 'media-b', 'media-c', 'db-first', 'db-second',
    ])
  })

  it('does not delete canonical media adopted by Canvas during rollback', async () => {
    const original = existingDeck()
    runtime.reactState.pixGridDecks = [original]
    queueUploads(uploaded('shared-canvas-media', 'opaque.png'))
    const gate = deferred<void>()
    runtime.preflight.mockImplementationOnce(async (entries: Array<{ item: { id: string } }>) => {
      await gate.promise
      return { acceptedItemIds: entries.map(entry => entry.item.id), rejected: [] }
    })

    const pending = ingestPixGridDeckSourceFiles({
      target: { kind: 'append', deckId: original.id },
      files: [fixture('opaque.png', 'image/png')],
    })
    await vi.waitFor(() => expect(runtime.preflight).toHaveBeenCalledTimes(1))
    runtime.reactState.pixGridDecks = []
    runtime.reactState.canvasEngineSettings.mediaIds = ['shared-canvas-media']
    gate.resolve()

    expect(await pending).toMatchObject({ ok: false, error: { code: 'deck-not-found' } })
    expect(runtime.mediaState.removeItem).not.toHaveBeenCalledWith('shared-canvas-media')
  })

  it('does not delete canonical media adopted by another Deck during rollback', async () => {
    const original = existingDeck()
    runtime.reactState.pixGridDecks = [original]
    queueUploads(uploaded('shared-media', 'opaque.png'))
    const gate = deferred<void>()
    runtime.preflight.mockImplementationOnce(async (entries: Array<{ item: { id: string } }>) => {
      await gate.promise
      return { acceptedItemIds: entries.map(entry => entry.item.id), rejected: [] }
    })

    const pending = ingestPixGridDeckSourceFiles({
      target: { kind: 'append', deckId: original.id },
      files: [fixture('opaque.png', 'image/png')],
    })
    await vi.waitFor(() => expect(runtime.preflight).toHaveBeenCalledTimes(1))
    runtime.reactState.pixGridDecks = [{
      ...existingDeck('other-deck'),
      items: [deckItem('shared-item', 'shared-media', 0), deckItem('other-item', 'other-media', 1)],
    }]
    gate.resolve()

    expect(await pending).toMatchObject({ ok: false, error: { code: 'deck-not-found' } })
    expect(runtime.mediaState.removeItem).not.toHaveBeenCalledWith('shared-media')
  })

  it('rolls back canonical uploads when the Deck mutation rejects the commit', async () => {
    runtime.reactState.createPixGridDeck.mockReturnValueOnce({
      ok: false,
      error: { code: 'duplicate-name', message: 'A PixGrid Deck named "My Deck" already exists.', path: 'name' },
    })
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', name: 'My Deck' },
      files: [fixture('opaque.png', 'image/png'), fixture('safe.svg', 'image/svg+xml')],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'deck-mutation-failed', deckError: { code: 'duplicate-name' } } })
    expect(runtime.mediaState.removeItem).toHaveBeenCalledTimes(2)
  })
})
