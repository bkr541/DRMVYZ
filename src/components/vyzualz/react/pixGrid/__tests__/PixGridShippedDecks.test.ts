import { describe, expect, it } from 'vitest'
import { materializePixGridSequenceDeck, createPixGridSequenceBundledIndex, pixGridSequenceSourceMediaId } from '../PixGridSequenceDefinition'
import {
  loadPixGridShippedDeckManifests,
  pixGridShippedDeckToSequence,
  pixGridShippedPresetId,
  PIX_GRID_SHIPPED_DECK_ERRORS,
  PIX_GRID_SHIPPED_DECKS,
  validatePixGridShippedDeckManifest,
  type PixGridShippedDeckManifest,
} from '../PixGridShippedDecks'

const fingerprint = (character: string) => `sha256:${character.repeat(64)}`

function manifest(overrides: Partial<PixGridShippedDeckManifest> = {}): PixGridShippedDeckManifest {
  return {
    schemaVersion: 1, slug: 'neon-set', name: 'Neon Set', revision: 1,
    sources: [
      { id: 'source-01', path: 'pixgrid-decks/neon-set/01.webp', mimeType: 'image/webp', fileName: 'one.webp', width: 512, height: 288, hasAlpha: false, fingerprint: fingerprint('a') },
      { id: 'source-02', path: 'pixgrid-decks/neon-set/02.png', mimeType: 'image/png', fileName: 'two.png', width: 400, height: 400, hasAlpha: true, fingerprint: fingerprint('b') },
    ],
    items: [{ id: 'item-a', sourceId: 'source-01' }, { id: 'item-b', sourceId: 'source-02', durationBeats: 8 }, { id: 'item-c', sourceId: 'source-01', enabled: false }],
    configuration: { playbackOrder: 'pingPong', loop: false, defaultItemDurationBeats: 2, reactionProfileId: 'highEnergy', preDropBehavior: 'dim', motionProfileId: 'flow' },
    ...overrides,
  }
}

describe('shipped PixGrid Deck manifests', () => {
  it('accepts a well-formed manifest and explains the first problem in a bad one', () => {
    expect(validatePixGridShippedDeckManifest(manifest())).toMatchObject({ ok: true })
    const bad = (patch: Record<string, unknown>) => validatePixGridShippedDeckManifest({ ...manifest(), ...patch })
    expect(bad({ slug: 'Neon Set' })).toMatchObject({ ok: false, error: expect.stringContaining('slug') })
    expect(bad({ schemaVersion: 9 })).toMatchObject({ ok: false })
    expect(bad({ items: [{ id: 'only', sourceId: 'source-01' }] })).toMatchObject({ ok: false, error: expect.stringContaining('2 to') })
    expect(bad({ items: [{ id: 'a', sourceId: 'missing' }, { id: 'b', sourceId: 'source-01' }] })).toMatchObject({ ok: false, error: expect.stringContaining('unknown source') })
    expect(bad({ sources: [{ ...manifest().sources[0], path: 'pixgrid-decks/other/01.webp' }, manifest().sources[1]] })).toMatchObject({ ok: false, error: expect.stringContaining('under pixgrid-decks/neon-set/') })
    expect(bad({ sources: [{ ...manifest().sources[0], path: 'pixgrid-decks/neon-set/../x.webp' }, manifest().sources[1]] })).toMatchObject({ ok: false })
    expect(bad({ sources: [{ ...manifest().sources[0], mimeType: 'image/gif' }, manifest().sources[1]] })).toMatchObject({ ok: false, error: expect.stringContaining('unsupported type') })
    expect(bad({ sources: [{ ...manifest().sources[0], fingerprint: 'abc' }, manifest().sources[1]] })).toMatchObject({ ok: false, error: expect.stringContaining('fingerprint') })
  })

  it('keeps the valid files, reports the invalid and duplicate ones by name, and starts with none shipped', () => {
    const result = loadPixGridShippedDeckManifests({
      './shippedDecks/b.json': manifest({ slug: 'second', sources: manifest().sources.map(source => ({ ...source, path: source.path.replace('neon-set', 'second') })) }),
      './shippedDecks/a.json': manifest(),
      './shippedDecks/c.json': manifest(),
      './shippedDecks/d.json': { nonsense: true },
    })
    expect(result.manifests.map(entry => entry.slug)).toEqual(['neon-set', 'second'])
    expect(result.errors.map(error => error.file)).toEqual(['./shippedDecks/c.json', './shippedDecks/d.json'])
    expect(result.errors[0]!.error).toContain('already used')
    expect(PIX_GRID_SHIPPED_DECKS).toEqual([])
    expect(PIX_GRID_SHIPPED_DECK_ERRORS).toEqual([])
  })

  it('becomes a sequence of bundled sources that the Deck pipeline materializes like any Deck', () => {
    const sequence = pixGridShippedDeckToSequence(manifest())
    expect(sequence).toMatchObject({ id: 'shipped-neon-set', name: 'Neon Set', playbackOrder: 'pingPong', loop: false, reactionProfileId: 'highEnergy', preDropBehavior: 'dim' })
    expect(sequence.sources.every(source => source.kind === 'bundled')).toBe(true)
    const deck = materializePixGridSequenceDeck(sequence, pixGridShippedPresetId('neon-set'))
    expect(deck).toMatchObject({ id: 'pix-grid-sequence:shipped-neon-set', generatedPresetId: 'pix-grid-shipped-neon-set', presetCreated: true })
    expect(deck.items.map(item => [item.id, item.enabled, item.timingOverrideBeats])).toEqual([['item-a', true, null], ['item-b', true, 8], ['item-c', false, null]])
    expect(deck.items[0]!.source).toMatchObject({ fingerprint: fingerprint('a'), mimeType: 'image/webp', width: 512 })
    expect(deck.items[0]!.mediaId).toBe(pixGridSequenceSourceMediaId('shipped-neon-set', 'source-01'))
    expect(deck.items[0]!.mediaId).toBe(deck.items[2]!.mediaId)
    expect(deck.configuration).toMatchObject({ playbackOrder: 'pingPong', loop: false, reactionProfileId: 'highEnergy', preDropBehavior: 'dim', defaultItemDurationBeats: 2 })
  })

  it('looks a bundled image up by the media id the compiler asks for, and knows nothing else', () => {
    const lookup = createPixGridSequenceBundledIndex([pixGridShippedDeckToSequence(manifest())])
    expect(lookup(pixGridSequenceSourceMediaId('shipped-neon-set', 'source-02'))).toEqual({ path: 'pixgrid-decks/neon-set/02.png', mimeType: 'image/png' })
    expect(lookup('some-library-media-id')).toBeNull()
  })
})
