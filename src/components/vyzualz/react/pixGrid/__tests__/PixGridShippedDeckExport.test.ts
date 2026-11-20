// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { PixGridDeckDefinition } from '../PixGridDeckDomain'
import {
  buildPixGridShippedDeckManifest,
  exportPixGridShippedDeck,
  pixGridShippedDeckSlug,
  pixGridShippedImageSize,
  type PixGridPreparedShippedImage,
  type PixGridShippedDeckWriter,
} from '../PixGridShippedDeckExport'

const fingerprint = (character: string) => `sha256:${character.repeat(64)}`

function deck(): PixGridDeckDefinition {
  const source = (name: string) => ({ mediaRevision: 1, fingerprint: fingerprint('c'), fileName: name, mimeType: 'image/png', width: 100, height: 60, hasAlpha: false, transparentBackground: '#000000' })
  return {
    schemaVersion: 1, id: 'deck-1', name: 'Neon Set', revision: 4, generatedPresetId: 'pix-grid-deck:deck-1', presetCreated: true,
    items: [
      { id: 'item-1', mediaId: 'media-a', enabled: true, order: 0, revision: 1, timingOverrideBeats: null, source: source('a.png') },
      { id: 'item-2', mediaId: 'media-b', enabled: true, order: 2, revision: 1, timingOverrideBeats: 6, source: source('b.png') },
      { id: 'item-3', mediaId: 'media-a', enabled: false, order: 1, revision: 1, timingOverrideBeats: null, source: source('a.png') },
    ],
    configuration: {
      playbackOrder: 'forward', loop: true, reactionProfileId: 'graphicLogo', defaultItemDurationBeats: 4, motionProfileId: 'flow', preDropBehavior: 'disperse',
      sectionTimingBeats: { drop: 1 }, sectionItemAssignments: { drop: ['item-2'] }, transitionPolicy: { mode: 'crossfade', style: 'cut', durationBeats: 0 },
      sceneMotionProfileIds: { 'pix-grid-deck-scene:deck-1:drop': 'explosive-reconstruction', 'pix-grid-deck-scene:another-deck:drop': 'balanced' },
    },
  } as unknown as PixGridDeckDefinition
}

const image = (character: string, mimeType = 'image/png', fileName = 'x.png'): PixGridPreparedShippedImage => (
  { bytes: new Uint8Array([1, 2, 3]), mimeType, width: 100, height: 60, hasAlpha: false, fingerprint: fingerprint(character), fileName })

describe('shipping a Deck', () => {
  it('makes a short lowercase slug from the name', () => {
    expect(pixGridShippedDeckSlug('Neon Set!')).toBe('neon-set')
    expect(pixGridShippedDeckSlug('  Café Ünïcode — 2026  ')).toBe('cafe-unicode-2026')
    expect(pixGridShippedDeckSlug('***')).toBe('deck')
    expect(pixGridShippedDeckSlug('a'.repeat(80))).toHaveLength(48)
  })

  it('shrinks only images over 512 px on the long side, keeping the shape', () => {
    expect(pixGridShippedImageSize(400, 300)).toEqual({ width: 400, height: 300, resized: false })
    expect(pixGridShippedImageSize(2048, 1024)).toEqual({ width: 512, height: 256, resized: true })
    expect(pixGridShippedImageSize(1000, 4000)).toEqual({ width: 128, height: 512, resized: true })
  })

  it('builds a manifest in playback order, sharing one source per image and keeping item ids and settings', () => {
    const manifest = buildPixGridShippedDeckManifest({
      deck: deck(), slug: 'neon-set', description: 'A set.',
      images: new Map([['media-a', image('a', 'image/webp', 'a.webp')], ['media-b', image('b', 'image/png', 'b.png')]]),
    })
    expect(manifest).toMatchObject({ slug: 'neon-set', name: 'Neon Set', description: 'A set.', revision: 1 })
    expect(manifest.sources.map(source => [source.id, source.path, source.fingerprint])).toEqual([
      ['source-01', 'pixgrid-decks/neon-set/01.webp', fingerprint('a')],
      ['source-02', 'pixgrid-decks/neon-set/02.png', fingerprint('b')],
    ])
    // item-3 (order 1, disabled) sits between the others and reuses the first image's source
    expect(manifest.items).toEqual([
      { id: 'item-1', sourceId: 'source-01', enabled: true, durationBeats: null },
      { id: 'item-3', sourceId: 'source-01', enabled: false, durationBeats: null },
      { id: 'item-2', sourceId: 'source-02', enabled: true, durationBeats: 6 },
    ])
    expect(manifest.configuration).toMatchObject({
      playbackOrder: 'forward', loop: true, reactionProfileId: 'graphicLogo', preDropBehavior: 'disperse', motionProfileId: 'flow',
      sectionItemAssignments: { drop: ['item-2'] }, sectionTimingBeats: { drop: 1 },
    })
    // Only this Deck's scene keys carry over, re-pointed at the shipped scene ids.
    expect(manifest.configuration.sceneMotionProfileIds).toEqual({ 'pix-grid-deck-scene:pix-grid-sequence:shipped-neon-set:drop': 'explosive-reconstruction' })
  })

  it('refuses a Deck whose image was not prepared', () => {
    expect(() => buildPixGridShippedDeckManifest({ deck: deck(), slug: 'neon-set', images: new Map([['media-a', image('a')]]) })).toThrow(/was not prepared/)
  })

  it('writes the images and then the manifest, and writes nothing if a source is missing', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 60, close: () => undefined })))
    const written: string[] = []
    const writer: PixGridShippedDeckWriter = { write: async path => { written.push(path) } }
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' })
    const result = await exportPixGridShippedDeck({
      deck: deck(), writer, files: new Map([['media-a', png], ['media-b', new File([new Uint8Array([9, 9])], 'b.png', { type: 'image/png' })]]),
    })
    expect(result.slug).toBe('neon-set')
    expect(written).toEqual([
      'public/pixgrid-decks/neon-set/01.png',
      'public/pixgrid-decks/neon-set/02.png',
      'src/components/vyzualz/react/pixGrid/shippedDecks/neon-set.json',
    ])
    written.length = 0
    await expect(exportPixGridShippedDeck({ deck: deck(), writer, files: new Map([['media-a', png]]) })).rejects.toThrow(/not available/)
    expect(written).toEqual([])
    vi.unstubAllGlobals()
  })
})
