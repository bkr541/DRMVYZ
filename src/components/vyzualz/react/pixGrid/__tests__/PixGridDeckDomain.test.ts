import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PIX_GRID_DECK_CONFIGURATION,
  PIX_GRID_DECK_FRAME_SOURCE_KIND,
  PIX_GRID_DECK_GENERATED_PRESET_ID_PREFIX,
  PIX_GRID_DECK_MAX_ITEMS,
  PIX_GRID_DECK_MIN_ITEMS,
  PIX_GRID_DECK_PATTERN_ID,
  PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
  PIX_GRID_DECK_SCHEMA_VERSION,
  createPixGridDeckDraft,
  generatedPixGridDeckPresetId,
  normalizePixGridDeckCollectionDetailed,
  normalizePixGridDeckDefinition,
  normalizePixGridDeckName,
} from '../PixGridDeckDomain'

function items(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    mediaId: `media-${index + 1}`,
    enabled: index % 2 === 0,
    order: count - index,
    revision: index + 1,
    timingOverrideBeats: index === 0 ? 2 : null,
  }))
}

describe('PixGrid Deck domain normalization', () => {
  it('exposes the stable Stage 1 identifier contract', () => {
    expect(PIX_GRID_DECK_SCHEMA_VERSION).toBe(1)
    expect(PIX_GRID_DECK_GENERATED_PRESET_ID_PREFIX).toBe('pix-grid-deck:')
    expect(PIX_GRID_DECK_PATTERN_ID).toBe('mediaDeck')
    expect(PIX_GRID_DECK_FRAME_SOURCE_KIND).toBe('deck')
    expect(PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID).toBe('pix-grid-media-deck-performance')
    expect(PIX_GRID_DECK_MIN_ITEMS).toBe(2)
    expect(PIX_GRID_DECK_MAX_ITEMS).toBe(12)
  })

  it('normalizes names, ordering, revisions, defaults, and generated preset identity', () => {
    const result = normalizePixGridDeckDefinition({
      schemaVersion: 1,
      id: 'deck-stable',
      name: '   Deck    Alpha   ',
      revision: -4,
      generatedPresetId: 'stale-name-derived-preset',
      items: items(3),
      configuration: {
        playbackOrder: 'not-real',
        reactionProfileId: ' profile-1 ',
        transitionPolicy: { style: 'crossfade', durationBeats: Number.NaN },
        defaultItemDurationBeats: -20,
        sectionTimingBeats: { intro: 8, drop: Number.NaN, bogus: 4 },
        sectionItemAssignments: {
          intro: ['item-2', 'missing', 'item-2', 'item-1'],
        },
        sceneItemAssignments: {
          'scene-1': ['item-1', 'missing', 'item-3', 'item-1'],
        },
        preDropBehavior: 'accelerate',
      },
    })

    expect(result.deck).toMatchObject({
      schemaVersion: 1,
      id: 'deck-stable',
      name: 'Deck Alpha',
      revision: 1,
      generatedPresetId: 'pix-grid-deck:deck-stable',
      configuration: {
        playbackOrder: DEFAULT_PIX_GRID_DECK_CONFIGURATION.playbackOrder,
        reactionProfileId: 'profile-1',
        transitionPolicy: {
          mode: 'crossfade',
          durationFraction: 0.75,
          pairOverrides: [],
          style: 'crossfade',
          durationBeats: 0.1875,
        },
        defaultItemDurationBeats: 0.25,
        sectionTimingBeats: { intro: 8 },
        sectionItemAssignments: { intro: ['item-2', 'item-1'] },
        sceneItemAssignments: { 'scene-1': ['item-1', 'item-3'] },
        loop: true,
        preDropBehavior: 'continue',
      },
    })
    expect(result.deck?.items.map(item => item.id)).toEqual(['item-3', 'item-2', 'item-1'])
    expect(result.deck?.items.map(item => item.order)).toEqual([0, 1, 2])
    expect(generatedPixGridDeckPresetId('deck-stable')).toBe('pix-grid-deck:deck-stable')
    expect(normalizePixGridDeckName(` ${'A'.repeat(100)} `)).toHaveLength(80)
  })

  it.each([
    ['inherit', 'hold'],
    ['accelerate', 'continue'],
    ['blackout', 'dim'],
  ] as const)('migrates the provisional %s PreDrop value to %s', (legacy, expected) => {
    const result = normalizePixGridDeckDefinition({
      id: `legacy-${legacy}`,
      name: `Legacy ${legacy}`,
      items: items(2),
      configuration: { preDropBehavior: legacy },
    })
    expect(result.deck?.configuration.preDropBehavior).toBe(expected)
  })

  it('preserves the pre-Stage-5 hard-cut default when a saved Deck has no transition policy', () => {
    const result = normalizePixGridDeckDefinition({
      id: 'legacy-no-transition',
      name: 'Legacy no transition',
      items: items(2),
      configuration: { playbackOrder: 'forward' },
    })
    expect(result.deck?.configuration.transitionPolicy).toMatchObject({
      mode: 'hardCut',
      durationFraction: 0,
      style: 'cut',
      durationBeats: 0,
    })
  })

  it('repairs deterministic legacy aliases without inventing random migration IDs', () => {
    const legacy = {
      deckId: 'legacy-deck',
      title: ' Legacy ',
      images: [
        { imageId: 'media-a', order: 2, durationBeats: 4 },
        { imageId: 'media-b', order: 1, durationBeats: -3 },
      ],
      config: { playbackOrder: 'reverse' },
      compiledFrames: new Uint8Array([1, 2, 3]),
      objectUrl: 'blob:runtime-only',
    }
    const first = normalizePixGridDeckDefinition(legacy)
    const second = normalizePixGridDeckDefinition(legacy)

    expect(first).toEqual(second)
    expect(first.deck?.items.map(item => item.mediaId)).toEqual(['media-b', 'media-a'])
    expect(first.deck?.items.every(item => item.id.startsWith('deck-item:'))).toBe(true)
    expect(first.deck).not.toHaveProperty('compiledFrames')
    expect(first.deck).not.toHaveProperty('objectUrl')
  })

  it.each([1, 13])('rejects committed Decks with %s items', (count: number) => {
    const result = normalizePixGridDeckDefinition({ id: `deck-${count}`, name: 'Bounds', items: items(count) })
    expect(result.deck).toBeNull()
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-item-count', severity: 'rejected' }),
    ]))
  })

  it('rejects missing item arrays, unknown schemas, and duplicate item or media IDs', () => {
    expect(normalizePixGridDeckDefinition({ id: 'missing-items', name: 'Missing items' }).issues)
      .toEqual([expect.objectContaining({ code: 'invalid-item-count', severity: 'rejected' })])

    expect(normalizePixGridDeckDefinition({
      schemaVersion: 99,
      id: 'future-deck',
      name: 'Future',
      items: items(2),
    }).deck).toBeNull()

    const duplicateItem = items(2)
    duplicateItem[1]!.id = duplicateItem[0]!.id
    expect(normalizePixGridDeckDefinition({ id: 'duplicate-item', name: 'Duplicate item', items: duplicateItem }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate-item-id' })]))

    const duplicateMedia = items(2)
    duplicateMedia[1]!.mediaId = duplicateMedia[0]!.mediaId
    expect(normalizePixGridDeckDefinition({ id: 'duplicate-media', name: 'Duplicate media', items: duplicateMedia }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate-media-id' })]))
  })

  it('keeps the first deterministic collection entry and quarantines duplicate names', () => {
    const normalized = normalizePixGridDeckCollectionDetailed([
      { id: 'deck-a', name: 'Deck A', items: items(2) },
      { id: 'deck-b', name: '  deck a  ', items: items(2).map((item, index) => ({ ...item, id: `b-${index}`, mediaId: `b-media-${index}` })) },
      { id: 'deck-c', name: 'Deck C', items: items(1) },
    ])

    expect(normalized.decks.map(deck => deck.id)).toEqual(['deck-a'])
    expect(normalized.rejected).toEqual([
      expect.objectContaining({ id: 'deck-b', issues: [expect.objectContaining({ code: 'duplicate-name' })] }),
      expect.objectContaining({ id: 'deck-c', issues: [expect.objectContaining({ code: 'invalid-item-count' })] }),
    ])
  })

  it('allows an incomplete transient draft without weakening committed validation', () => {
    const draft = createPixGridDeckDraft(' New Deck ')
    expect(draft.name).toBe('New Deck')
    expect(draft.configuration.transitionPolicy).toMatchObject({ mode: 'auto', durationFraction: 0.25 })
    expect(draft.items).toEqual([])
    draft.items.push({ mediaId: 'draft-media-1' })
    expect(draft.items).toHaveLength(1)
    expect(normalizePixGridDeckDefinition(draft).deck).toBeNull()
  })
})
