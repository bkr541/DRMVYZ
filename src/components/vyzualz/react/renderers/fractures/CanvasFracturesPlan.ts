import {
  createSeededRandom,
  hashSeed,
} from '../cinematic/worlds/reactiveConstellation/ConstellationMath'
import type {
  CanvasFractureAnchorMode,
  CanvasFractureEffectRole,
  CanvasFractureQualityMode,
} from '../../ReactTypes'
import {
  clampFracturesUnit,
  resolveCanvasFracturesSourcePath,
  roundFractures,
} from './CanvasFracturesTransforms'
import type {
  CanvasFractureCrop,
  CanvasFractureFragment,
  CanvasFracturePoint,
  CanvasFractureShapeFamily,
  CanvasFractureTransform,
  CanvasFracturesAnchorPresentation,
  CanvasFracturesPlan,
  CanvasFracturesPlanInput,
} from './CanvasFracturesTypes'

const QUALITY_CAPS: Record<CanvasFractureQualityMode, number> = {
  low: 24,
  balanced: 48,
  high: 80,
}

const RECT_CORNERS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
] as const

function stableHashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function identityHash(prefix: string, value: string): string {
  return `${prefix}:${stableHashString(value).toString(16).padStart(8, '0')}:${value.length}`
}

function serializeTopologyIdentity(input: CanvasFracturesPlanInput): string {
  return [
    input.presetId,
    input.sourceIdentity,
    Math.max(0, Math.floor(input.mediaRevision ?? 0)),
    input.trackIdentity ?? 'track:none',
    roundFractures(Math.max(0, input.transportPositionSec ?? 0), 3),
    Math.floor(input.variationSeed),
    Math.max(0, Math.floor(input.topologyRevision)),
    input.mode,
    roundFractures(clampFracturesUnit(input.intensity)),
    roundFractures(clampFracturesUnit(input.focusProtection)),
    roundFractures(clampFracturesUnit(input.focusX)),
    roundFractures(clampFracturesUnit(input.focusY)),
    input.quality,
  ].join('|')
}

function serializeLayoutIdentity(input: CanvasFracturesPlanInput, topologyIdentity: string): string {
  return [
    topologyIdentity,
    Math.max(0, Math.floor(input.layoutRevision)),
    roundFractures(clampFracturesUnit(input.composition)),
    input.placementMode,
    input.anchorMode,
  ].join('|')
}

export function resolveCanvasFracturesFragmentCount(intensity: number, quality: CanvasFractureQualityMode): number {
  const normalized = clampFracturesUnit(intensity)
  const minimum = 6
  const cap = QUALITY_CAPS[quality]
  return Math.max(minimum, Math.min(cap, Math.round(minimum + (cap - minimum) * normalized ** 1.3)))
}

export function resolveCanvasFracturesAnchorPresentation(
  mode: CanvasFractureAnchorMode,
): CanvasFracturesAnchorPresentation {
  switch (mode) {
    case 'alwaysVisible':
      return { mode, visible: true, opacity: 0.72, scale: 1 }
    case 'reactive':
      return { mode, visible: true, opacity: 0.44, scale: 0.985 }
    case 'fadeWithMusic':
      return { mode, visible: true, opacity: 0.18, scale: 1.025 }
    case 'fullyFragmented':
      return { mode, visible: false, opacity: 0, scale: 1 }
  }
}

function makeMixedFamilies(count: number, random: () => number): CanvasFractureShapeFamily[] {
  const angledCount = Math.max(1, Math.min(Math.floor(count * 0.12), 8))
  const remaining = count - angledCount
  const rectangleCount = Math.max(1, Math.round(remaining * 0.46))
  const horizontalCount = Math.max(1, Math.round((remaining - rectangleCount) * 0.5))
  const verticalCount = Math.max(1, remaining - rectangleCount - horizontalCount)
  const families: CanvasFractureShapeFamily[] = [
    ...Array.from({ length: rectangleCount }, () => 'rectangles' as const),
    ...Array.from({ length: horizontalCount }, () => 'horizontalSlices' as const),
    ...Array.from({ length: verticalCount }, () => 'verticalSlices' as const),
    ...Array.from({ length: angledCount }, () => 'angledQuads' as const),
  ]
  while (families.length > count) families.splice(Math.floor(random() * families.length), 1)
  while (families.length < count) families.push('rectangles')
  for (let index = families.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[families[index], families[swap]] = [families[swap], families[index]]
  }
  return families
}

function buildFamilySequence(input: CanvasFracturesPlanInput, count: number, random: () => number): CanvasFractureShapeFamily[] {
  if (input.mode !== 'mixed') {
    const family: CanvasFractureShapeFamily = input.mode
    return Array.from({ length: count }, () => family)
  }
  return makeMixedFamilies(count, random)
}

function protectedOverlapScore(crop: CanvasFractureCrop, focusX: number, focusY: number, protection: number): number {
  const radiusX = 0.08 + protection * 0.2
  const radiusY = 0.08 + protection * 0.2
  const left = Math.max(crop.x, focusX - radiusX)
  const right = Math.min(crop.x + crop.width, focusX + radiusX)
  const top = Math.max(crop.y, focusY - radiusY)
  const bottom = Math.min(crop.y + crop.height, focusY + radiusY)
  if (right <= left || bottom <= top) return 0
  return ((right - left) * (bottom - top)) / Math.max(1e-6, crop.width * crop.height)
}

function clampCrop(crop: CanvasFractureCrop): CanvasFractureCrop {
  const width = Math.min(1, Math.max(0.012, crop.width))
  const height = Math.min(1, Math.max(0.012, crop.height))
  return {
    x: roundFractures(Math.min(1 - width, Math.max(0, crop.x))),
    y: roundFractures(Math.min(1 - height, Math.max(0, crop.y))),
    width: roundFractures(width),
    height: roundFractures(height),
  }
}

function createFocusCrop(
  family: CanvasFractureShapeFamily,
  focusX: number,
  focusY: number,
  protection: number,
): CanvasFractureCrop {
  let width = 0.24 + protection * 0.28
  let height = 0.2 + protection * 0.24
  if (family === 'horizontalSlices') {
    width = 0.92
    height = 0.09 + protection * 0.18
  } else if (family === 'verticalSlices') {
    width = 0.09 + protection * 0.18
    height = 0.92
  } else if (family === 'angledQuads') {
    width = 0.28 + protection * 0.24
    height = 0.22 + protection * 0.2
  }
  return clampCrop({ x: focusX - width * 0.5, y: focusY - height * 0.5, width, height })
}

function randomCropForFamily(
  family: CanvasFractureShapeFamily,
  intensity: number,
  focusX: number,
  focusY: number,
  protection: number,
  random: () => number,
): CanvasFractureCrop {
  const thinness = 0.035 + (1 - intensity) * 0.05
  let best: CanvasFractureCrop | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (let attempt = 0; attempt < 7; attempt += 1) {
    let width: number
    let height: number
    if (family === 'horizontalSlices') {
      width = 0.58 + random() * 0.42
      height = thinness + random() * (0.12 + (1 - intensity) * 0.08)
    } else if (family === 'verticalSlices') {
      width = thinness + random() * (0.12 + (1 - intensity) * 0.08)
      height = 0.58 + random() * 0.42
    } else {
      const largeChance = random()
      const base = largeChance < 0.22 ? 0.2 : 0.07
      width = base + random() * (largeChance < 0.22 ? 0.3 : 0.2 - intensity * 0.06)
      height = base + random() * (largeChance < 0.22 ? 0.26 : 0.18 - intensity * 0.05)
      if (family === 'angledQuads') {
        width = Math.max(width, 0.12)
        height = Math.max(height, 0.1)
      }
    }

    const candidate = clampCrop({
      x: random() * Math.max(0, 1 - width),
      y: random() * Math.max(0, 1 - height),
      width,
      height,
    })
    const overlap = protectedOverlapScore(candidate, focusX, focusY, protection)
    const edgeBias = protection * overlap
    if (edgeBias < bestScore) {
      best = candidate
      bestScore = edgeBias
    }
    if (overlap <= (1 - protection) * 0.3) break
  }

  return best ?? clampCrop({ x: 0, y: 0, width: 0.25, height: 0.25 })
}

function makeLocalCorners(family: CanvasFractureShapeFamily, random: () => number): readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint] {
  if (family !== 'angledQuads') return RECT_CORNERS
  const inset = () => roundFractures(0.04 + random() * 0.15)
  return [
    { x: inset(), y: 0 },
    { x: 1, y: inset() },
    { x: roundFractures(1 - inset()), y: 1 },
    { x: 0, y: roundFractures(1 - inset()) },
  ]
}

function mapSourceCorners(
  crop: CanvasFractureCrop,
  localCorners: readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint],
): readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint] {
  return localCorners.map(point => ({
    x: roundFractures(crop.x + point.x * crop.width),
    y: roundFractures(crop.y + point.y * crop.height),
  })) as unknown as readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint]
}

function makeTransform(centerX: number, centerY: number, scale = 1, rotationDeg = 0): CanvasFractureTransform {
  return {
    centerX: roundFractures(centerX),
    centerY: roundFractures(centerY),
    scale: roundFractures(scale),
    rotationDeg: roundFractures(rotationDeg),
  }
}

function resolveEffectRole(index: number, family: CanvasFractureShapeFamily): CanvasFractureEffectRole {
  if (index === 0) return 'primary'
  if (family === 'angledQuads') return 'accent'
  if (family === 'horizontalSlices' || family === 'verticalSlices') return index % 3 === 0 ? 'echo' : 'support'
  return index % 4 === 0 ? 'accent' : 'support'
}

function createLayoutTransform(input: {
  home: CanvasFractureTransform
  crop: CanvasFractureCrop
  focusX: number
  focusY: number
  composition: number
  random: () => number
  index: number
}): CanvasFractureTransform {
  const chaos = clampFracturesUnit(input.composition)
  const dx = input.home.centerX - input.focusX
  const dy = input.home.centerY - input.focusY
  const distance = Math.hypot(dx, dy)
  const fallbackAngle = input.random() * Math.PI * 2
  const directionX = distance > 0.001 ? dx / distance : Math.cos(fallbackAngle)
  const directionY = distance > 0.001 ? dy / distance : Math.sin(fallbackAngle)
  const spread = (0.014 + chaos ** 1.25 * 0.34) * (0.4 + distance * 0.9) * (0.55 + input.random() * 0.9)
  const tangent = (input.random() - 0.5) * chaos * 0.14
  let centerX = input.home.centerX + directionX * spread - directionY * tangent
  let centerY = input.home.centerY + directionY * spread + directionX * tangent
  const margin = chaos < 0.55 ? 0.035 : -0.18 * ((chaos - 0.55) / 0.45)
  centerX = Math.min(1 - margin, Math.max(margin, centerX))
  centerY = Math.min(1 - margin, Math.max(margin, centerY))
  const rotationRange = 1.5 + chaos ** 1.15 * 24
  const rotationDeg = (input.random() * 2 - 1) * rotationRange * (input.index === 0 ? 0.2 : 1)
  const scaleVariance = 0.025 + chaos * 0.42
  const scale = Math.max(0.62, 1 + (input.random() * 2 - 1) * scaleVariance)
  return makeTransform(centerX, centerY, scale, rotationDeg)
}

export function generateCanvasFracturesPlan(input: CanvasFracturesPlanInput): CanvasFracturesPlan {
  const topologySignature = serializeTopologyIdentity(input)
  const topologyIdentity = identityHash('fractures-topology', topologySignature)
  const layoutSignature = serializeLayoutIdentity(input, topologyIdentity)
  const layoutIdentity = identityHash('fractures-layout', layoutSignature)
  const topologySeed = hashSeed(stableHashString(topologySignature), 0x41f3)
  const layoutSeed = hashSeed(stableHashString(layoutSignature), 0x9d27)
  const topologyRandom = createSeededRandom(topologySeed)
  const layoutRandom = createSeededRandom(layoutSeed)
  const intensity = clampFracturesUnit(input.intensity)
  const protection = clampFracturesUnit(input.focusProtection)
  const focusX = clampFracturesUnit(input.focusX)
  const focusY = clampFracturesUnit(input.focusY)
  const count = resolveCanvasFracturesFragmentCount(intensity, input.quality)
  const families = buildFamilySequence(input, count, topologyRandom)
  const fragments: CanvasFractureFragment[] = []

  for (let index = 0; index < count; index += 1) {
    const family = families[index]
    const crop = index === 0
      ? createFocusCrop(family, focusX, focusY, protection)
      : randomCropForFamily(family, intensity, focusX, focusY, protection, topologyRandom)
    const localCorners = makeLocalCorners(family, topologyRandom)
    const home = makeTransform(crop.x + crop.width * 0.5, crop.y + crop.height * 0.5)
    const target = createLayoutTransform({
      home,
      crop,
      focusX,
      focusY,
      composition: input.composition,
      random: layoutRandom,
      index,
    })
    fragments.push({
      id: `fracture-${index.toString(36).padStart(2, '0')}-${stableHashString(`${topologyIdentity}:${index}`).toString(36)}`,
      crop,
      shapeFamily: family,
      sourceCorners: mapSourceCorners(crop, localCorners),
      localCorners,
      homeTransform: home,
      currentTransform: target,
      targetTransform: target,
      opacity: 1,
      mirrorX: false,
      mirrorY: false,
      anchorRole: index === 0 ? 'focus' : 'fragment',
      depth: index,
      effectRole: resolveEffectRole(index, family),
    })
  }

  return {
    id: identityHash('fractures-plan', `${topologyIdentity}|${layoutIdentity}`),
    topologyIdentity,
    layoutIdentity,
    seed: stableHashString(`${topologySeed}:${layoutSeed}`),
    topologySeed,
    layoutSeed,
    sourceIdentity: input.sourceIdentity,
    sourcePath: resolveCanvasFracturesSourcePath(input.mediaType),
    mediaRevision: Math.max(0, Math.floor(input.mediaRevision ?? 0)),
    anchor: resolveCanvasFracturesAnchorPresentation(input.anchorMode),
    fragments,
  }
}
