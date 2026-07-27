import type { PixGridLogicalFrame } from './PixGridCompositor'

export interface PixGridPerceptualDifference {
  changedCells: number
  changedCellRatio: number
  meanMaterialDelta: number
  meanLuminanceDelta: number
  centerChangedRatio: number
  borderChangedRatio: number
  upperChangedRatio: number
  lowerChangedRatio: number
}

export interface PixGridPerceptualMetricOptions {
  materialChannelDelta?: number
  materialLuminanceDelta?: number
}

function luminance(pixels: Uint8Array, offset: number): number {
  return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722
}

export function measurePixGridPerceptualDifference(
  before: PixGridLogicalFrame,
  after: PixGridLogicalFrame,
  options: PixGridPerceptualMetricOptions = {},
): PixGridPerceptualDifference {
  if (before.width !== after.width || before.height !== after.height || before.pixels.length !== after.pixels.length) {
    throw new Error('PixGrid perceptual comparison requires matching logical frame dimensions')
  }
  const materialChannelDelta = Math.max(1, options.materialChannelDelta ?? 16)
  const materialLuminanceDelta = Math.max(1, options.materialLuminanceDelta ?? 12)
  let changedCells = 0
  let materialDelta = 0
  let luminanceDelta = 0
  let center = 0
  let border = 0
  let upper = 0
  let lower = 0
  const total = before.width * before.height

  for (let y = 0; y < before.height; y += 1) {
    for (let x = 0; x < before.width; x += 1) {
      const offset = (y * before.width + x) * 4
      const dr = Math.abs(after.pixels[offset] - before.pixels[offset])
      const dg = Math.abs(after.pixels[offset + 1] - before.pixels[offset + 1])
      const db = Math.abs(after.pixels[offset + 2] - before.pixels[offset + 2])
      const da = Math.abs(after.pixels[offset + 3] - before.pixels[offset + 3])
      const dl = Math.abs(luminance(after.pixels, offset) - luminance(before.pixels, offset))
      const delta = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11 + da * da * 0.2)
      if (Math.max(dr, dg, db, da) < materialChannelDelta && dl < materialLuminanceDelta) continue
      changedCells += 1
      materialDelta += delta
      luminanceDelta += dl
      const nx = (x + 0.5) / before.width
      const ny = (y + 0.5) / before.height
      if (nx >= 0.28 && nx <= 0.72 && ny >= 0.24 && ny <= 0.76) center += 1
      if (nx <= 0.14 || nx >= 0.86 || ny <= 0.14 || ny >= 0.86) border += 1
      if (ny < 0.42) upper += 1
      if (ny > 0.58) lower += 1
    }
  }

  const denominator = Math.max(1, changedCells)
  return {
    changedCells,
    changedCellRatio: changedCells / Math.max(1, total),
    meanMaterialDelta: materialDelta / denominator,
    meanLuminanceDelta: luminanceDelta / denominator,
    centerChangedRatio: center / denominator,
    borderChangedRatio: border / denominator,
    upperChangedRatio: upper / denominator,
    lowerChangedRatio: lower / denominator,
  }
}

export function pixGridFrameMeanLuminance(frame: PixGridLogicalFrame): number {
  let sum = 0
  let count = 0
  for (let offset = 0; offset < frame.pixels.length; offset += 4) {
    if (frame.pixels[offset + 3] === 0) continue
    sum += luminance(frame.pixels, offset)
    count += 1
  }
  return sum / Math.max(1, count)
}

export function pearsonCorrelation(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  if (length < 2) return 0
  const leftMean = left.slice(0, length).reduce((sum, value) => sum + value, 0) / length
  const rightMean = right.slice(0, length).reduce((sum, value) => sum + value, 0) / length
  let covariance = 0
  let leftVariance = 0
  let rightVariance = 0
  for (let index = 0; index < length; index += 1) {
    const a = left[index] - leftMean
    const b = right[index] - rightMean
    covariance += a * b
    leftVariance += a * a
    rightVariance += b * b
  }
  const denominator = Math.sqrt(leftVariance * rightVariance)
  return denominator <= 1e-9 ? 0 : Math.max(-1, Math.min(1, covariance / denominator))
}
