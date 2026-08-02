import { describe, expect, it } from 'vitest'
import {
  createPixGridDeckDefinition,
  PIX_GRID_DECK_PATTERN_ID,
  PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
  type PixGridDeckDefinition,
} from '../PixGridDeckDomain'
import type { PixGridDeckCompileStatus } from '../PixGridDeckCompilerContracts'
import type { PixGridDeckTransitionStatus } from '../PixGridDeckTransitionCoordinator'
import {
  createPixGridDeckGeneratedPreset,
  reconcilePixGridDeckGeneratedPresets,
  resolvePixGridDeckPresetReadiness,
} from '../PixGridDeckPreset'

function deckFixture(id = 'deck-stage-8', name = 'Stage 8 Deck'): PixGridDeckDefinition {
  const result = createPixGridDeckDefinition({
    id,
    name,
    items: [1, 2, 3].map(index => ({
      id: `${id}-item-${index}`,
      mediaId: `${id}-media-${index}`,
      enabled: true,
      revision: index,
      source: {
        mediaRevision: 1,
        fingerprint: `sha256:${String(index).padStart(64, '0')}`,
        fileName: `${name}-${index}.png`,
        mimeType: 'image/png',
        width: 640,
        height: 360,
        hasAlpha: false,
        transparentBackground: '#000000',
      },
    })),
  })
  if (!result.deck) throw new Error('Deck fixture failed normalization.')
  return result.deck
}

function compileStatus(deck: PixGridDeckDefinition, ready = true): PixGridDeckCompileStatus {
  return {
    deckId: deck.id,
    deckRevision: deck.revision,
    width: 160,
    height: 90,
    phase: ready ? 'ready' : 'compiling',
    progress: ready ? 1 : 0.5,
    ready,
    enabledItemCount: deck.items.filter(item => item.enabled).length,
    readyItemCount: ready ? deck.items.filter(item => item.enabled).length : 1,
    failedItemCount: 0,
    items: [],
  }
}

function transitionStatus(deck: PixGridDeckDefinition, ready = true): PixGridDeckTransitionStatus {
  return {
    deckId: deck.id,
    deckRevision: deck.revision,
    ready,
    progress: ready ? 1 : 0.25,
    pairCount: 3,
    readyPairCount: ready ? 3 : 0,
    failedPairCount: 0,
    pairs: [],
  }
}

describe('PixGrid Deck generated Preset lifecycle', () => {
  it('creates one lightweight custom Preset that references the Deck and canonical runtime program', () => {
    const deck = deckFixture()
    const preset = createPixGridDeckGeneratedPreset(deck)

    expect(preset).toMatchObject({
      id: 'pix-grid-deck:deck-stage-8',
      name: 'Stage 8 Deck',
      engine: 'pixGrid',
      pixGridDeck: {
        deckId: deck.id,
        deckRevision: deck.revision,
        firstEnabledItemId: deck.items[0]?.id,
      },
      pixGridSettings: {
        pattern: PIX_GRID_DECK_PATTERN_ID,
        performanceProgramId: PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
      },
    })
    const layers = preset.pixGridSettings?.layers ?? []
    expect(layers).toHaveLength(1)
    expect(layers[0]?.frameSource).toEqual({ kind: 'deck', deckId: deck.id })
    expect(layers[0]).not.toHaveProperty('compiledFrames')
    expect(layers[0]).not.toHaveProperty('pixels')
    expect(preset).not.toHaveProperty('mediaItems')
  })

  it('requires current frame and transition compiler projections plus two enabled images', () => {
    const deck = deckFixture()
    expect(resolvePixGridDeckPresetReadiness(deck, compileStatus(deck), transitionStatus(deck))).toMatchObject({
      ready: true,
      enabledItemCount: 3,
      frameProgress: 1,
      transitionProgress: 1,
    })

    expect(resolvePixGridDeckPresetReadiness(
      deck,
      { ...compileStatus(deck), deckRevision: deck.revision - 1 },
      transitionStatus(deck),
    )).toMatchObject({ ready: false, frameProgress: 0 })

    const oneEnabled = {
      ...deck,
      items: deck.items.map((item, index) => ({ ...item, enabled: index === 0 })),
    }
    expect(resolvePixGridDeckPresetReadiness(
      oneEnabled,
      compileStatus(oneEnabled),
      transitionStatus(oneEnabled),
    )).toMatchObject({ ready: false, enabledItemCount: 1, message: 'Enable at least two images.' })
  })

  it('adds records only after explicit creation and rebuilds rename, revision, and deletion atomically', () => {
    const draftDeck = deckFixture()
    expect(reconcilePixGridDeckGeneratedPresets([], [draftDeck])).toEqual([])

    const created = { ...draftDeck, presetCreated: true }
    const [preset] = reconcilePixGridDeckGeneratedPresets([], [created])
    expect(preset?.id).toBe(created.generatedPresetId)

    const renamed = { ...created, name: 'Renamed Deck', revision: created.revision + 1 }
    const [renamedPreset] = reconcilePixGridDeckGeneratedPresets([preset!], [renamed])
    expect(renamedPreset).toMatchObject({
      id: created.generatedPresetId,
      name: 'Renamed Deck',
      pixGridDeck: { deckRevision: renamed.revision },
    })
    expect(reconcilePixGridDeckGeneratedPresets([renamedPreset!], [])).toEqual([])
  })

  it('changes the thumbnail fingerprint when the first enabled image or Deck revision changes', () => {
    const deck = { ...deckFixture(), presetCreated: true }
    const baseline = createPixGridDeckGeneratedPreset(deck).pixGridDeck?.thumbnailFingerprint
    const firstDisabled = {
      ...deck,
      revision: deck.revision + 1,
      items: deck.items.map((item, index) => ({ ...item, enabled: index !== 0 })),
    }
    const changed = createPixGridDeckGeneratedPreset(firstDisabled).pixGridDeck?.thumbnailFingerprint

    expect(changed).not.toBe(baseline)
    expect(createPixGridDeckGeneratedPreset(structuredClone(deck)).pixGridDeck?.thumbnailFingerprint).toBe(baseline)
  })
})
