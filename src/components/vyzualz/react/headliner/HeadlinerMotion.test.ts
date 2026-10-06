import { describe, expect, it } from 'vitest'
import {
  estimateBlockFlow,
  frameDifference,
  motionSpeed,
  smoothFlow,
  toGrayscale,
} from './HeadlinerMotion'

const WIDTH = 128
const HEIGHT = 72

function frameWithSquare(x0: number, y0: number, size = 16): Uint8Array {
  const frame = new Uint8Array(WIDTH * HEIGHT).fill(30)
  for (let y = y0; y < y0 + size; y += 1) {
    for (let x = x0; x < x0 + size; x += 1) // Non-repeating texture, so only the true shift matches.
      frame[y * WIDTH + x] = 40 + ((((x - x0) * 73856093) ^ ((y - y0) * 19349663)) >>> 0) % 200
  }
  return frame
}

describe('Headliner motion analysis', () => {
  it('converts RGBA to luminance', () => {
    const out = new Uint8Array(2)
    toGrayscale([255, 255, 255, 255, 0, 0, 0, 255], out)
    expect(out[0]).toBeGreaterThan(250)
    expect(out[1]).toBe(0)
  })

  it('sees no movement between identical frames and plenty between different ones', () => {
    const a = frameWithSquare(20, 20)
    const b = frameWithSquare(30, 20)
    const still = new Uint8Array(a.length)
    frameDifference(a, a, still)
    expect(motionSpeed(still)).toBe(0)
    const moved = new Uint8Array(a.length)
    frameDifference(b, a, moved)
    expect(motionSpeed(moved)).toBeGreaterThan(0.05)
  })

  it('measures the direction of a patch that moved right and down', () => {
    const previous = frameWithSquare(40, 24)
    const current = frameWithSquare(43, 26)
    const flow = new Float32Array(32 * 18 * 2)
    const { cols, rows } = estimateBlockFlow(current, previous, WIDTH, HEIGHT, flow)
    expect({ cols, rows }).toEqual({ cols: 32, rows: 18 })
    // A cell well inside the square, away from its edges.
    const slot = (Math.floor(32 / 4) * cols + Math.floor(49 / 4)) * 2
    expect(flow[slot]).toBeGreaterThan(1)
    expect(flow[slot + 1]).toBeGreaterThan(0)
    // Far from the square nothing moves.
    expect(flow[0]).toBe(0)
    expect(flow[1]).toBe(0)
  })

  it('treats sensor noise below the floor as standing still', () => {
    const previous = new Uint8Array(WIDTH * HEIGHT).fill(100)
    const current = new Uint8Array(WIDTH * HEIGHT).fill(103)
    const flow = new Float32Array(32 * 18 * 2).fill(9)
    estimateBlockFlow(current, previous, WIDTH, HEIGHT, flow)
    expect(flow.every(value => value === 0)).toBe(true)
  })

  it('smooths the running flow toward each new field', () => {
    const next = new Float32Array(32 * 18 * 2).fill(4)
    const running = new Float32Array(next.length)
    smoothFlow(next, running, 32, 18, 0.5)
    expect(running[40]).toBeGreaterThan(1.5)
    expect(running[40]).toBeLessThan(4)
    for (let i = 0; i < 20; i += 1) smoothFlow(next, running, 32, 18, 0.5)
    expect(running[40]).toBeCloseTo(4, 1)
  })
})
