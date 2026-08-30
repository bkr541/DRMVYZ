import { beforeEach, describe, expect, it } from 'vitest'
import type { CanvasMediaItem } from './ReactTypes'
import {
  clearCanvasLayerAdmissionCacheForTests,
  getCanvasAuthoredLayerCandidateKind,
  getCanvasLayerAdmissionDecision,
  getCanvasTransparentPngVerification,
  hasCanvasPngSignature,
  isCanvasPngLayerCandidate,
  isCanvasSvgLayerCandidate,
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
  it('keeps verified transparent PNG admission intact while capacity is available', () => {
    const candidate = media()
    setCanvasTransparentPngVerificationForTests(candidate, true)
    expect(getCanvasTransparentPngVerification(candidate)).toBe(true)
    expect(getCanvasLayerAdmissionDecision({
      candidate,
      verifiedTransparentPng: getCanvasTransparentPngVerification(candidate),
      ...emptySlots,
    })).toMatchObject({ eligible: true, candidateKind: 'png' })
  })

  it('admits canonical SVG media without PNG transparency verification', () => {
    const candidate = media({
      name: 'candidate.svg',
      type: 'svg',
      objectUrl: 'blob:candidate.svg',
      mimeType: 'image/svg+xml',
    })

    expect(isCanvasSvgLayerCandidate(candidate)).toBe(true)
    expect(getCanvasAuthoredLayerCandidateKind(candidate)).toBe('svg')
    expect(getCanvasTransparentPngVerification(candidate)).toBe(false)
    expect(getCanvasLayerAdmissionDecision({
      candidate,
      verifiedTransparentPng: getCanvasTransparentPngVerification(candidate),
      ...emptySlots,
    })).toMatchObject({ eligible: true, candidateKind: 'svg', hasCapacity: true })
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

  it('rejects unsupported authored-layer media while preserving PNG metadata checks', () => {
    const video = media({ type: 'video', mimeType: 'video/mp4', name: 'clip.png' })
    const webp = media({ mimeType: 'image/webp', name: 'looks-like.png' })
    const jpeg = media({ mimeType: 'image/jpeg', name: 'still.jpg', objectUrl: 'blob:still.jpg' })

    expect(isCanvasPngLayerCandidate(video)).toBe(false)
    expect(isCanvasPngLayerCandidate(webp)).toBe(false)
    expect(isCanvasPngLayerCandidate(media({ mimeType: null, name: 'fallback.png' }))).toBe(true)
    expect(getCanvasAuthoredLayerCandidateKind(video)).toBeNull()
    expect(getCanvasAuthoredLayerCandidateKind(webp)).toBeNull()
    expect(getCanvasAuthoredLayerCandidateKind(jpeg)).toBeNull()
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

  it('applies the same four-active-media capacity to SVG candidates', () => {
    const candidate = media({
      name: 'fifth.svg',
      type: 'svg',
      objectUrl: 'blob:fifth.svg',
      mimeType: 'image/svg+xml',
    })
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
      candidate, verifiedTransparentPng: false, authoredLayers: four, renderMode: 'layers', activeCanvasMediaId: null,
    })).toMatchObject({ eligible: false, candidateKind: 'svg', occupiedSlots: 4, hasCapacity: false })
    expect(getCanvasLayerAdmissionDecision({
      candidate, verifiedTransparentPng: false, authoredLayers: four.slice(0, 3), renderMode: 'layers', activeCanvasMediaId: null,
    })).toMatchObject({ eligible: true, candidateKind: 'svg', occupiedSlots: 3, hasCapacity: true })
  })

  it('checks the actual PNG file signature instead of trusting an extension alone', () => {
    expect(hasCanvasPngSignature(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
    expect(hasCanvasPngSignature(new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70]))).toBe(false)
  })
})
