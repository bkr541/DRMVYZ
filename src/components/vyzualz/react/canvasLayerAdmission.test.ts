import { beforeEach, describe, expect, it } from 'vitest'
import type { CanvasMediaItem } from './ReactTypes'
import {
  clearCanvasLayerAdmissionCacheForTests,
  getCanvasLayerAdmissionDecision,
  getCanvasTransparentPngVerification,
  hasCanvasPngSignature,
  isCanvasPngLayerCandidate,
  setCanvasTransparentPngVerificationForTests,
} from './canvasLayerAdmission'

function media(overrides: Partial<CanvasMediaItem> = {}): CanvasMediaItem {
  return {
    id: 'candidate',
    name: 'candidate.png',
    type: 'image',
    objectUrl: 'blob:candidate.png',
    mimeType: 'image/png',
    createdAt: new Date(0).toISOString(),
    ...overrides,
  }
}

const emptySlots = {
  authoredLayers: [],
  renderMode: 'single' as const,
  activeCanvasMediaId: null,
}

beforeEach(() => clearCanvasLayerAdmissionCacheForTests())

describe('CANVAS layer admission', () => {
  it('admits only a verified transparent PNG while capacity is available', () => {
    const candidate = media()
    setCanvasTransparentPngVerificationForTests(candidate, true)
    expect(getCanvasTransparentPngVerification(candidate)).toBe(true)
    expect(getCanvasLayerAdmissionDecision({
      candidate,
      verifiedTransparentPng: getCanvasTransparentPngVerification(candidate),
      ...emptySlots,
    }).eligible).toBe(true)
  })

  it('fails closed for unknown or verified-opaque PNG transparency', () => {
    const candidate = media()
    expect(getCanvasTransparentPngVerification(candidate)).toBeNull()
    expect(getCanvasLayerAdmissionDecision({
      candidate,
      verifiedTransparentPng: null,
      ...emptySlots,
    }).eligible).toBe(false)

    setCanvasTransparentPngVerificationForTests(candidate, false)
    expect(getCanvasLayerAdmissionDecision({
      candidate,
      verifiedTransparentPng: getCanvasTransparentPngVerification(candidate),
      ...emptySlots,
    }).eligible).toBe(false)
  })

  it('rejects non-PNG media and conflicting non-PNG MIME metadata', () => {
    expect(isCanvasPngLayerCandidate(media({ type: 'video', mimeType: 'video/mp4', name: 'clip.png' }))).toBe(false)
    expect(isCanvasPngLayerCandidate(media({ mimeType: 'image/webp', name: 'looks-like.png' }))).toBe(false)
    expect(isCanvasPngLayerCandidate(media({ mimeType: null, name: 'fallback.png' }))).toBe(true)
  })

  it('counts only the current single-media composition and ignores stale authored layers', () => {
    const candidate = media({ id: 'candidate' })
    const authoredLayers = ['a', 'b', 'c'].map((mediaId, order) => ({
      id: `layer-${mediaId}`,
      mediaId,
      order,
      enabled: true,
      solo: false,
      ownership: 'manual' as const,
      pinned: true,
    }))
    expect(getCanvasLayerAdmissionDecision({
      candidate,
      verifiedTransparentPng: true,
      authoredLayers,
      renderMode: 'single',
      activeCanvasMediaId: 'primary',
    })).toMatchObject({ eligible: true, occupiedSlots: 1, requiredSlots: 1, hasCapacity: true })
  })

  it('does not let disabled or solo-hidden authored layers consume active-media capacity', () => {
    const candidate = media()
    const authoredLayers = [
      { id: 'layer-a', mediaId: 'a', order: 0, enabled: true, solo: false, ownership: 'manual' as const, pinned: true },
      { id: 'layer-b', mediaId: 'b', order: 1, enabled: false, solo: false, ownership: 'manual' as const, pinned: true },
      { id: 'layer-c', mediaId: 'c', order: 2, enabled: true, solo: false, ownership: 'manual' as const, pinned: true },
      { id: 'layer-d', mediaId: 'd', order: 3, enabled: true, solo: false, ownership: 'manual' as const, pinned: true },
    ]

    expect(getCanvasLayerAdmissionDecision({
      candidate, verifiedTransparentPng: true, authoredLayers, renderMode: 'layers', activeCanvasMediaId: null,
    })).toMatchObject({ eligible: true, occupiedSlots: 3, requiredSlots: 1, hasCapacity: true })

    expect(getCanvasLayerAdmissionDecision({
      candidate,
      verifiedTransparentPng: true,
      authoredLayers: authoredLayers.map(layer => ({ ...layer, enabled: true, solo: layer.id === 'layer-c' })),
      renderMode: 'layers',
      activeCanvasMediaId: null,
    })).toMatchObject({ eligible: true, occupiedSlots: 1, requiredSlots: 1, hasCapacity: true })
  })

  it('rejects a fifth authored slot and allows one slot after removal', () => {
    const candidate = media()
    const four = ['a', 'b', 'c', 'd'].map((mediaId, order) => ({
      id: `layer-${mediaId}`,
      mediaId,
      order,
      enabled: true,
      solo: false,
      ownership: 'manual' as const,
      pinned: true,
    }))
    expect(getCanvasLayerAdmissionDecision({
      candidate, verifiedTransparentPng: true, authoredLayers: four, renderMode: 'layers', activeCanvasMediaId: null,
    }).eligible).toBe(false)
    expect(getCanvasLayerAdmissionDecision({
      candidate, verifiedTransparentPng: true, authoredLayers: four.slice(0, 3), renderMode: 'layers', activeCanvasMediaId: null,
    }).eligible).toBe(true)
  })

  it('checks the actual PNG file signature instead of trusting an extension alone', () => {
    expect(hasCanvasPngSignature(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
    expect(hasCanvasPngSignature(new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70]))).toBe(false)
  })
})
