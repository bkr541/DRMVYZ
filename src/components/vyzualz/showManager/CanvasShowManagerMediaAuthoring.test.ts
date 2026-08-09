import { describe, expect, it } from 'vitest'
import {
  CANVAS_SHOW_MANAGER_SCHEMA_VERSION,
  canvasShowManagerRangeOverlaps,
  createCanvasShowManagerMediaElement,
  createCanvasShowManagerShow,
  findCanvasShowManagerMediaReferences,
  getActiveCanvasShowManagerMediaElements,
  normalizeCanvasShowManagerShow,
  resolveCanvasShowManagerElementSourceTime,
  updateCanvasShowManagerMediaElement,
  updateCanvasShowManagerSectionDuration,
} from './CanvasShowManagerDomain'
import { createCanvasShowManagerMediaDeletionGuard } from './CanvasShowManagerMediaDeletion'
import type { UploadedMedia } from '../../../stores/mediaStore'

function addElement(
  show: ReturnType<typeof createCanvasShowManagerShow>,
  input: Parameters<typeof createCanvasShowManagerMediaElement>[1],
) {
  const result = createCanvasShowManagerMediaElement(show, input)
  if (!result.ok) throw new Error(result.message)
  return result
}

describe('Canvas Show Manager Stage 2 media domain', () => {
  it('accepts exact-adjacent clips and rejects same-layer overlap while preserving explicit stacking', () => {
    const empty = createCanvasShowManagerShow('Media Show')
    const first = addElement(empty, {
      mediaId: 'media-a', layer: 0, showStartSec: 0, showEndSec: 8, timedVideo: false,
    })
    const adjacent = addElement(first.show, {
      mediaId: 'media-b', layer: 0, showStartSec: 8, showEndSec: 16, timedVideo: false,
    })
    const front = addElement(adjacent.show, {
      mediaId: 'media-front', layer: 3, showStartSec: 0, showEndSec: 16, timedVideo: false,
    })

    expect(front.show.mediaElements.map(element => element.layer)).toEqual([0, 0, 3])
    expect(canvasShowManagerRangeOverlaps(front.show.mediaElements, 0, 7.999, 9)).toBe(true)
    expect(createCanvasShowManagerMediaElement(front.show, {
      mediaId: 'overlap', layer: 0, showStartSec: 7.999, showEndSec: 9, timedVideo: false,
    })).toMatchObject({ ok: false, code: 'overlap' })
  })

  it('keeps Show cues independent from video source trim and resolves looping source time', () => {
    const created = addElement(createCanvasShowManagerShow('Video Show'), {
      mediaId: 'video-a', layer: 1, showStartSec: 4, showEndSec: 20, timedVideo: true, sourceDurationSec: 6,
    })
    expect(created.element).toMatchObject({ sourceInSec: 0, sourceOutSec: 6 })

    const trimmed = updateCanvasShowManagerMediaElement(created.show, created.element.id, {
      sourceInSec: 1,
      sourceOutSec: 3,
    }, 6)
    expect(trimmed.ok).toBe(true)
    if (!trimmed.ok) return
    expect(trimmed.element.showStartSec).toBe(4)
    expect(trimmed.element.showEndSec).toBe(20)
    expect(resolveCanvasShowManagerElementSourceTime(trimmed.element, 9)).toBe(2)
    expect(updateCanvasShowManagerMediaElement(trimmed.show, trimmed.element.id, { sourceOutSec: 7 }, 6))
      .toMatchObject({ ok: false, code: 'invalid-trim' })
  })

  it('uses the fixed section ripple rule atomically without changing source trim', () => {
    const before = addElement(createCanvasShowManagerShow('Ripple Show'), {
      mediaId: 'spanning-video', layer: 0, showStartSec: 2, showEndSec: 12, timedVideo: true, sourceDurationSec: 5,
    })
    const downstream = addElement(before.show, {
      mediaId: 'downstream', layer: 1, showStartSec: 16, showEndSec: 24, timedVideo: false,
    })
    const firstSection = downstream.show.sections[0]!
    const edit = updateCanvasShowManagerSectionDuration(downstream.show, firstSection.id, 10)!
    const spanning = edit.show.mediaElements.find(element => element.id === before.element.id)!
    const shifted = edit.show.mediaElements.find(element => element.id === downstream.element.id)!

    expect(spanning).toMatchObject({ showStartSec: 2, showEndSec: 12, sourceInSec: 0, sourceOutSec: 5 })
    expect(shifted).toMatchObject({ showStartSec: 18, showEndSec: 26, sourceInSec: null, sourceOutSec: null })
    expect(edit.downstreamShiftSec).toBe(2)
  })

  it('rejects a section ripple atomically when it would create a same-layer overlap', () => {
    const first = addElement(createCanvasShowManagerShow('Ripple Collision'), {
      mediaId: 'crossing', layer: 0, showStartSec: 0, showEndSec: 7, timedVideo: false,
    })
    const second = addElement(first.show, {
      mediaId: 'downstream', layer: 0, showStartSec: 8, showEndSec: 16, timedVideo: false,
    })
    expect(updateCanvasShowManagerSectionDuration(second.show, second.show.sections[0]!.id, 4)).toBeNull()
    expect(second.show.mediaElements).toMatchObject([
      { showStartSec: 0, showEndSec: 7 },
      { showStartSec: 8, showEndSec: 16 },
    ])
  })

  it('normalizes malformed persistence, retains stale media IDs safely, and derives active elements', () => {
    const normalized = normalizeCanvasShowManagerShow({
      schemaVersion: 1,
      id: 'legacy-show',
      name: 'Legacy',
      sections: [],
      mediaElements: [
        { id: 'valid', mediaId: 'missing-media', layer: 99, showStartSec: 0, showEndSec: 8, sourceInSec: null, sourceOutSec: null },
        { id: 'overlap', mediaId: 'other', layer: 3, showStartSec: 4, showEndSec: 6 },
        { id: 'nan', mediaId: 'bad', layer: 0, showStartSec: Number.NaN, showEndSec: 3 },
      ],
    })

    expect(normalized.schemaVersion).toBe(CANVAS_SHOW_MANAGER_SCHEMA_VERSION)
    expect(normalized.mediaElements).toHaveLength(1)
    expect(normalized.mediaElements[0]).toMatchObject({ id: 'valid', mediaId: 'missing-media', layer: 3 })
    expect(getActiveCanvasShowManagerMediaElements(normalized, 4)).toHaveLength(1)
    expect(findCanvasShowManagerMediaReferences([normalized], 'missing-media'))
      .toEqual([{ showId: 'legacy-show', showName: 'Legacy', elementIds: ['valid'] }])
  })

  it('keeps unknown video duration as an explicit unresolved source-out state', () => {
    const created = addElement(createCanvasShowManagerShow('Unknown Duration'), {
      mediaId: 'unknown-video', layer: 2, showStartSec: 0, showEndSec: 8, timedVideo: true,
    })
    expect(created.element).toMatchObject({ sourceInSec: 0, sourceOutSec: null })
  })

  it('refuses canonical shared-media deletion while a Canvas Show still references it', () => {
    const created = addElement(createCanvasShowManagerShow('Protected'), {
      mediaId: 'protected-media', layer: 0, showStartSec: 0, showEndSec: 8, timedVideo: false,
    })
    const guard = createCanvasShowManagerMediaDeletionGuard(() => ({ canvasShowManagerShows: [created.show] }))
    const media = { id: 'protected-media', name: 'protected.png' } as UploadedMedia
    expect(guard(media)).toMatchObject({
      allowed: false,
      warning: { itemId: 'protected-media', action: 'confirm-reference-removal' },
    })
  })
})
