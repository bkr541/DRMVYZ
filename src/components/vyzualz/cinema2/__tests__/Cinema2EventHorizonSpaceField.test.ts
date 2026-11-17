import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCinema2EventHorizonSpaceGlb } from '../modules/eventHorizon/Cinema2EventHorizonSpaceField'

const shipped = () => {
  const file = readFileSync('public/cinema2/models/event-horizon-space.glb')
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
}

describe('Event Horizon space.glb (the supplied galaxy)', () => {
  const field = parseCinema2EventHorizonSpaceGlb(shipped())

  it('reads all 50,000 stars with finite positions and colors in range', () => {
    expect(field.count).toBe(50000)
    expect(field.positions.length).toBe(150000)
    expect(field.positions.every(Number.isFinite)).toBe(true)
    expect(field.colors.every(value => value >= 0 && value <= 1)).toBe(true)
    expect(field.random.every(value => value >= 0 && value < 1)).toBe(true)
  })

  it('centres the galaxy on the black hole and scales it so 99% of the stars are within radius 1', () => {
    const centre = [0, 1, 2].map(a => { let sum = 0; for (let i = 0; i < field.count; i += 1) sum += field.positions[i * 3 + a]!; return sum / field.count })
    for (const value of centre) expect(Math.abs(value)).toBeLessThan(1e-3)
    const radial = Float32Array.from(field.radial).sort()
    expect(radial[Math.floor(field.count * 0.99)]).toBeCloseTo(1, 2)
    expect(radial[0]).toBeGreaterThanOrEqual(0)
  })

  it('keeps the galaxy a flat spiral disk with Y as its axis', () => {
    let spread = [0, 0, 0]
    for (let i = 0; i < field.count; i += 1) for (let a = 0; a < 3; a += 1) spread[a]! += Math.abs(field.positions[i * 3 + a]!) / field.count
    expect(spread[1]!).toBeLessThan(spread[0]! * 0.6)
    expect(spread[1]!).toBeLessThan(spread[2]! * 0.6)
  })

  it('stores the stars in a fixed random order, so the first stars are a fair sample of all of them', () => {
    const again = parseCinema2EventHorizonSpaceGlb(shipped())
    expect(Array.from(again.positions.slice(0, 30))).toEqual(Array.from(field.positions.slice(0, 30)))
    const mean = (n: number) => { let sum = 0; for (let i = 0; i < n; i += 1) sum += field.radial[i]!; return sum / n }
    expect(Math.abs(mean(5000) - mean(field.count))).toBeLessThan(0.03)
  })

  it('rejects files that are not a point-cloud GLB', () => {
    expect(() => parseCinema2EventHorizonSpaceGlb(new ArrayBuffer(32))).toThrow(/not a GLB/)
    const bytes = new Uint8Array(shipped().slice(0, 60))
    expect(() => parseCinema2EventHorizonSpaceGlb(bytes.buffer)).toThrow()
  })
})
