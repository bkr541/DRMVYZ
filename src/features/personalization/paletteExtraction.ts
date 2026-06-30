import type {
  BrandPalette,
  BrandPaletteAnalysis,
  BrandPaletteCandidateId,
  ExtractedColorSwatch,
} from './BrandKitTypes'
import {
  boostHexChroma,
  colorChroma,
  hexToRgb,
  mixHex,
  normalizeHexColor,
  oklabDistance,
  oklabToRgb,
  readableTextColor,
  rgbToHex,
  rgbToOklab,
  type OklabColor,
  type RgbColor,
} from './paletteColorSpace'

export const PALETTE_EXTRACTION_ALGORITHM_VERSION = 'drmvyz-oklab-1'
const MAX_ANALYSIS_SIDE = 192
const MAX_SAMPLES = 12_000
const MAX_SWATCHES = 8
const TRANSPARENT_ALPHA_CUTOFF = 24
const NEAR_DUPLICATE_DISTANCE = 0.035

interface WeightedPixel {
  rgb: RgbColor
  lab: OklabColor
  weight: number
}

interface Cluster {
  center: OklabColor
  members: WeightedPixel[]
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }

function isExtremeNeutral(lab: OklabColor): boolean {
  return colorChroma(lab) < 0.025 && (lab.l > 0.93 || lab.l < 0.08)
}

function deterministicSamples(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): { samples: WeightedPixel[]; ignoredTransparentPixels: number } {
  const total = Math.max(0, width * height)
  const stride = Math.max(1, Math.ceil(total / MAX_SAMPLES))
  const preliminary: WeightedPixel[] = []
  let ignoredTransparentPixels = 0
  let extremeNeutralCount = 0

  for (let pixel = 0; pixel < total; pixel += stride) {
    const offset = pixel * 4
    const alpha = rgba[offset + 3] ?? 0
    if (alpha < TRANSPARENT_ALPHA_CUTOFF) {
      ignoredTransparentPixels += 1
      continue
    }
    const rgb = { r: rgba[offset], g: rgba[offset + 1], b: rgba[offset + 2] }
    const lab = rgbToOklab(rgb)
    if (isExtremeNeutral(lab)) extremeNeutralCount += 1
    preliminary.push({ rgb, lab, weight: alpha / 255 })
  }

  const neutralShare = preliminary.length ? extremeNeutralCount / preliminary.length : 0
  return {
    ignoredTransparentPixels,
    samples: preliminary.map(sample => ({
      ...sample,
      weight: sample.weight * (neutralShare > 0.45 && isExtremeNeutral(sample.lab) ? 0.12 : 1),
    })),
  }
}

function selectInitialCenters(samples: WeightedPixel[], count: number): OklabColor[] {
  if (!samples.length) return []
  const sorted = [...samples].sort((a, b) => {
    const usefulnessA = a.weight * (0.2 + colorChroma(a.lab))
    const usefulnessB = b.weight * (0.2 + colorChroma(b.lab))
    return usefulnessB - usefulnessA || a.lab.l - b.lab.l || a.lab.a - b.lab.a || a.lab.b - b.lab.b
  })
  const centers: OklabColor[] = [{ ...sorted[0].lab }]
  while (centers.length < count) {
    let best = sorted[0]
    let bestScore = -1
    for (const sample of sorted) {
      const nearest = Math.min(...centers.map(center => oklabDistance(sample.lab, center)))
      const score = nearest * sample.weight * (0.35 + colorChroma(sample.lab))
      if (score > bestScore) { best = sample; bestScore = score }
    }
    if (bestScore <= 0.001) break
    centers.push({ ...best.lab })
  }
  return centers
}

function clusterSamples(samples: WeightedPixel[], desiredCount: number): Cluster[] {
  let centers = selectInitialCenters(samples, Math.min(desiredCount, samples.length))
  for (let iteration = 0; iteration < 8 && centers.length; iteration += 1) {
    const members = centers.map(() => [] as WeightedPixel[])
    for (const sample of samples) {
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY
      centers.forEach((center, index) => {
        const distance = oklabDistance(sample.lab, center)
        if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index }
      })
      members[nearestIndex].push(sample)
    }
    centers = centers.map((center, index) => {
      const group = members[index]
      if (!group.length) return center
      const totalWeight = group.reduce((sum, sample) => sum + sample.weight, 0) || 1
      return group.reduce<OklabColor>((acc, sample) => ({
        l: acc.l + sample.lab.l * sample.weight / totalWeight,
        a: acc.a + sample.lab.a * sample.weight / totalWeight,
        b: acc.b + sample.lab.b * sample.weight / totalWeight,
      }), { l: 0, a: 0, b: 0 })
    })
  }

  return centers.map(center => ({
    center,
    members: samples.filter(sample => {
      const distances = centers.map(candidate => oklabDistance(sample.lab, candidate))
      return distances.indexOf(Math.min(...distances)) === centers.indexOf(center)
    }),
  })).filter(cluster => cluster.members.length > 0)
}

export function collapseNearDuplicateSwatches(swatches: ExtractedColorSwatch[]): ExtractedColorSwatch[] {
  const result: ExtractedColorSwatch[] = []
  for (const swatch of swatches) {
    const normalized = { ...swatch, hex: normalizeHexColor(swatch.hex), weight: clamp01(swatch.weight) }
    const duplicate = result.find(existing =>
      oklabDistance(rgbToOklab(hexToRgb(existing.hex)), rgbToOklab(hexToRgb(normalized.hex))) < NEAR_DUPLICATE_DISTANCE
    )
    if (duplicate) {
      duplicate.population += normalized.population
      duplicate.weight += normalized.weight
      if (normalized.chroma > duplicate.chroma) duplicate.hex = normalized.hex
      duplicate.chroma = Math.max(duplicate.chroma, normalized.chroma)
    } else {
      result.push(normalized)
    }
  }
  const total = result.reduce((sum, swatch) => sum + swatch.weight, 0) || 1
  return result.map(swatch => ({ ...swatch, weight: swatch.weight / total }))
}

function clustersToSwatches(clusters: Cluster[]): ExtractedColorSwatch[] {
  const totalWeight = clusters.reduce((sum, cluster) => sum + cluster.members.reduce((s, p) => s + p.weight, 0), 0) || 1
  const swatches = clusters.map(cluster => {
    const population = cluster.members.length
    const weight = cluster.members.reduce((sum, sample) => sum + sample.weight, 0) / totalWeight
    return {
      hex: rgbToHex(oklabToRgb(cluster.center)),
      weight,
      population,
      chroma: colorChroma(cluster.center),
    }
  }).sort((a, b) => {
    const scoreA = a.weight * (0.65 + Math.min(0.35, a.chroma * 2))
    const scoreB = b.weight * (0.65 + Math.min(0.35, b.chroma * 2))
    return scoreB - scoreA || b.population - a.population || a.hex.localeCompare(b.hex)
  })
  return collapseNearDuplicateSwatches(swatches).slice(0, MAX_SWATCHES)
}

function ensurePaletteColors(colorsInput: string[]): string[] {
  if (!colorsInput.length) return ['#808080', '#B3B3B3', '#4D4D4D']
  const colors = colorsInput.map(color => normalizeHexColor(color))
  if (colors.length === 1) return [colors[0], mixHex(colors[0], '#FFFFFF', 0.35), mixHex(colors[0], '#000000', 0.35)]
  if (colors.length === 2) colors.push(mixHex(colors[0], colors[1], 0.5))
  return colors
}

function paletteFromColors(colors: string[], variant: BrandPaletteCandidateId, monochrome: boolean): BrandPalette {
  const safe = ensurePaletteColors(colors)
  const rankedByChroma = [...safe].sort((a, b) => colorChroma(rgbToOklab(hexToRgb(b))) - colorChroma(rgbToOklab(hexToRgb(a))))
  const darkest = [...safe].sort((a, b) => rgbToOklab(hexToRgb(a)).l - rgbToOklab(hexToRgb(b)).l)[0]
  const lightest = [...safe].sort((a, b) => rgbToOklab(hexToRgb(b)).l - rgbToOklab(hexToRgb(a)).l)[0]
  const primary = rankedByChroma[0] ?? safe[0]
  const secondary = rankedByChroma[1] ?? safe[1]
  const accent = rankedByChroma[2] ?? safe[2]

  if (variant === 'stageVibrant') {
    const stagePrimary = monochrome ? mixHex(primary, '#FFFFFF', 0.12) : boostHexChroma(primary, 1.35, 0.02)
    const stageSecondary = monochrome ? mixHex(secondary, '#000000', 0.08) : boostHexChroma(secondary, 1.25, 0.01)
    const background = mixHex(darkest, '#000000', 0.7)
    return {
      primary: stagePrimary,
      secondary: stageSecondary,
      accent: monochrome ? mixHex(accent, '#FFFFFF', 0.25) : boostHexChroma(accent, 1.45, 0.04),
      background,
      highlight: mixHex(lightest, '#FFFFFF', 0.35),
      text: readableTextColor(background),
    }
  }

  if (variant === 'highContrast') {
    const background = rgbToOklab(hexToRgb(darkest)).l < 0.5 ? mixHex(darkest, '#000000', 0.82) : '#FFFFFF'
    return {
      primary,
      secondary: lightest,
      accent: rgbToOklab(hexToRgb(primary)).l > 0.65 ? darkest : lightest,
      background,
      highlight: background === '#FFFFFF' ? darkest : lightest,
      text: readableTextColor(background),
    }
  }

  const background = mixHex(darkest, '#000000', 0.45)
  return {
    primary,
    secondary,
    accent,
    background,
    highlight: lightest,
    text: readableTextColor(background),
  }
}

export function generatePaletteCandidates(swatches: ExtractedColorSwatch[]): Record<BrandPaletteCandidateId, BrandPalette> {
  const isMonochrome = swatches.every(swatch => swatch.chroma < 0.04)
  const colors = swatches.map(swatch => swatch.hex)
  return {
    faithful: paletteFromColors(colors, 'faithful', isMonochrome),
    stageVibrant: paletteFromColors(colors, 'stageVibrant', isMonochrome),
    highContrast: paletteFromColors(colors, 'highContrast', isMonochrome),
  }
}

export function extractPaletteFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  analyzedAt = new Date(0).toISOString(),
): BrandPaletteAnalysis {
  const { samples, ignoredTransparentPixels } = deterministicSamples(rgba, width, height)
  const clusters = clusterSamples(samples, Math.min(7, Math.max(3, Math.round(Math.sqrt(samples.length / 180)))))
  const swatches = clustersToSwatches(clusters)
  const isMonochrome = swatches.length === 0 || swatches.every(swatch => swatch.chroma < 0.04)
  const warnings: string[] = []
  if (!samples.length) warnings.push('No opaque pixels were available for palette analysis.')
  if (isMonochrome) warnings.push('Monochrome artwork detected; palette candidates use tonal derivatives.')
  return {
    swatches,
    candidates: generatePaletteCandidates(swatches),
    metadata: {
      algorithmVersion: PALETTE_EXTRACTION_ALGORITHM_VERSION,
      analyzedAt,
      sourceWidth: Math.max(0, Math.round(width)),
      sourceHeight: Math.max(0, Math.round(height)),
      sampledPixels: samples.length,
      ignoredTransparentPixels,
      isMonochrome,
      warnings,
    },
  }
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image decode failed')) }
    image.src = objectUrl
  })
}

export async function extractPaletteFromImageFile(file: File): Promise<BrandPaletteAnalysis> {
  const sourceBlob = /\.svg$/i.test(file.name) && file.type.toLowerCase() !== 'image/svg+xml'
    ? new Blob([await file.text()], { type: 'image/svg+xml' })
    : file
  const image = await loadImageFromBlob(sourceBlob)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) throw new Error('Image has no measurable dimensions')
  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D context unavailable')
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height)
  return extractPaletteFromRgba(pixels.data, width, height, new Date().toISOString())
}
