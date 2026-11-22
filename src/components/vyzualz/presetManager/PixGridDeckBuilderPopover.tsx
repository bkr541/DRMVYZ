import { useMemo } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { PixGridDeckPopover } from '../react/pixGrid/PixGridDeckPopover'
import { newPopoverDeck, popoverSettingsToUpdate, toPopoverDeck, toPopoverReadiness } from '../react/pixGrid/pixGridDeckPopoverModel'
import type { PixGridDeckBuilderController } from '../react/pixGrid/usePixGridDeckBuilder'
import { PixGridPreviewStage } from './PixGridPreviewStage'

/**
 * Preset Manager's Create PixGrid Deck workflow: the PixGrid Deck popover driven by the real Deck builder controller. Name, uploads, image
 * operations, settings, compile readiness, Create Preset, delete and the development-only export all go through `usePixGridDeckBuilder`, and the
 * live preview is the same PixGrid render Preset Manager shows for any PixGrid preset.
 */
export function PixGridDeckBuilderPopover({ controller }: { controller: PixGridDeckBuilderController }) {
  const pixGridState = useReactStore(state => state.pixGridState)
  const pixGridDecks = useReactStore(state => state.pixGridDecks)
  const intensity = useReactStore(state => state.reactIntensity)
  const motion = useReactStore(state => state.reactMotion)
  const glow = useReactStore(state => state.reactGlow)
  const bassReactivity = useReactStore(state => state.reactBassReactivity)
  const { deck, draftName } = controller
  const model = useMemo(() => deck ? toPopoverDeck(deck, draftName) : newPopoverDeck(draftName), [deck, draftName])

  if (!controller.active) return null
  return (
    <PixGridDeckPopover
      mode={controller.mode}
      deck={model}
      nameError={controller.nameError}
      upload={controller.upload}
      readiness={toPopoverReadiness(controller.readiness, controller.enabledItems.length)}
      created={controller.created}
      presetCreated={deck?.presetCreated === true}
      preview={{
        itemId: controller.previewItemId,
        progress: controller.previewTransitionProgress,
        stage: controller.previewPreset ? (
          <PixGridPreviewStage
            preset={controller.previewPreset}
            pixGridState={pixGridState}
            pixGridDecks={pixGridDecks}
            intensity={intensity}
            motion={motion}
            glow={glow}
            bassReactivity={bassReactivity}
            audioTimeSec={controller.previewTimeFor(null, 0)}
          />
        ) : null,
        onItem: controller.setPreviewItemId,
        onProgress: controller.setPreviewTransitionProgress,
      }}
      ship={controller.ship}
      deletePending={controller.pendingDelete !== null}
      onName={controller.setDraftName}
      onNameCommit={controller.rename}
      onFiles={controller.addFiles}
      onMove={controller.moveItem}
      onDuplicate={controller.duplicateItem}
      onReorder={controller.reorderItems}
      onToggle={controller.toggleItem}
      onRemove={controller.removeItem}
      onDuration={controller.setItemTiming}
      onSettings={patch => { if (deck) controller.update(popoverSettingsToUpdate(deck, patch)) }}
      onCreate={controller.createPreset}
      onDeleteRequest={controller.requestDelete}
      onDeleteCancel={controller.cancelDelete}
      onDeleteConfirm={controller.confirmDelete}
      onClose={controller.exit}
    />
  )
}
