import type {
  MediaDeletionConfirmation,
  MediaDeletionGuard,
  MediaDeletionWarning,
  UploadedMedia,
} from '../../../../stores/mediaStore'
import {
  PIX_GRID_DECK_MIN_ITEMS,
  type PixGridDeckDefinition,
  type PixGridDeckMutationResult,
} from './PixGridDeckDomain'

interface PixGridDeckDeletionStoreState {
  pixGridDecks: PixGridDeckDefinition[]
  pixGridDeckHistoryTransaction: unknown | null
  beginPixGridDeckHistoryTransaction(): void
  commitPixGridDeckHistoryTransaction(): void
  cancelPixGridDeckHistoryTransaction(): void
  updatePixGridDeck(deckId: string, patch: { items: PixGridDeckDefinition['items'] }): PixGridDeckMutationResult
  deletePixGridDeck(deckId: string): PixGridDeckMutationResult
}

interface AffectedDeck {
  deck: PixGridDeckDefinition
  remainingItems: PixGridDeckDefinition['items']
}

function affectedDecks(state: PixGridDeckDeletionStoreState, mediaId: string): AffectedDeck[] {
  return state.pixGridDecks.flatMap(deck => {
    if (!deck.items.some(item => item.mediaId === mediaId)) return []
    const remainingItems = deck.items
      .filter(item => item.mediaId !== mediaId)
      .map((item, order) => ({ ...item, order }))
    return [{ deck, remainingItems }]
  })
}

function warningFor(item: UploadedMedia, affected: readonly AffectedDeck[]): MediaDeletionWarning {
  const requiresDeckDeletion = affected.some(entry => entry.remainingItems.length < PIX_GRID_DECK_MIN_ITEMS)
  const deckNames = affected.map(entry => entry.deck.name).join(', ')
  if (requiresDeckDeletion) {
    return {
      itemId: item.id,
      affectedDecks: affected.map(entry => ({
        id: entry.deck.id,
        name: entry.deck.name,
        remainingItemCount: entry.remainingItems.length,
      })),
      action: 'confirm-deck-deletion',
      message: `Deleting this media would leave at least one PixGrid Deck below the two-image minimum (${deckNames}). The affected Deck must be deleted instead of committing an invalid Deck.`,
      confirmationCopy: 'Deleting this Deck will delete the Preset too. Are you sure?',
    }
  }
  return {
    itemId: item.id,
    affectedDecks: affected.map(entry => ({
      id: entry.deck.id,
      name: entry.deck.name,
      remainingItemCount: entry.remainingItems.length,
    })),
    action: 'confirm-reference-removal',
    message: `This media is referenced by ${affected.length} PixGrid Deck${affected.length === 1 ? '' : 's'} (${deckNames}). Confirm deletion to remove the reference from every affected Deck in one undoable transaction.`,
    confirmationCopy: 'Delete this media and remove it from the affected PixGrid Decks?',
  }
}

/**
 * Creates the cross-store deletion contract without importing the React store
 * back into mediaStore, which would form a circular source-of-truth dependency.
 */
export function createPixGridDeckMediaDeletionGuard(
  getDeckState: () => PixGridDeckDeletionStoreState,
): MediaDeletionGuard {
  return (item, confirmation?: MediaDeletionConfirmation) => {
    const initial = getDeckState()
    const affected = affectedDecks(initial, item.id)
    if (affected.length === 0) return { allowed: true }

    const requiresDeckDeletion = affected.some(entry => entry.remainingItems.length < PIX_GRID_DECK_MIN_ITEMS)
    const confirmed = requiresDeckDeletion
      ? confirmation === 'delete-affected-decks'
      : confirmation === 'remove-deck-references' || confirmation === 'delete-affected-decks'
    if (!confirmed) return { allowed: false, warning: warningFor(item, affected) }

    let applied = false
    return {
      allowed: true,
      apply: () => {
        const state = getDeckState()
        if (state.pixGridDeckHistoryTransaction) return false
        const currentAffected = affectedDecks(state, item.id)
        if (currentAffected.length === 0) return true
        if (currentAffected.some(entry => entry.remainingItems.length < PIX_GRID_DECK_MIN_ITEMS)
          && confirmation !== 'delete-affected-decks') return false

        state.beginPixGridDeckHistoryTransaction()
        for (const entry of currentAffected) {
          const result = entry.remainingItems.length < PIX_GRID_DECK_MIN_ITEMS
            ? state.deletePixGridDeck(entry.deck.id)
            : state.updatePixGridDeck(entry.deck.id, { items: entry.remainingItems })
          if (!result.ok) {
            getDeckState().cancelPixGridDeckHistoryTransaction()
            return false
          }
        }
        applied = true
        return true
      },
      commit: () => {
        if (!applied) return
        getDeckState().commitPixGridDeckHistoryTransaction()
        applied = false
      },
      rollback: () => {
        if (!applied) return
        getDeckState().cancelPixGridDeckHistoryTransaction()
        applied = false
      },
    }
  }
}
