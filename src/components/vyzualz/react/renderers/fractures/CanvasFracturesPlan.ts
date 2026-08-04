import {
  createSeededRandom,
  hashSeed,
} from '../cinematic/worlds/reactiveConstellation/ConstellationMath'
import type {
  CanvasFractureAnchorMode,
  CanvasFracturePlacementMode,
  CanvasFractureQualityMode,
} from '../../ReactTypes'
import { resolveCanvasFracturesEffectAssignment } from './CanvasFracturesEffects'
import {
  clampFracturesUnit,
  resolveCanvasFracturesSourcePath,
  roundFractures,
} from './CanvasFracturesTransforms'
import type {
  CanvasFractureCrop,
  CanvasFractureFragment,
  CanvasFractureLayoutPlacement,
  CanvasFracturePoint,
  CanvasFractureResolvedPlacementMode,
  CanvasFractureShapeFamily,
  CanvasFractureTopologyFragment,
  CanvasFractureTransform,
  CanvasFracturesAnchorPresentation,
  CanvasFracturesLayoutPlan,
  CanvasFracturesPlan,
  CanvasFracturesPlanInput,
  CanvasFracturesTopologyPlan,
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

const RESOLVED_PLACEMENT_MODES: readonly CanvasFractureResolvedPlacementMode[] = [
  'balanced',
  'offscreenSpill',
  'heavyOverlap',
  'anchorCover',
  'repeatedCrops',
  'mirrorFlip',
]

const COMPOSITION_ZONES = [
  { id: 'center', x: 0.5, y: 0.5 },
  { id: 'upper-left', x: 0.25, y: 0.25 },
  { id: 'upper-right', x: 0.75, y: 0.25 },
  { id: 'lower-left', x: 0.25, y: 0.75 },
  { id: 'lower-right', x: 0.75, y: 0.75 },
  { id: 'left-rail', x: 0.12, y: 0.5 },
  { id: 'right-rail', x: 0.88, y: 0.5 },
  { id: 'top-rail', x: 0.5, y: 0.12 },
  { id: 'bottom-rail', x: 0.5, y: 0.88 },
] as const

type CandidateBounds = { left: number; top: number; right: number; bottom: number; area: number }

export interface CanvasFractureCandidateScoreInput {
  fragment: CanvasFractureTopologyFragment
  transform: CanvasFractureTransform
  mode: CanvasFractureResolvedPlacementMode
  focusX: number
  focusY: number
  focusProtection: number
  composition: number
  placedBounds: readonly CandidateBounds[]
  zoneOccupancy: Readonly<Record<string, number>>
  zoneId: string
}

export interface CanvasFractureCandidateScore {
  score: number
  visibleAreaRatio: number
  overlapRatio: number
  bounds: CandidateBounds
}

export function stableCanvasFracturesHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function identityHash(prefix: string, value: string): string {
  return `${prefix}:${stableCanvasFracturesHash(value).toString(16).padStart(8, '0')}:${value.length}`
}

function topologyIdentityKey(input: CanvasFracturesPlanInput): string | number {
  return input.topologyIdentityKey ?? roundFractures(Math.max(0, input.transportPositionSec ?? 0), 3)
}

function layoutIdentityKey(input: CanvasFracturesPlanInput): string | number {
  return input.layoutIdentityKey ?? roundFractures(Math.max(0, input.transportPositionSec ?? 0), 3)
}

function serializeTopologyIdentity(input: CanvasFracturesPlanInput): string {
  return [
    input.presetId,
    input.sourceIdentity,
    Math.max(0, Math.floor(input.mediaRevision ?? 0)),
    input.trackIdentity ?? 'track:none',
    topologyIdentityKey(input),
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
    layoutIdentityKey(input),
    Math.max(0, Math.floor(input.layoutRevision)),
    roundFractures(clampFracturesUnit(input.composition)),
    input.placementMode,
    input.anchorMode,
    input.returnToAnchor === true ? 'anchor:return' : 'anchor:free',
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
    if (overlap * protection < bestScore) {
      best = candidate
      bestScore = overlap * protection
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
    centerX: roundFractures(Number.isFinite(centerX) ? centerX : 0.5),
    centerY: roundFractures(Number.isFinite(centerY) ? centerY : 0.5),
    scale: roundFractures(Math.max(0.05, Number.isFinite(scale) ? scale : 1)),
    rotationDeg: roundFractures(Number.isFinite(rotationDeg) ? rotationDeg : 0),
  }
}

function fragmentId(topologyIdentity: string, index: number): string {
  return `fracture-${index.toString(36).padStart(2, '0')}-${stableCanvasFracturesHash(`${topologyIdentity}:${index}`).toString(36)}`
}

export function generateCanvasFracturesTopology(input: CanvasFracturesPlanInput): CanvasFracturesTopologyPlan {
  const signature = serializeTopologyIdentity(input)
  const identity = identityHash('fractures-topology', signature)
  const seed = hashSeed(stableCanvasFracturesHash(signature), 0x41f3)
  const random = createSeededRandom(seed)
  const intensity = clampFracturesUnit(input.intensity)
  const protection = clampFracturesUnit(input.focusProtection)
  const focusX = clampFracturesUnit(input.focusX)
  const focusY = clampFracturesUnit(input.focusY)
  const count = resolveCanvasFracturesFragmentCount(intensity, input.quality)
  const families = buildFamilySequence(input, count, random)
  const fragments: CanvasFractureTopologyFragment[] = []

  for (let index = 0; index < count; index += 1) {
    const family = families[index]
    const id = fragmentId(identity, index)
    const duplicateEligible = index >= 5 && index % 6 === 0 && fragments.length > 2
    const repeatedSource = duplicateEligible
      ? fragments[1 + Math.floor(random() * Math.max(1, Math.min(fragments.length - 1, 6)))]
      : null
    const crop = repeatedSource
      ? { ...repeatedSource.crop }
      : index === 0
        ? createFocusCrop(family, focusX, focusY, protection)
        : randomCropForFamily(family, intensity, focusX, focusY, protection, random)
    const localCorners = makeLocalCorners(family, random)
    const effectAssignment = resolveCanvasFracturesEffectAssignment({
      presetId: input.presetId,
      sourceIdentity: input.sourceIdentity,
      topologyIdentity: identity,
      fragmentId: id,
      variationSeed: input.variationSeed,
      roleWeights: input.effectRoleWeights,
    })
    fragments.push({
      id,
      crop,
      shapeFamily: family,
      sourceCorners: mapSourceCorners(crop, localCorners),
      localCorners,
      homeTransform: makeTransform(crop.x + crop.width * 0.5, crop.y + crop.height * 0.5),
      anchorRole: index === 0 ? 'focus' : 'fragment',
      effectRole: effectAssignment.role,
      effectAssignment,
      repeatedFromFragmentId: repeatedSource?.id ?? null,
    })
  }

  return { identity, seed, fragments }
}

function candidateBounds(fragment: CanvasFractureTopologyFragment, transform: CanvasFractureTransform): CandidateBounds {
  const radians = transform.rotationDeg * Math.PI / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const rawWidth = fragment.crop.width * transform.scale
  const rawHeight = fragment.crop.height * transform.scale
  const width = Math.max(1e-5, rawWidth * cos + rawHeight * sin)
  const height = Math.max(1e-5, rawWidth * sin + rawHeight * cos)
  return {
    left: transform.centerX - width * 0.5,
    top: transform.centerY - height * 0.5,
    right: transform.centerX + width * 0.5,
    bottom: transform.centerY + height * 0.5,
    area: width * height,
  }
}

function intersectionArea(a: CandidateBounds, b: CandidateBounds): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return width * height
}

export function resolveCanvasFracturesVisibleAreaRatio(
  fragment: CanvasFractureTopologyFragment,
  transform: CanvasFractureTransform,
): number {
  const bounds = candidateBounds(fragment, transform)
  const visible = intersectionArea(bounds, { left: 0, top: 0, right: 1, bottom: 1, area: 1 })
  return Math.min(1, Math.max(0, visible / Math.max(1e-6, bounds.area)))
}

function focusBounds(focusX: number, focusY: number, protection: number): CandidateBounds {
  const radius = 0.08 + clampFracturesUnit(protection) * 0.2
  return {
    left: focusX - radius,
    top: focusY - radius,
    right: focusX + radius,
    bottom: focusY + radius,
    area: radius * radius * 4,
  }
}

function minimumVisibleArea(mode: CanvasFractureResolvedPlacementMode, composition: number, focus: boolean): number {
  if (focus) return 0.9
  const chaos = clampFracturesUnit(composition)
  if (mode === 'offscreenSpill') return 0.38 - chaos * 0.16
  if (mode === 'heavyOverlap') return 0.58 - chaos * 0.12
  if (mode === 'anchorCover') return 0.62 - chaos * 0.12
  return 0.72 - chaos * 0.16
}

export function scoreCanvasFractureCandidate(input: CanvasFractureCandidateScoreInput): CanvasFractureCandidateScore {
  const bounds = candidateBounds(input.fragment, input.transform)
  const visibleAreaRatio = resolveCanvasFracturesVisibleAreaRatio(input.fragment, input.transform)
  let overlapWeighted = 0
  let maxOverlap = 0
  for (const placed of input.placedBounds) {
    const overlap = intersectionArea(bounds, placed) / Math.max(1e-6, Math.min(bounds.area, placed.area))
    overlapWeighted += overlap
    maxOverlap = Math.max(maxOverlap, overlap)
  }
  const overlapRatio = input.placedBounds.length > 0 ? overlapWeighted / input.placedBounds.length : 0
  const focalOverlap = intersectionArea(bounds, focusBounds(input.focusX, input.focusY, input.focusProtection))
    / Math.max(1e-6, bounds.area)
  const distanceFromHome = Math.hypot(
    input.transform.centerX - input.fragment.homeTransform.centerX,
    input.transform.centerY - input.fragment.homeTransform.centerY,
  )
  const distanceFromAnchor = Math.hypot(
    input.transform.centerX - input.focusX,
    input.transform.centerY - input.focusY,
  )
  const edgeDistance = Math.min(
    input.transform.centerX,
    1 - input.transform.centerX,
    input.transform.centerY,
    1 - input.transform.centerY,
  )
  const occupancy = input.zoneOccupancy[input.zoneId] ?? 0
  const chaos = clampFracturesUnit(input.composition)
  const focus = input.fragment.anchorRole === 'focus'
  const minimumVisible = minimumVisibleArea(input.mode, chaos, focus)

  if (!Number.isFinite(bounds.area) || bounds.area <= 0 || visibleAreaRatio < minimumVisible) {
    return { score: 1e6 + (minimumVisible - visibleAreaRatio) * 1e5, visibleAreaRatio, overlapRatio, bounds }
  }

  let score = occupancy * (input.mode === 'heavyOverlap' ? 0.12 : 0.55)
  const scaleDistance = Math.abs(input.transform.scale - 1)
  const rotationDistance = Math.abs(input.transform.rotationDeg) / 30

  switch (input.mode) {
    case 'balanced':
      score += overlapWeighted * (4.6 - chaos * 1.6)
      score += Math.max(0, 0.72 - visibleAreaRatio) * 7
      score += distanceFromHome * (1.4 - chaos * 0.7)
      score += focalOverlap * input.focusProtection * (focus ? -2 : 3.2)
      score += rotationDistance * 0.7 + scaleDistance * 0.65
      break
    case 'offscreenSpill': {
      const desiredVisible = 0.62 - chaos * 0.16
      score += Math.abs(visibleAreaRatio - desiredVisible) * 3.4
      score += overlapWeighted * 1.8
      score += Math.abs(edgeDistance - (-0.02 + chaos * -0.05)) * 1.7
      score += focalOverlap * input.focusProtection * 1.4
      break
    }
    case 'heavyOverlap': {
      const desiredOverlap = 0.2 + chaos * 0.28
      score += Math.abs(overlapRatio - desiredOverlap) * 4
      score += Math.max(0, maxOverlap - (0.72 + chaos * 0.16)) * 8
      score += distanceFromAnchor * 0.4
      score += focalOverlap * input.focusProtection * 0.9
      break
    }
    case 'anchorCover':
      score += Math.abs(distanceFromAnchor - (0.1 + (1 - chaos) * 0.08)) * 3.1
      score += overlapWeighted * 0.75
      score += focalOverlap * input.focusProtection * (1.9 - chaos * 1.2)
      score += Math.max(0, maxOverlap - 0.84) * 9
      break
    case 'repeatedCrops':
      score += overlapWeighted * 2.25
      score += occupancy * 0.7
      score += Math.abs(distanceFromHome - (0.18 + chaos * 0.16)) * 1.2
      score += focalOverlap * input.focusProtection * 2.4
      break
    case 'mirrorFlip':
      score += overlapWeighted * 3.2
      score += distanceFromHome * 0.95
      score += focalOverlap * input.focusProtection * 2.5
      score += rotationDistance * 0.5
      break
  }

  if (focus) {
    score += distanceFromAnchor * 8
    score += Math.max(0, scaleDistance - 0.16) * 10
    score += overlapWeighted * 2.5
  }
  score += Math.max(0, 0.25 - bounds.area) * 0.03
  return { score, visibleAreaRatio, overlapRatio, bounds }
}

function resolvedModeForFragment(
  placementMode: CanvasFracturePlacementMode,
  layoutSeed: number,
  fragmentId: string,
): CanvasFractureResolvedPlacementMode {
  if (placementMode !== 'randomMix') return placementMode
  const index = stableCanvasFracturesHash(`${layoutSeed}:${fragmentId}:mode`) % RESOLVED_PLACEMENT_MODES.length
  return RESOLVED_PLACEMENT_MODES[index]
}

function zoneForFragment(
  mode: CanvasFractureResolvedPlacementMode,
  fragment: CanvasFractureTopologyFragment,
  index: number,
  layoutSeed: number,
) {
  if (fragment.anchorRole === 'focus') return COMPOSITION_ZONES[0]
  const hash = stableCanvasFracturesHash(`${layoutSeed}:${fragment.id}:zone:${index}`)
  if (mode === 'anchorCover' || mode === 'heavyOverlap') {
    return COMPOSITION_ZONES[hash % 5]
  }
  if (mode === 'offscreenSpill') {
    return COMPOSITION_ZONES[5 + (hash % 4)]
  }
  return COMPOSITION_ZONES[1 + (hash % (COMPOSITION_ZONES.length - 1))]
}

function generateCandidateTransforms(input: {
  fragment: CanvasFractureTopologyFragment
  mode: CanvasFractureResolvedPlacementMode
  zone: (typeof COMPOSITION_ZONES)[number]
  focusX: number
  focusY: number
  composition: number
  random: () => number
  index: number
}): CanvasFractureTransform[] {
  const { fragment, mode, zone, focusX, focusY, random } = input
  const chaos = clampFracturesUnit(input.composition)
  if (fragment.anchorRole === 'focus') {
    return [
      makeTransform(focusX, focusY, 1.02 + chaos * 0.08, 0),
      makeTransform(fragment.homeTransform.centerX, fragment.homeTransform.centerY, 1, 0),
      makeTransform(focusX + (random() - 0.5) * 0.04, focusY + (random() - 0.5) * 0.04, 1.04, (random() - 0.5) * 3),
    ]
  }

  const candidates: CanvasFractureTransform[] = [fragment.homeTransform]
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const jitter = 0.08 + chaos * 0.22
    let centerX = zone.x + (random() - 0.5) * jitter
    let centerY = zone.y + (random() - 0.5) * jitter
    let scale = 0.9 + (random() - 0.5) * (0.16 + chaos * 0.44)
    let rotationRange = 5 + chaos * 18

    if (mode === 'balanced' || mode === 'mirrorFlip') {
      const homeWeight = 0.55 - chaos * 0.25
      centerX = centerX * (1 - homeWeight) + fragment.homeTransform.centerX * homeWeight
      centerY = centerY * (1 - homeWeight) + fragment.homeTransform.centerY * homeWeight
      centerX = Math.min(0.96, Math.max(0.04, centerX))
      centerY = Math.min(0.96, Math.max(0.04, centerY))
      rotationRange = 3 + chaos * 11
    } else if (mode === 'offscreenSpill') {
      const overshoot = 0.02 + random() * (0.14 + chaos * 0.18)
      if (zone.id === 'left-rail') centerX = -overshoot
      else if (zone.id === 'right-rail') centerX = 1 + overshoot
      else if (zone.id === 'top-rail') centerY = -overshoot
      else centerY = 1 + overshoot
      scale = 0.96 + random() * (0.18 + chaos * 0.3)
      rotationRange = 8 + chaos * 20
    } else if (mode === 'heavyOverlap') {
      const clusterX = zone.x * 0.55 + focusX * 0.45
      const clusterY = zone.y * 0.55 + focusY * 0.45
      centerX = clusterX + (random() - 0.5) * (0.14 + chaos * 0.1)
      centerY = clusterY + (random() - 0.5) * (0.14 + chaos * 0.1)
      scale = 0.98 + random() * (0.22 + chaos * 0.32)
    } else if (mode === 'anchorCover') {
      centerX = focusX + (random() - 0.5) * (0.28 + chaos * 0.26)
      centerY = focusY + (random() - 0.5) * (0.28 + chaos * 0.26)
      scale = 0.94 + random() * (0.22 + chaos * 0.3)
    } else if (mode === 'repeatedCrops') {
      const orbit = (input.index * 2.399963 + attempt * 0.47) % (Math.PI * 2)
      const radius = 0.18 + chaos * 0.18 + (attempt % 3) * 0.04
      centerX = focusX + Math.cos(orbit) * radius
      centerY = focusY + Math.sin(orbit) * radius
      scale = 0.86 + random() * (0.25 + chaos * 0.18)
      rotationRange = 5 + chaos * 14
    }

    candidates.push(makeTransform(
      centerX,
      centerY,
      scale,
      (random() * 2 - 1) * rotationRange,
    ))
  }
  return candidates
}

export function generateCanvasFracturesLayout(
  input: CanvasFracturesPlanInput,
  topology: CanvasFracturesTopologyPlan,
): CanvasFracturesLayoutPlan {
  const signature = serializeLayoutIdentity(input, topology.identity)
  const identity = identityHash('fractures-layout', signature)
  const seed = hashSeed(stableCanvasFracturesHash(signature), 0x9d27)
  const random = createSeededRandom(seed)
  const focusX = clampFracturesUnit(input.focusX)
  const focusY = clampFracturesUnit(input.focusY)
  const focusProtection = clampFracturesUnit(input.focusProtection)
  const composition = clampFracturesUnit(input.composition)
  const returnToAnchor = input.returnToAnchor === true
  const placedBounds: CandidateBounds[] = []
  const zoneOccupancy: Record<string, number> = {}
  const placementsById = new Map<string, CanvasFractureLayoutPlacement>()
  const ordered = [...topology.fragments].sort((a, b) => {
    if (a.anchorRole !== b.anchorRole) return a.anchorRole === 'focus' ? -1 : 1
    const areaA = a.crop.width * a.crop.height
    const areaB = b.crop.width * b.crop.height
    return areaB - areaA || a.id.localeCompare(b.id)
  })

  ordered.forEach((fragment, orderedIndex) => {
    const mode = resolvedModeForFragment(input.placementMode, seed, fragment.id)
    const zone = zoneForFragment(mode, fragment, orderedIndex, seed)
    let selectedTransform = fragment.homeTransform
    let selectedScore: CanvasFractureCandidateScore | null = null

    if (returnToAnchor) {
      selectedTransform = makeTransform(
        fragment.homeTransform.centerX,
        fragment.homeTransform.centerY,
        fragment.anchorRole === 'focus' ? 1.015 : 1,
        0,
      )
      selectedScore = scoreCanvasFractureCandidate({
        fragment,
        transform: selectedTransform,
        mode: 'balanced',
        focusX,
        focusY,
        focusProtection,
        composition: 0,
        placedBounds,
        zoneOccupancy,
        zoneId: 'anchor',
      })
    } else {
      const candidates = generateCandidateTransforms({
        fragment,
        mode,
        zone,
        focusX,
        focusY,
        composition,
        random,
        index: orderedIndex,
      })
      for (const transform of candidates) {
        const scored = scoreCanvasFractureCandidate({
          fragment,
          transform,
          mode,
          focusX,
          focusY,
          focusProtection,
          composition,
          placedBounds,
          zoneOccupancy,
          zoneId: zone.id,
        })
        if (!selectedScore || scored.score < selectedScore.score) {
          selectedTransform = transform
          selectedScore = scored
        }
      }
    }

    const score = selectedScore ?? scoreCanvasFractureCandidate({
      fragment,
      transform: selectedTransform,
      mode,
      focusX,
      focusY,
      focusProtection,
      composition,
      placedBounds,
      zoneOccupancy,
      zoneId: zone.id,
    })
    placedBounds.push(score.bounds)
    zoneOccupancy[zone.id] = (zoneOccupancy[zone.id] ?? 0) + 1
    const mirrorHash = stableCanvasFracturesHash(`${identity}:${fragment.id}:mirror`)
    const mirrorEnabled = mode === 'mirrorFlip'
    placementsById.set(fragment.id, {
      fragmentId: fragment.id,
      targetTransform: selectedTransform,
      mirrorX: mirrorEnabled && ((mirrorHash & 1) === 1 || orderedIndex === 1),
      mirrorY: mirrorEnabled && (mirrorHash & 2) === 2,
      depth: fragment.anchorRole === 'focus'
        ? topology.fragments.length + 1
        : mode === 'heavyOverlap'
          ? stableCanvasFracturesHash(`${identity}:${fragment.id}:depth`) % topology.fragments.length
          : orderedIndex,
      resolvedPlacementMode: mode,
      visibleAreaRatio: roundFractures(score.visibleAreaRatio),
      overlapRatio: roundFractures(score.overlapRatio),
      compositionZone: returnToAnchor ? 'anchor' : zone.id,
    })
  })

  return {
    identity,
    topologyIdentity: topology.identity,
    seed,
    placementMode: input.placementMode,
    returnToAnchor,
    placements: topology.fragments.map(fragment => placementsById.get(fragment.id)!),
  }
}

export function composeCanvasFracturesPlan(
  input: CanvasFracturesPlanInput,
  topology: CanvasFracturesTopologyPlan,
  layout: CanvasFracturesLayoutPlan,
): CanvasFracturesPlan {
  const placements = new Map(layout.placements.map(placement => [placement.fragmentId, placement]))
  const fragments: CanvasFractureFragment[] = topology.fragments.map(fragment => {
    const placement = placements.get(fragment.id)
    if (!placement) throw new Error(`Missing Fractures layout placement for ${fragment.id}`)
    return {
      ...fragment,
      currentTransform: placement.targetTransform,
      targetTransform: placement.targetTransform,
      opacity: 1,
      mirrorX: placement.mirrorX,
      mirrorY: placement.mirrorY,
      depth: placement.depth,
      resolvedPlacementMode: placement.resolvedPlacementMode,
      visibleAreaRatio: placement.visibleAreaRatio,
      overlapRatio: placement.overlapRatio,
      compositionZone: placement.compositionZone,
    }
  })

  const effectIdentity = topology.fragments
    .map(fragment => `${fragment.id}:${fragment.effectRole}:${fragment.effectAssignment.seed}:${fragment.effectAssignment.modifiers}:${fragment.effectAssignment.blendMode}`)
    .join('|')

  return {
    id: identityHash('fractures-plan', `${topology.identity}|${layout.identity}|${effectIdentity}`),
    topologyIdentity: topology.identity,
    layoutIdentity: layout.identity,
    seed: stableCanvasFracturesHash(`${topology.seed}:${layout.seed}`),
    topologySeed: topology.seed,
    layoutSeed: layout.seed,
    sourceIdentity: input.sourceIdentity,
    sourcePath: resolveCanvasFracturesSourcePath(input.mediaType),
    mediaRevision: Math.max(0, Math.floor(input.mediaRevision ?? 0)),
    anchor: resolveCanvasFracturesAnchorPresentation(input.anchorMode),
    placementMode: input.placementMode,
    returnToAnchor: layout.returnToAnchor,
    fragments,
    transition: null,
  }
}

export function generateCanvasFracturesPlan(input: CanvasFracturesPlanInput): CanvasFracturesPlan {
  const topology = generateCanvasFracturesTopology(input)
  const layout = generateCanvasFracturesLayout(input, topology)
  return composeCanvasFracturesPlan(input, topology, layout)
}
