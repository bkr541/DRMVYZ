import { describe, it, expect } from 'vitest'
import { selectPostProcessSource } from './postProcessSource'

// Lightweight identity tokens — selectPostProcessSource never calls any methods,
// so plain cast objects are sufficient for referential-equality assertions.
const fakeCanvas = () => ({}) as unknown as HTMLCanvasElement
const fakeVideo  = () => ({}) as unknown as HTMLVideoElement

describe('selectPostProcessSource', () => {
  it('srcSnap → fullFrame=true (Canvas 2D snapshot path)', () => {
    const snap = fakeCanvas(); const gpu = fakeCanvas(); const media = fakeVideo()
    const r = selectPostProcessSource(snap, true, gpu, media)
    expect(r.src).toBe(snap)
    expect(r.fullFrame).toBe(true)
  })

  it('gpuCanvas → fullFrame=true when isGpu=true and no srcSnap', () => {
    const gpu = fakeCanvas(); const media = fakeVideo()
    const r = selectPostProcessSource(null, true, gpu, media)
    expect(r.src).toBe(gpu)
    expect(r.fullFrame).toBe(true)
  })

  it('mediaEl → fullFrame=false when Canvas 2D mode with no srcSnap', () => {
    const media = fakeVideo()
    const r = selectPostProcessSource(null, false, null, media)
    expect(r.src).toBe(media)
    expect(r.fullFrame).toBe(false)
  })

  it('srcSnap takes priority over gpuCanvas', () => {
    const snap = fakeCanvas(); const gpu = fakeCanvas()
    const r = selectPostProcessSource(snap, true, gpu, null)
    expect(r.src).toBe(snap)
  })

  it('null src when GPU active but gpuCanvas unavailable (mid-frame context loss)', () => {
    const r = selectPostProcessSource(null, true, null, null)
    expect(r.src).toBeNull()
    expect(r.fullFrame).toBe(false)
  })

  it('mediaEl returned when isGpu=false even if gpuCanvas is provided', () => {
    const gpu = fakeCanvas(); const media = fakeVideo()
    const r = selectPostProcessSource(null, false, gpu, media)
    expect(r.src).toBe(media)
  })

  it('fullFrame=false for mediaEl path (draw-rect coordinates required)', () => {
    const media = fakeVideo()
    const { fullFrame } = selectPostProcessSource(null, false, null, media)
    expect(fullFrame).toBe(false)
  })

  it('null mediaEl returns null src when no other source available', () => {
    const r = selectPostProcessSource(null, false, null, null)
    expect(r.src).toBeNull()
    expect(r.fullFrame).toBe(false)
  })
})
