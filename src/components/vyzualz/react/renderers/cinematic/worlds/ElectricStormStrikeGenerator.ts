export const ELECTRIC_STORM_MAX_ACTIVE_STRIKES = 3
export const ELECTRIC_STORM_HISTORY_LIMIT = 8

const ELECTRIC_STORM_MAX_PENDING_REQUESTS = 4
const ELECTRIC_STORM_CANDIDATE_ATTEMPTS = 8

export type ElectricStormStrikeOrientation = 'vertical' | 'horizontal' | 'diagonal'
export type ElectricStormStrikePlacement = 'edgeToEdge' | 'edgeToInterior' | 'interiorToEdge' | 'interiorToInterior'
export type ElectricStormStrikeTier = 'strong' | 'medium' | 'micro' | 'hero'
export type ElectricStormStrikeLengthClass = 'short' | 'medium' | 'long'

export interface ElectricStormPoint {
  x: number
  y: number
}

export interface ElectricStormStrikeDescriptor {
  start: ElectricStormPoint
  end: ElectricStormPoint
  startedAtSec: number
  durationSec: number
  intensity: number
  seed: number
  branchSeed: number
  branchDetail: number
  thicknessMultiplier: number
  glowMultiplier: number
  orientation: ElectricStormStrikeOrientation
  placement: ElectricStormStrikePlacement
  lengthClass: ElectricStormStrikeLengthClass
  tier: ElectricStormStrikeTier
  power: number
  groupId: number | null
  signature: string
}

export interface ElectricStormStrikeIntent {
  tier: ElectricStormStrikeTier
  power?: number
  count?: number
  detail?: number
  durationScale?: number
}

export interface ElectricStormStrikeGeneratorOptions {
  /** Internal deterministic input for tests. Runtime callers should omit it. */
  sessionSeed?: number
}

interface ElectricStormHistoryEntry {
  signature: string
  orientation: ElectricStormStrikeOrientation
  placement: ElectricStormStrikePlacement
  startRegion: string
  endRegion: string
  lengthClass: ElectricStormStrikeLengthClass
}

interface StrikeCandidateInput {
  seed: number
  startedAtSec: number
  rate: number
  tier: ElectricStormStrikeTier
  power: number
  groupId: number | null
  detail?: number
  durationScale?: number
}

interface BoundaryDistances {
  negative: number
  positive: number
}

const electricStormRuntimeEntropy = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0
let electricStormSessionCounter = 0

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

function hash32(value: number): number {
  let x = value >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

function random01(seed: number): number {
  return hash32(seed) / 0x100000000
}

function freshSessionSeed(): number {
  electricStormSessionCounter = (electricStormSessionCounter + 1) >>> 0
  return hash32((electricStormRuntimeEntropy + Math.imul(electricStormSessionCounter, 0x9e3779b1)) >>> 0)
}

function weightedChoice<T>(seed: number, choices: readonly (readonly [T, number])[]): T {
  const total = choices.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  let cursor = random01(seed) * total
  for (const [choice, weight] of choices) {
    cursor -= Math.max(0, weight)
    if (cursor <= 0) return choice
  }
  return choices[choices.length - 1][0]
}

function orientationFor(seed: number): ElectricStormStrikeOrientation {
  return weightedChoice(seed, [
    ['diagonal', 0.44],
    ['vertical', 0.31],
    ['horizontal', 0.25],
  ] as const)
}

function placementFor(seed: number, tier: ElectricStormStrikeTier): ElectricStormStrikePlacement {
  if (tier === 'micro') {
    return weightedChoice(seed, [
      ['interiorToInterior', 0.52],
      ['edgeToInterior', 0.2],
      ['interiorToEdge', 0.2],
      ['edgeToEdge', 0.08],
    ] as const)
  }
  if (tier === 'hero') {
    return weightedChoice(seed, [
      ['edgeToEdge', 0.44],
      ['edgeToInterior', 0.21],
      ['interiorToEdge', 0.21],
      ['interiorToInterior', 0.14],
    ] as const)
  }
  return weightedChoice(seed, [
    ['edgeToEdge', 0.32],
    ['edgeToInterior', 0.24],
    ['interiorToEdge', 0.24],
    ['interiorToInterior', 0.2],
  ] as const)
}

function tierFor(seed: number, rate: number): ElectricStormStrikeTier {
  const strongWeight = mix(0.18, 0.34, rate)
  const microWeight = mix(0.3, 0.18, rate)
  return weightedChoice(seed, [
    ['medium', 0.52],
    ['strong', strongWeight],
    ['micro', microWeight],
  ] as const)
}

function angleFor(seed: number, orientation: ElectricStormStrikeOrientation): number {
  const jitter = mix(-1, 1, random01(seed ^ 0xb5297a4d))
  if (orientation === 'vertical') return Math.PI * 0.5 + jitter * 0.2
  if (orientation === 'horizontal') return jitter * 0.2
  const diagonalBase = random01(seed ^ 0x68e31da4) < 0.5 ? Math.PI * 0.25 : Math.PI * 0.75
  return diagonalBase + jitter * 0.17
}

function boundaryDistances(midpoint: ElectricStormPoint, direction: ElectricStormPoint): BoundaryDistances {
  const distances = (sign: -1 | 1): number => {
    const dx = direction.x * sign
    const dy = direction.y * sign
    const tx = Math.abs(dx) < 0.00001 ? Number.POSITIVE_INFINITY : ((dx > 0 ? 1 : -1) - midpoint.x) / dx
    const ty = Math.abs(dy) < 0.00001 ? Number.POSITIVE_INFINITY : ((dy > 0 ? 1 : -1) - midpoint.y) / dy
    return Math.max(0, Math.min(tx > 0 ? tx : Number.POSITIVE_INFINITY, ty > 0 ? ty : Number.POSITIVE_INFINITY))
  }
  return { negative: distances(-1), positive: distances(1) }
}

function linePoint(midpoint: ElectricStormPoint, direction: ElectricStormPoint, distance: number): ElectricStormPoint {
  return {
    x: clamp(midpoint.x + direction.x * distance, -1, 1),
    y: clamp(midpoint.y + direction.y * distance, -1, 1),
  }
}

function endpointsFor(
  seed: number,
  orientation: ElectricStormStrikeOrientation,
  placement: ElectricStormStrikePlacement,
  tier: ElectricStormStrikeTier,
  power: number,
): { start: ElectricStormPoint; end: ElectricStormPoint } {
  const angle = angleFor(seed, orientation)
  const directionSign = random01(seed ^ 0x53a9b4fb) < 0.5 ? -1 : 1
  const direction = { x: Math.cos(angle) * directionSign, y: Math.sin(angle) * directionSign }
  const midpoint = {
    x: mix(-0.24, 0.24, random01(seed ^ 0x1b56c4e9)),
    y: mix(-0.24, 0.24, random01(seed ^ 0x7f4a7c15)),
  }
  const distances = boundaryDistances(midpoint, direction)
  const interiorMin = tier === 'micro' ? 0.2 : 0.42
  const interiorMax = tier === 'micro' ? 0.58 : 0.82
  const traversalBoost = mix(0.78, 1.08, clamp01(power))
  const startFraction = clamp(mix(interiorMin, interiorMax, random01(seed ^ 0xc2b2ae35)) * traversalBoost, 0.12, 0.96)
  const endFraction = clamp(mix(interiorMin, interiorMax, random01(seed ^ 0x27d4eb2f)) * traversalBoost, 0.12, 0.96)
  const negativeBoundary = linePoint(midpoint, direction, -distances.negative)
  const positiveBoundary = linePoint(midpoint, direction, distances.positive)
  const negativeInterior = linePoint(midpoint, direction, -distances.negative * startFraction)
  const positiveInterior = linePoint(midpoint, direction, distances.positive * endFraction)
  const start = placement === 'edgeToEdge' || placement === 'edgeToInterior' ? negativeBoundary : negativeInterior
  const end = placement === 'edgeToEdge' || placement === 'interiorToEdge' ? positiveBoundary : positiveInterior
  return { start, end }
}

function pointRegion(point: ElectricStormPoint): string {
  const edgeThreshold = 0.985
  if (point.x <= -edgeThreshold) return 'left'
  if (point.x >= edgeThreshold) return 'right'
  if (point.y <= -edgeThreshold) return 'bottom'
  if (point.y >= edgeThreshold) return 'top'
  const horizontal = point.x < -0.28 ? 'left' : point.x > 0.28 ? 'right' : 'center'
  const vertical = point.y < -0.28 ? 'bottom' : point.y > 0.28 ? 'top' : 'middle'
  return `${vertical}-${horizontal}`
}

function lengthClassFor(start: ElectricStormPoint, end: ElectricStormPoint): ElectricStormStrikeLengthClass {
  const distance = Math.hypot(start.x - end.x, start.y - end.y)
  if (distance < 0.92) return 'short'
  if (distance < 1.62) return 'medium'
  return 'long'
}

function tierDuration(seed: number, tier: ElectricStormStrikeTier, rate: number, power: number, durationScale = 1): number {
  const random = random01(seed ^ 0x85ebca6b)
  const boundedScale = clamp(durationScale, 0.4, 1.35)
  if (tier === 'micro') return mix(0.08, 0.2, random) * mix(0.88, 1.08, power) * boundedScale
  if (tier === 'strong' || tier === 'hero') return mix(0.22, 0.46, random) * mix(0.94, 1.16, rate) * mix(0.94, 1.12, power) * boundedScale
  return mix(0.15, 0.36, random) * mix(0.92, 1.12, rate) * mix(0.92, 1.08, power) * boundedScale
}

function tierIntensity(seed: number, tier: ElectricStormStrikeTier, power: number): number {
  const random = random01(seed ^ 0xcb1ab31f)
  const base = tier === 'micro'
    ? mix(0.38, 0.64, random)
    : tier === 'medium'
      ? mix(0.58, 0.86, random)
      : mix(0.76, 1, random)
  return base * mix(0.72, 1.18, clamp01(power))
}

function createCandidate(input: StrikeCandidateInput): ElectricStormStrikeDescriptor {
  const orientation = orientationFor(input.seed ^ 0x8da6b343)
  const placement = placementFor(input.seed ^ 0xd8163841, input.tier)
  const endpoints = endpointsFor(input.seed ^ 0xa511e9b3, orientation, placement, input.tier, input.power)
  const startRegion = pointRegion(endpoints.start)
  const endRegion = pointRegion(endpoints.end)
  const lengthClass = lengthClassFor(endpoints.start, endpoints.end)
  const branchSeed = hash32(input.seed ^ 0x63d83595)
  const randomBranchDetail = mix(0.34, 1, random01(input.seed ^ 0x9e3779b9))
  const branchDetail = input.detail === undefined
    ? randomBranchDetail
    : clamp01(mix(randomBranchDetail, clamp01(input.detail), 0.68))
  const thicknessBase = input.tier === 'micro' ? 0.64 : input.tier === 'medium' ? 0.9 : 1.08
  const glowBase = input.tier === 'micro' ? 0.62 : input.tier === 'medium' ? 0.9 : 1.12
  const signature = `${placement}|${orientation}|${startRegion}>${endRegion}|${lengthClass}`
  return {
    ...endpoints,
    startedAtSec: input.startedAtSec,
    durationSec: tierDuration(input.seed, input.tier, input.rate, input.power, input.durationScale),
    intensity: tierIntensity(input.seed, input.tier, input.power),
    seed: input.seed >>> 0,
    branchSeed,
    branchDetail,
    thicknessMultiplier: thicknessBase * mix(0.86, 1.14, input.power),
    glowMultiplier: glowBase * mix(0.86, 1.16, input.power),
    orientation,
    placement,
    lengthClass,
    tier: input.tier,
    power: input.power,
    groupId: input.groupId,
    signature,
  }
}

function historyEntry(strike: ElectricStormStrikeDescriptor): ElectricStormHistoryEntry {
  return {
    signature: strike.signature,
    orientation: strike.orientation,
    placement: strike.placement,
    startRegion: pointRegion(strike.start),
    endRegion: pointRegion(strike.end),
    lengthClass: strike.lengthClass,
  }
}

function repetitionScore(candidate: ElectricStormStrikeDescriptor, history: readonly ElectricStormHistoryEntry[]): number {
  let score = 0
  const startRegion = pointRegion(candidate.start)
  const endRegion = pointRegion(candidate.end)
  for (let index = history.length - 1, distance = 0; index >= 0; index -= 1, distance += 1) {
    const previous = history[index]
    const recency = Math.max(1, ELECTRIC_STORM_HISTORY_LIMIT - distance)
    if (previous.signature === candidate.signature) score += recency * 8
    if (previous.orientation === candidate.orientation && previous.placement === candidate.placement) score += recency * 2.2
    if (previous.startRegion === startRegion && previous.endRegion === endRegion) score += recency * 1.6
    if (previous.lengthClass === candidate.lengthClass) score += recency * 0.25
  }
  return score
}

/**
 * Procedural Electric Storm scheduler. Each generated descriptor owns stable
 * topology seeds for its lifetime; the renderer only animates its envelope.
 * Runtime instances receive a fresh non-persisted session seed, while tests
 * can provide an internal deterministic session seed without exposing a UI
 * or persistence contract.
 */
export class ElectricStormStrikeGenerator {
  private bucket = Number.NaN
  private active: ElectricStormStrikeDescriptor[] = []
  private history: ElectricStormHistoryEntry[] = []
  private pending: ElectricStormStrikeIntent[] = []
  private eventOrdinal = 0
  private readonly sessionSeed: number

  constructor(options: ElectricStormStrikeGeneratorOptions = {}) {
    this.sessionSeed = options.sessionSeed === undefined ? freshSessionSeed() : options.sessionSeed >>> 0
  }

  /** Stage 3 boundary: request event intent without giving the generator audio-analysis ownership. */
  request(intent: ElectricStormStrikeIntent): void {
    if (this.pending.length >= ELECTRIC_STORM_MAX_PENDING_REQUESTS) return
    this.pending.push({
      tier: intent.tier,
      power: clamp(intent.power ?? 1, 0, 1),
      count: Math.max(1, Math.min(ELECTRIC_STORM_MAX_ACTIVE_STRIKES, Math.floor(intent.count ?? (intent.tier === 'hero' ? 2 : 1)))),
      detail: intent.detail === undefined ? undefined : clamp01(intent.detail),
      durationScale: intent.durationScale === undefined ? undefined : clamp(intent.durationScale, 0.4, 1.35),
    })
  }

  update(timeSec: number, strikeRate: number): readonly ElectricStormStrikeDescriptor[] {
    const safeTime = Math.max(0, Number.isFinite(timeSec) ? timeSec : 0)
    const rate = clamp01(strikeRate)
    const intervalSec = mix(1.8, 0.42, rate)
    const bucket = Math.floor(safeTime / intervalSec)
    const sequenceSeed = this.sessionSeed

    this.pruneExpired(safeTime)
    this.drainPending(safeTime, rate, sequenceSeed)

    if (bucket !== this.bucket) {
      this.bucket = bucket
      const available = Math.max(0, ELECTRIC_STORM_MAX_ACTIVE_STRIKES - this.active.length)
      if (available > 0) {
        const generated = this.generateBucket(bucket, intervalSec, rate, sequenceSeed, available)
        this.appendActive(generated)
      }
    }

    return this.active
  }

  reset(): void {
    this.bucket = Number.NaN
    this.active = []
    this.history = []
    this.pending = []
    this.eventOrdinal = 0
  }

  getDiagnostics(): Readonly<{ activeCount: number; historyCount: number; pendingRequestCount: number }> {
    return {
      activeCount: this.active.length,
      historyCount: this.history.length,
      pendingRequestCount: this.pending.length,
    }
  }

  private pruneExpired(timeSec: number): void {
    let writeIndex = 0
    for (let readIndex = 0; readIndex < this.active.length; readIndex += 1) {
      const strike = this.active[readIndex]
      if (timeSec > strike.startedAtSec + strike.durationSec) continue
      if (writeIndex !== readIndex) this.active[writeIndex] = strike
      writeIndex += 1
    }
    this.active.length = writeIndex
  }

  private appendActive(generated: readonly ElectricStormStrikeDescriptor[]): void {
    if (generated.length === 0) return
    this.active.push(...generated)
    this.active.sort((a, b) => a.startedAtSec - b.startedAtSec)
    if (this.active.length > ELECTRIC_STORM_MAX_ACTIVE_STRIKES) {
      this.active.splice(0, this.active.length - ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
    }
  }

  private drainPending(timeSec: number, rate: number, sequenceSeed: number): void {
    const requestedCount = this.pending.length
    for (let requestIndex = 0; requestIndex < requestedCount; requestIndex += 1) {
      const intent = this.pending[requestIndex]
      const available = ELECTRIC_STORM_MAX_ACTIVE_STRIKES - this.active.length
      if (available <= 0) continue
      const count = Math.min(intent.count ?? 1, available)
      const groupId = count > 1 ? hash32(sequenceSeed ^ Math.imul(this.eventOrdinal + 1, 0x45d9f3b)) : null
      const generated: ElectricStormStrikeDescriptor[] = []
      for (let ordinal = 0; ordinal < count; ordinal += 1) {
        const strikeSeed = hash32(sequenceSeed ^ Math.imul(this.eventOrdinal + 17, 0x27d4eb2d) ^ Math.imul(ordinal + 3, 0x165667b1))
        generated.push(this.generateWithAntiRepeat({
          seed: strikeSeed,
          startedAtSec: timeSec + ordinal * 0.018,
          rate,
          tier: intent.tier,
          power: intent.power ?? 1,
          groupId,
          detail: intent.detail,
          durationScale: intent.durationScale,
        }))
      }
      this.eventOrdinal += 1
      this.appendActive(generated)
    }
    if (requestedCount > 0) this.pending.splice(0, requestedCount)
  }

  private generateBucket(
    bucket: number,
    intervalSec: number,
    rate: number,
    seed: number,
    available: number,
  ): ElectricStormStrikeDescriptor[] {
    const bucketSeed = hash32(seed ^ Math.imul(bucket + 29, 0x9e3779b1))
    const opportunity = random01(bucketSeed ^ 0x68bc21eb)
    const probability = mix(0.18, 0.88, rate)
    if (opportunity > probability) return []

    let count = 1
    if (rate > 0.55 && random01(bucketSeed ^ 0x02e5be93) < (rate - 0.45) * 0.65) count += 1
    if (rate > 0.82 && random01(bucketSeed ^ 0x967a889b) < (rate - 0.75) * 0.8) count += 1
    count = Math.min(available, ELECTRIC_STORM_MAX_ACTIVE_STRIKES, count)

    const bucketStartSec = bucket * intervalSec
    const groupId = count > 1 ? hash32(bucketSeed ^ 0x6d2b79f5) : null
    return Array.from({ length: count }, (_, ordinal) => {
      const strikeSeed = hash32(bucketSeed ^ Math.imul(ordinal + 11, 0x27d4eb2d))
      const tier = tierFor(strikeSeed ^ 0x4cf5ad43, rate)
      const power = mix(0.58, 1, random01(strikeSeed ^ 0x94d049bb))
      const startOffset = intervalSec * mix(0.04, 0.36, random01(strikeSeed ^ 0xcb1ab31f))
      return this.generateWithAntiRepeat({
        seed: strikeSeed,
        startedAtSec: bucketStartSec + startOffset + ordinal * 0.035,
        rate,
        tier,
        power,
        groupId,
      })
    })
  }

  private generateWithAntiRepeat(input: StrikeCandidateInput): ElectricStormStrikeDescriptor {
    let best = createCandidate(input)
    let bestScore = repetitionScore(best, this.history)
    for (let attempt = 1; attempt < ELECTRIC_STORM_CANDIDATE_ATTEMPTS && bestScore > 0; attempt += 1) {
      const candidate = createCandidate({ ...input, seed: hash32(input.seed ^ Math.imul(attempt + 1, 0x85ebca77)) })
      const score = repetitionScore(candidate, this.history)
      if (score < bestScore) {
        best = candidate
        bestScore = score
      }
    }
    this.history.push(historyEntry(best))
    if (this.history.length > ELECTRIC_STORM_HISTORY_LIMIT) {
      this.history.splice(0, this.history.length - ELECTRIC_STORM_HISTORY_LIMIT)
    }
    return best
  }
}
