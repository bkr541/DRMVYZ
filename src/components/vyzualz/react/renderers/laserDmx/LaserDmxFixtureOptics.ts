export type LaserDmxOpticalDistribution = 'prism' | 'line' | 'grid' | 'burst' | 'multiAperture'
export type LaserDmxSpectralChannel = 'full' | 'red' | 'green' | 'blue'

export interface LaserDmxOpticalCopyDescriptor {
  index: number
  distribution: LaserDmxOpticalDistribution
  angularOffsetDeg: { yaw: number; pitch: number }
  originOffset: { x: number; y: number; z: number }
  spectralChannel: LaserDmxSpectralChannel
  intensityScale: number
}

export interface CreateLaserDmxOpticalCopiesInput {
  distribution: LaserDmxOpticalDistribution
  copyCount: number
  spreadDeg: number
  totalEnergy?: number
  spectralSeparationDeg?: number
  apertureSpacing?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function squareGridCount(copyCount: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(1, copyCount))))
}

function baseOffsets(input: CreateLaserDmxOpticalCopiesInput): Array<Pick<LaserDmxOpticalCopyDescriptor, 'angularOffsetDeg' | 'originOffset'>> {
  const count = Math.max(1, Math.min(25, Math.round(input.copyCount)))
  const spread = clamp(input.spreadDeg, 0, 60)
  if (input.distribution === 'line') {
    return Array.from({ length: count }, (_, index) => {
      const t = count <= 1 ? 0 : index / (count - 1) - 0.5
      return { angularOffsetDeg: { yaw: t * spread, pitch: 0 }, originOffset: { x: 0, y: 0, z: 0 } }
    })
  }
  if (input.distribution === 'grid') {
    const side = squareGridCount(count)
    return Array.from({ length: count }, (_, index) => {
      const x = index % side
      const y = Math.floor(index / side)
      const tx = side <= 1 ? 0 : x / (side - 1) - 0.5
      const ty = side <= 1 ? 0 : y / (side - 1) - 0.5
      return { angularOffsetDeg: { yaw: tx * spread, pitch: ty * spread }, originOffset: { x: 0, y: 0, z: 0 } }
    })
  }
  if (input.distribution === 'burst' || input.distribution === 'prism') {
    return Array.from({ length: count }, (_, index) => {
      if (count === 1) return { angularOffsetDeg: { yaw: 0, pitch: 0 }, originOffset: { x: 0, y: 0, z: 0 } }
      const angle = (index / count) * Math.PI * 2
      const radius = input.distribution === 'prism' ? spread * 0.5 : spread
      return {
        angularOffsetDeg: { yaw: Math.cos(angle) * radius, pitch: Math.sin(angle) * radius },
        originOffset: { x: 0, y: 0, z: 0 },
      }
    })
  }
  const spacing = clamp(input.apertureSpacing ?? 0.012, 0, 0.08)
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1) - 0.5
    return { angularOffsetDeg: { yaw: 0, pitch: 0 }, originOffset: { x: t * spacing, y: 0, z: 0 } }
  })
}

export function createLaserDmxOpticalCopies(input: CreateLaserDmxOpticalCopiesInput): LaserDmxOpticalCopyDescriptor[] {
  const offsets = baseOffsets(input)
  const totalEnergy = clamp(input.totalEnergy ?? 1, 0, 1.5)
  const energyPerCopy = totalEnergy / Math.max(1, offsets.length)
  const spectral = clamp(input.spectralSeparationDeg ?? 0, 0, 1.2)
  const channels: LaserDmxSpectralChannel[] = spectral > 0 ? ['red', 'green', 'blue'] : ['full']
  const result: LaserDmxOpticalCopyDescriptor[] = []
  offsets.forEach((offset, copyIndex) => {
    channels.forEach((spectralChannel, spectralIndex) => {
      const spectralYaw = spectralChannel === 'red' ? -spectral : spectralChannel === 'blue' ? spectral : 0
      result.push({
        index: result.length,
        distribution: input.distribution,
        angularOffsetDeg: {
          yaw: offset.angularOffsetDeg.yaw + spectralYaw,
          pitch: offset.angularOffsetDeg.pitch,
        },
        originOffset: offset.originOffset,
        spectralChannel,
        intensityScale: energyPerCopy / channels.length,
      })
    })
  })
  return result
}

export function sumLaserDmxOpticalCopyEnergy(copies: readonly LaserDmxOpticalCopyDescriptor[]): number {
  return copies.reduce((sum, copy) => sum + copy.intensityScale, 0)
}
