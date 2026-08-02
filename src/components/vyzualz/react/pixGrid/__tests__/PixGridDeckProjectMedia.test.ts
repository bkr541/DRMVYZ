// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UploadedMedia } from '../../../../../stores/mediaStore'
import type { PixGridDeckDefinition, PixGridDeckSourceSnapshot } from '../PixGridDeckDomain'

const runtime = vi.hoisted(() => ({
  state: {
    items: [] as UploadedMedia[],
    ensureMediaSigned: vi.fn(),
    uploadCanonicalVisualFile: vi.fn(),
  },
}))

vi.mock('../../../../../stores/mediaStore', () => ({
  MEDIA_BATCH_CONCURRENCY: 4,
  mapWithConcurrency: async <T, R>(
    values: readonly T[],
    _limit: number,
    worker: (value: T, index: number) => Promise<R>,
  ) => Promise.all(values.map((value, index) => worker(value, index))),
  useMediaStore: { getState: () => runtime.state },
}))

import {
  exportPixGridDeckProjectMediaBundle,
  importPixGridDeckProjectMediaBundle,
} from '../PixGridDeckProjectMedia'
import { validatePixGridDeckSourceFile } from '../PixGridDeckMediaValidation'

const fixtureRoot = new URL('../../../../../test/fixtures/pixGridDeck/', import.meta.url)

function fixture(name: string, type: string): File {
  return new File([readFileSync(new URL(name, fixtureRoot))], name, { type })
}

function media(id: string, file: File): UploadedMedia {
  return {
    id,
    dbId: id.replace(/^db-/, ''),
    name: file.name,
    type: 'image',
    url: `https://signed.example/${file.name}`,
    thumbnailUrl: null,
    meta: '2×2',
    favorite: false,
    mediaRole: 'other',
    tags: [],
    collectionIds: [],
    metadata: { width: 2, height: 2 },
    mimeType: file.type,
    storagePath: `user-1/${id}/${file.name}`,
    revision: 3,
    lifecycleStatus: 'complete',
  }
}

async function snapshot(file: File, transparentBackground = '#000000'): Promise<PixGridDeckSourceSnapshot> {
  const validated = await validatePixGridDeckSourceFile(file)
  if (!validated.ok) throw new Error(validated.error.message)
  return {
    mediaRevision: 3,
    fingerprint: validated.source.fingerprint,
    fileName: file.name,
    mimeType: validated.source.mimeType,
    width: validated.source.width,
    height: validated.source.height,
    hasAlpha: validated.source.hasAlpha,
    transparentBackground,
  }
}

async function deckFor(first: File, second: File): Promise<PixGridDeckDefinition> {
  return {
    schemaVersion: 1,
    id: 'deck-portable',
    name: 'Portable Deck',
    revision: 1,
    generatedPresetId: 'pix-grid-deck:deck-portable',
    items: [
      { id: 'item-one', mediaId: 'db-one', enabled: true, order: 0, revision: 1, timingOverrideBeats: null, source: await snapshot(first) },
      { id: 'item-two', mediaId: 'db-two', enabled: true, order: 1, revision: 1, timingOverrideBeats: null, source: await snapshot(second, '#123456') },
    ],
    configuration: {
      playbackOrder: 'forward',
      loop: true,
      reactionProfileId: null,
      transitionPolicy: { style: 'cut', durationBeats: 0 },
      defaultItemDurationBeats: 4,
      sectionTimingBeats: {},
      sectionItemAssignments: {},
      sceneItemAssignments: {},
      preDropBehavior: 'hold',
    },
  }
}

describe('PixGrid Deck project source-media portability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => (
      { width: 2, height: 2, close: vi.fn() } as unknown as ImageBitmap
    )))
    runtime.state.items = []
    runtime.state.ensureMediaSigned.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports normalized Deck definitions and canonical source files without compile caches or signed URLs', async () => {
    const first = fixture('opaque.png', 'image/png')
    const second = fixture('safe.svg', 'image/svg+xml')
    const deck = await deckFor(first, second)
    const items = [media('db-one', first), media('db-two', second)]

    const bundle = await exportPixGridDeckProjectMediaBundle([deck], {
      mediaItems: items,
      readSource: async item => item.id === 'db-one' ? first : second,
    })

    expect(bundle.manifest).toMatchObject({
      schemaVersion: 1,
      decks: [{ id: 'deck-portable', items: [{ mediaId: 'db-one' }, { mediaId: 'db-two' }] }],
      missingMediaIds: [],
    })
    expect(bundle.manifest.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ mediaId: 'db-one', databaseId: 'one', deckIds: ['deck-portable'] }),
      expect.objectContaining({ mediaId: 'db-two', databaseId: 'two', deckIds: ['deck-portable'] }),
    ]))
    expect(bundle.files.map(entry => entry.mediaId).sort()).toEqual(['db-one', 'db-two'])
    const serializedManifest = JSON.stringify(bundle.manifest)
    expect(serializedManifest).not.toContain('https://signed.example')
    expect(serializedManifest.toLowerCase()).not.toContain('compile')
    expect(serializedManifest).not.toContain('ImageBitmap')
  })


  it('does not package mutable media bytes when the canonical fingerprint no longer matches the Deck snapshot', async () => {
    const first = fixture('opaque.png', 'image/png')
    const second = fixture('safe.svg', 'image/svg+xml')
    const deck = await deckFor(first, second)
    const changed = media('db-one', first)
    changed.metadata = { ...changed.metadata, contentFingerprint: 'sha256:changed-source' }

    const bundle = await exportPixGridDeckProjectMediaBundle([deck], {
      mediaItems: [changed, media('db-two', second)],
      readSource: async item => item.id === 'db-one' ? first : second,
    })

    expect(bundle.manifest.conflictingMediaIds).toEqual(['db-one'])
    expect(bundle.manifest.missingMediaIds).toContain('db-one')
    expect(bundle.files.map(entry => entry.mediaId)).toEqual(['db-two'])
  })

  it('preserves per-Deck transparent backgrounds when shared source bytes are remapped', async () => {
    const first = fixture('opaque.png', 'image/png')
    const second = fixture('safe.svg', 'image/svg+xml')
    const deck = await deckFor(first, second)
    const sharedDeck: PixGridDeckDefinition = {
      ...structuredClone(deck),
      id: 'deck-portable-two',
      name: 'Portable Deck Two',
      generatedPresetId: 'pix-grid-deck:deck-portable-two',
      items: deck.items.map((item, index) => ({
        ...structuredClone(item),
        id: `shared-${index}`,
        source: { ...item.source, transparentBackground: index === 0 ? '#ABCDEF' : item.source.transparentBackground },
      })),
    }
    const exported = await exportPixGridDeckProjectMediaBundle([deck, sharedDeck], {
      mediaItems: [media('db-one', first), media('db-two', second)],
      readSource: async item => item.id === 'db-one' ? first : second,
    })
    runtime.state.uploadCanonicalVisualFile
      .mockResolvedValueOnce({ ok: true, item: { ...media('db-restored-one', first), revision: 9 } })
      .mockResolvedValueOnce({ ok: true, item: { ...media('db-restored-two', second), revision: 10 } })

    const restored = await importPixGridDeckProjectMediaBundle(exported)
    const firstBackground = restored.decks[0].items.find(item => item.mediaId === 'db-restored-one')?.source.transparentBackground
    const secondBackground = restored.decks[1].items.find(item => item.mediaId === 'db-restored-one')?.source.transparentBackground
    expect([firstBackground, secondBackground]).toEqual(['#000000', '#ABCDEF'])
  })

  it('reconnects restored media IDs and reports a missing source without dropping unrelated Deck items', async () => {
    const first = fixture('opaque.png', 'image/png')
    const second = fixture('safe.svg', 'image/svg+xml')
    const deck = await deckFor(first, second)
    const exported = await exportPixGridDeckProjectMediaBundle([deck], {
      mediaItems: [media('db-one', first), media('db-two', second)],
      readSource: async item => item.id === 'db-one' ? first : second,
    })
    runtime.state.uploadCanonicalVisualFile.mockResolvedValue({
      ok: true,
      item: { ...media('db-restored-one', first), revision: 9 },
    })

    const restored = await importPixGridDeckProjectMediaBundle({
      manifest: exported.manifest,
      files: exported.files.filter(entry => entry.mediaId === 'db-one'),
    })

    expect(restored.mediaIdMap).toEqual({ 'db-one': 'db-restored-one' })
    expect(restored.missingMediaIds).toEqual(['db-two'])
    expect(restored.decks[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({ mediaId: 'db-restored-one', source: expect.objectContaining({ mediaRevision: 9 }) }),
      expect.objectContaining({ mediaId: 'db-two', source: expect.objectContaining({ transparentBackground: '#123456' }) }),
    ]))
    expect(restored.decks[0].items).toHaveLength(2)
  })
})
