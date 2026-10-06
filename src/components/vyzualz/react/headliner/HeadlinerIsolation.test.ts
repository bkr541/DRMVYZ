import { describe, expect, it } from 'vitest'
import {
  HEADLINER_BACKGROUND_RATE_FAR,
  HEADLINER_BACKGROUND_RATE_NEAR,
  foregroundWeights,
  updateBackground,
} from './HeadlinerIsolation'
import { HeadlinerTriggerReader, fireHeadlinerTrigger } from './HeadlinerTriggers'

describe('Headliner performer isolation', () => {
  it('weights pixels by how far they sit from the learned background', () => {
    const background = new Float32Array([100, 100, 100, 100])
    const gray = new Uint8Array([100, 108, 140, 255])
    const out = new Uint8Array(4)
    foregroundWeights(background, gray, 10, 6, out)
    expect(out[0]).toBe(0)
    expect(out[1]).toBe(0)
    expect(out[2]).toBe(180)
    expect(out[3]).toBe(255)
  })

  it('learns the scene quickly where it matches and barely absorbs what stands out', () => {
    const background = new Float32Array([100, 100])
    updateBackground(background, new Uint8Array([105, 200]), 20)
    expect(background[0]).toBeCloseTo(100 + 5 * HEADLINER_BACKGROUND_RATE_NEAR)
    expect(background[1]).toBeCloseTo(100 + 100 * HEADLINER_BACKGROUND_RATE_FAR)
  })
})

describe('Headliner triggers', () => {
  it('reports each press once, and ignores presses from before the reader existed', () => {
    fireHeadlinerTrigger('capture-pose')
    const reader = new HeadlinerTriggerReader()
    expect(reader.take('capture-pose')).toBe(false)
    fireHeadlinerTrigger('capture-pose')
    fireHeadlinerTrigger('capture-pose')
    expect(reader.take('capture-pose')).toBe(true)
    expect(reader.take('capture-pose')).toBe(false)
    expect(reader.take('clear-ghosts')).toBe(false)
  })
})
