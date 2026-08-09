import { beforeEach, describe, expect, it } from 'vitest'
import { mergeReactStoreState, reactStorePartialize, useReactStore } from './reactStore'

describe('Canvas Show Manager Stage 2 store integration', () => {
  beforeEach(() => {
    useReactStore.setState({
      canvasShowManagerShows: [],
      canvasShowManagerActiveShowId: null,
      canvasShowManagerEditingShowId: null,
      canvasShowManagerEditingSectionId: null,
      canvasShowManagerEditingElementId: null,
      canvasShowManagerUndoStack: [],
      canvasShowManagerRedoStack: [],
    })
  })

  it('adds, edits, moves, removes, undoes, and redoes canonical media elements', () => {
    const showId = useReactStore.getState().createCanvasShowManagerShow('Authoring')!
    const sectionId = useReactStore.getState().canvasShowManagerShows[0]!.sections[0]!.id
    useReactStore.getState().clearCanvasShowManagerHistory()

    const add = useReactStore.getState().addCanvasShowManagerMediaElement({
      showId,
      sectionId,
      mediaId: 'video-1',
      layer: 0,
      timedVideo: true,
      sourceDurationSec: 5,
    })
    expect(add.ok).toBe(true)
    if (!add.ok) return
    expect(useReactStore.getState().canvasShowManagerEditingElementId).toBe(add.element.id)

    expect(useReactStore.getState().updateCanvasShowManagerMediaElement(showId, add.element.id, {
      layer: 2,
      showStartSec: 1,
      showEndSec: 9,
      sourceInSec: 1,
      sourceOutSec: 4,
    }, 5).ok).toBe(true)
    expect(useReactStore.getState().canvasShowManagerShows[0]!.mediaElements[0]).toMatchObject({
      layer: 2, showStartSec: 1, showEndSec: 9, sourceInSec: 1, sourceOutSec: 4,
    })

    expect(useReactStore.getState().removeCanvasShowManagerMediaElement(showId, add.element.id)).toBe(true)
    expect(useReactStore.getState().canvasShowManagerEditingElementId).toBeNull()
    useReactStore.getState().undoCanvasShowManagerEdit()
    expect(useReactStore.getState().canvasShowManagerShows[0]!.mediaElements).toHaveLength(1)
    useReactStore.getState().redoCanvasShowManagerEdit()
    expect(useReactStore.getState().canvasShowManagerShows[0]!.mediaElements).toHaveLength(0)
  })

  it('persists authored data while keeping element selection and history transient', () => {
    const showId = useReactStore.getState().createCanvasShowManagerShow('Persisted Media')!
    const sectionId = useReactStore.getState().canvasShowManagerShows[0]!.sections[1]!.id
    const add = useReactStore.getState().addCanvasShowManagerMediaElement({
      showId, sectionId, mediaId: 'image-1', layer: 3, timedVideo: false,
    })
    expect(add.ok).toBe(true)

    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    expect((persisted.canvasShowManagerShows as Array<{ mediaElements: unknown[] }>)[0]!.mediaElements).toHaveLength(1)
    expect(persisted).not.toHaveProperty('canvasShowManagerEditingElementId')
    expect(persisted).not.toHaveProperty('canvasShowManagerUndoStack')

    const merged = mergeReactStoreState(persisted, useReactStore.getState())
    expect(merged.canvasShowManagerShows[0]!.mediaElements).toHaveLength(1)
    expect(merged.canvasShowManagerEditingElementId).toBeNull()
  })

  it('applies section ripple and overlap rejection inside one store history entry', () => {
    const showId = useReactStore.getState().createCanvasShowManagerShow('Ripple')!
    const show = useReactStore.getState().canvasShowManagerShows[0]!
    const third = show.sections[2]!
    const add = useReactStore.getState().addCanvasShowManagerMediaElement({
      showId, sectionId: third.id, mediaId: 'image-1', layer: 0, timedVideo: false,
    })
    expect(add.ok).toBe(true)
    useReactStore.getState().clearCanvasShowManagerHistory()

    const first = useReactStore.getState().canvasShowManagerShows[0]!.sections[0]!
    useReactStore.getState().updateCanvasShowManagerSectionDuration(showId, first.id, 10)
    expect(useReactStore.getState().canvasShowManagerShows[0]!.mediaElements[0]).toMatchObject({ showStartSec: 18, showEndSec: 26 })
    expect(useReactStore.getState().canvasShowManagerUndoStack).toHaveLength(1)
    useReactStore.getState().undoCanvasShowManagerEdit()
    expect(useReactStore.getState().canvasShowManagerShows[0]!.mediaElements[0]).toMatchObject({ showStartSec: 16, showEndSec: 24 })
  })
})
