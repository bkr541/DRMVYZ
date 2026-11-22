import { describe, expect, it } from 'vitest'
import { createPixGridDeckDefinition, type PixGridDeckDefinition } from '../PixGridDeckDomain'
import {
  newPopoverDeck,
  popoverPairKey,
  popoverSettingsToUpdate,
  popoverTransitionPairs,
  toPopoverDeck,
  toPopoverReadiness,
} from '../pixGridDeckPopoverModel'

function makeDeck(configuration?: Parameters<typeof createPixGridDeckDefinition>[0]['configuration']): PixGridDeckDefinition {
  const result = createPixGridDeckDefinition({
    id: 'model-deck',
    name: 'Model Deck',
    items: ['a', 'b', 'c'].map((key, index) => ({
      id: `item-${key}`, mediaId: `media-${key}`, enabled: key !== 'c', timingOverrideBeats: index === 1 ? 6 : null,
      source: { mediaRevision: 1, fingerprint: `sha256:${key.repeat(64)}`, fileName: `${key}.png`, mimeType: 'image/png', width: 64, height: 36, hasAlpha: false, transparentBackground: '#000000' },
    })),
    configuration,
  })
  if (!result.deck) throw new Error(result.issues.map(issue => issue.message).join('; '))
  return result.deck
}

describe('toPopoverDeck', () => {
  it('shows images in Deck order, named after their files, with their own durations and the Deck defaults', () => {
    const model = toPopoverDeck(makeDeck(), 'Draft')
    expect(model.name).toBe('Draft')
    expect(model.items.map(item => [item.id, item.name, item.enabled, item.duration])).toEqual([
      ['item-a', 'a.png', true, null], ['item-b', 'b.png', true, 6], ['item-c', 'c.png', false, null],
    ])
    expect(model).toMatchObject({ playback: 'forward', loop: true, reaction: 'balanced', motion: 'balanced', transitionMode: 'auto', transitionLength: 0.25, anchorMode: 'onset', arrivalAnchor: 'dropImpact', preDrop: 'hold' })
    expect(model.pairs).toEqual({})
    expect(model.sections.drop).toEqual({ beats: null, item: '', motion: 'default' })
  })

  it('reads pair overrides, section timing, assignments and scene motion', () => {
    const model = toPopoverDeck(makeDeck({
      transitionPolicy: { pairOverrides: [{ sourceItemId: 'item-a', targetItemId: 'item-b', mode: 'rowWipe', durationFraction: 0.5, motionProfileId: 'snappy' }] },
      sectionTimingBeats: { drop: 2 },
      sectionItemAssignments: { drop: ['item-b'] },
      sceneMotionProfileIds: { 'pix-grid-deck-scene:model-deck:drop': 'snappy' },
    }), 'Model Deck')
    expect(model.pairs[popoverPairKey('item-a', 'item-b')]).toEqual({ mode: 'rowWipe', motion: 'snappy', length: 0.5 })
    expect(model.sections.drop).toEqual({ beats: 2, item: 'item-b', motion: 'snappy' })
  })
})

describe('popoverTransitionPairs', () => {
  it('pairs each enabled image with the next, and the last back to the first only when looping', () => {
    const model = toPopoverDeck(makeDeck(), 'x')
    expect(popoverTransitionPairs(model).map(pair => [pair.from, pair.to])).toEqual([[1, 2], [2, 1]])
    expect(popoverTransitionPairs({ ...model, loop: false }).map(pair => [pair.from, pair.to])).toEqual([[1, 2]])
  })
})

describe('popoverSettingsToUpdate', () => {
  it('writes playback, reaction, motion and pre-drop settings into the configuration', () => {
    const update = popoverSettingsToUpdate(makeDeck(), { playback: 'pingPong', defaultDuration: 8, loop: false, reaction: 'highEnergy', motion: 'snappy', preDrop: 'dim' })
    expect(update.configuration).toEqual({ playbackOrder: 'pingPong', defaultItemDurationBeats: 8, loop: false, reactionProfileId: 'highEnergy', motionProfileId: 'snappy', preDropBehavior: 'dim' })
  })

  it('writes transition settings as a partial transition policy', () => {
    const update = popoverSettingsToUpdate(makeDeck(), { transitionMode: 'crossfade', transitionLength: 0.4, anchorMode: 'arrival', arrivalAnchor: 'phrase' })
    expect(update.configuration).toEqual({ transitionPolicy: { mode: 'crossfade', durationFraction: 0.4, anchorMode: 'arrival', arrivalAnchor: 'phrase' } })
  })

  it('turns pair edits into directed overrides, taking the Deck mode for a pair that only changes motion or length', () => {
    const deck = makeDeck({ transitionPolicy: { mode: 'checkerWipe' } })
    const key = popoverPairKey('item-a', 'item-b')
    const update = popoverSettingsToUpdate(deck, { pairs: { [key]: { mode: 'default', motion: 'snappy', length: 0.3 } } })
    expect(update.configuration?.transitionPolicy?.pairOverrides).toEqual([
      { sourceItemId: 'item-a', targetItemId: 'item-b', mode: 'checkerWipe', durationFraction: 0.3, motionProfileId: 'snappy' },
    ])
  })

  it('drops pair entries that inherit everything, and ignores pairs that are not in the Deck', () => {
    const update = popoverSettingsToUpdate(makeDeck(), {
      pairs: {
        [popoverPairKey('item-a', 'item-b')]: { mode: 'default', motion: 'default', length: null },
        [popoverPairKey('item-a', 'ghost')]: { mode: 'hardCut', motion: 'default', length: null },
      },
    })
    expect(update.configuration?.transitionPolicy?.pairOverrides).toEqual([])
  })

  it('keeps overrides the popover cannot show (a pair involving a switched-off image)', () => {
    const hidden = { sourceItemId: 'item-b', targetItemId: 'item-c', mode: 'hardCut' as const }
    const deck = makeDeck({ transitionPolicy: { pairOverrides: [hidden] } })
    const update = popoverSettingsToUpdate(deck, { pairs: { [popoverPairKey('item-a', 'item-b')]: { mode: 'rowWipe', motion: 'default', length: null } } })
    expect(update.configuration?.transitionPolicy?.pairOverrides).toEqual([
      hidden,
      { sourceItemId: 'item-a', targetItemId: 'item-b', mode: 'rowWipe' },
    ])
  })

  it('writes section timing, assignments and scene motion, removing the entries a section no longer sets', () => {
    const deck = makeDeck({
      sectionTimingBeats: { intro: 3, drop: 2 },
      sectionItemAssignments: { drop: ['item-a'] },
      sceneMotionProfileIds: { 'pix-grid-deck-scene:model-deck:drop': 'snappy', 'pix-grid-deck-scene:model-deck:unknown': 'keep-me' },
    })
    const model = toPopoverDeck(deck, 'x')
    const update = popoverSettingsToUpdate(deck, {
      sections: {
        ...model.sections,
        intro: { beats: null, item: 'item-b', motion: 'default' },
        drop: { beats: 2, item: '', motion: 'default' },
      },
    })
    expect(update.configuration?.sectionTimingBeats).toEqual({ drop: 2 })
    expect(update.configuration?.sectionItemAssignments).toEqual({ intro: ['item-b'] })
    expect(update.configuration?.sceneMotionProfileIds).toEqual({ 'pix-grid-deck-scene:model-deck:unknown': 'keep-me' })
  })

  it('round-trips through the Deck: what the popover writes is what it reads back', () => {
    const deck = makeDeck()
    const key = popoverPairKey('item-b', 'item-a')
    const settings = {
      playback: 'shuffle' as const, transitionMode: 'radialReveal' as const, anchorMode: 'arrival' as const,
      pairs: { [key]: { mode: 'hardCut', motion: 'default', length: null } },
      sections: { ...toPopoverDeck(deck, 'x').sections, build: { beats: 8, item: 'item-a', motion: 'snappy' } },
    }
    const update = popoverSettingsToUpdate(deck, settings)
    const next = { ...deck, configuration: { ...deck.configuration, ...update.configuration, transitionPolicy: { ...deck.configuration.transitionPolicy, ...update.configuration?.transitionPolicy } } } as PixGridDeckDefinition
    const model = toPopoverDeck(next, 'x')
    expect(model).toMatchObject({ playback: 'shuffle', transitionMode: 'radialReveal', anchorMode: 'arrival' })
    expect(model.pairs[key]).toEqual({ mode: 'hardCut', motion: 'default', length: null })
    expect(model.sections.build).toEqual({ beats: 8, item: 'item-a', motion: 'snappy' })
  })
})

describe('toPopoverReadiness', () => {
  const base = { deckId: 'd', deckRevision: 1, enabledItemCount: 3, frameProgress: 1, transitionProgress: 1, ready: true, errorCount: 0, message: 'Ready.' }
  it('reports invalid below two enabled images, whatever the compiler says', () => {
    expect(toPopoverReadiness(base, 1).level).toBe('invalid')
    expect(toPopoverReadiness(null, 0).level).toBe('invalid')
  })
  it('maps ready, preparing and error from the compiler status', () => {
    expect(toPopoverReadiness(base, 3)).toMatchObject({ level: 'ready', message: 'Ready.' })
    expect(toPopoverReadiness({ ...base, ready: false, frameProgress: 0.4, transitionProgress: 0.1 }, 3)).toMatchObject({ level: 'preparing', frameProgress: 0.4, transitionProgress: 0.1 })
    expect(toPopoverReadiness({ ...base, ready: false, errorCount: 1, errors: ['a.png: bad'] }, 3)).toMatchObject({ level: 'error', errors: ['a.png: bad'] })
    expect(toPopoverReadiness(null, 3).level).toBe('preparing')
  })
})

describe('newPopoverDeck', () => {
  it('is an empty Deck with the builder defaults', () => {
    expect(newPopoverDeck('Untitled Deck')).toMatchObject({ name: 'Untitled Deck', items: [], playback: 'forward', defaultDuration: 4, loop: true, preDrop: 'hold' })
  })
})
