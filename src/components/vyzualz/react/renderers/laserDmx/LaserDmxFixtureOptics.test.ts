import { describe, expect, it } from 'vitest'
import { createLaserDmxOpticalCopies, sumLaserDmxOpticalCopyEnergy } from './LaserDmxFixtureOptics'

describe('LaserDMX explicit fixture optics', () => {
  it.each([
    ['prism', 5],
    ['line', 5],
    ['grid', 9],
    ['burst', 7],
  ] as const)('creates bounded %s optical copies', (distribution, copyCount) => {
    const copies = createLaserDmxOpticalCopies({ distribution, copyCount, spreadDeg: 12 })
    expect(copies).toHaveLength(copyCount)
    expect(sumLaserDmxOpticalCopyEnergy(copies)).toBeCloseTo(1, 6)
  })

  it('uses distinct physical origins for multiple apertures', () => {
    const copies = createLaserDmxOpticalCopies({ distribution: 'multiAperture', copyCount: 3, spreadDeg: 0, apertureSpacing: 0.02 })
    expect(new Set(copies.map(copy => copy.originOffset.x))).toHaveLength(3)
    expect(copies.every(copy => copy.angularOffsetDeg.yaw === 0)).toBe(true)
  })

  it('applies restrained fixture-level spectral separation without adding energy', () => {
    const copies = createLaserDmxOpticalCopies({ distribution: 'line', copyCount: 2, spreadDeg: 4, spectralSeparationDeg: 0.25 })
    expect(copies).toHaveLength(6)
    expect(new Set(copies.map(copy => copy.spectralChannel))).toEqual(new Set(['red', 'green', 'blue']))
    expect(sumLaserDmxOpticalCopyEnergy(copies)).toBeCloseTo(1, 6)
  })
})
