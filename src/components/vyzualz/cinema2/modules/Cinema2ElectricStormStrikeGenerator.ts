import type { Cinema2ModuleRandomnessFacet } from './Cinema2ModuleContracts'
import type { Cinema2RandomStream } from '../runtime/Cinema2RandomService'

export const CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES = 3
export const CINEMA2_ELECTRIC_STORM_HISTORY_LIMIT = 8
const CANDIDATE_ATTEMPTS = 8
const MAX_PENDING_REQUESTS = 4

export type Cinema2ElectricStormStrikeOrientation = 'vertical' | 'horizontal' | 'diagonal'
export type Cinema2ElectricStormStrikePlacement = 'edgeToEdge' | 'edgeToInterior' | 'interiorToEdge' | 'interiorToInterior'
export type Cinema2ElectricStormStrikeTier = 'strong' | 'medium' | 'micro' | 'hero'
export type Cinema2ElectricStormStrikeLengthClass = 'short' | 'medium' | 'long'

export interface Cinema2ElectricStormPoint { x: number; y: number }

export interface Cinema2ElectricStormStrikeDescriptor {
  start: Cinema2ElectricStormPoint
  end: Cinema2ElectricStormPoint
  startedAtSec: number
  durationSec: number
  intensity: number
  seed: number
  branchSeed: number
  branchDetail: number
  thicknessMultiplier: number
  glowMultiplier: number
  orientation: Cinema2ElectricStormStrikeOrientation
  placement: Cinema2ElectricStormStrikePlacement
  lengthClass: Cinema2ElectricStormStrikeLengthClass
  tier: Cinema2ElectricStormStrikeTier
  power: number
  groupId: number | null
  signature: string
}

export interface Cinema2ElectricStormStrikeIntent {
  tier: Cinema2ElectricStormStrikeTier
  power?: number
  count?: number
  detail?: number
  durationScale?: number
  eventId?: string
}

interface HistoryEntry {
  signature: string
  orientation: Cinema2ElectricStormStrikeOrientation
  placement: Cinema2ElectricStormStrikePlacement
  startRegion: string
  endRegion: string
  lengthClass: Cinema2ElectricStormStrikeLengthClass
}

interface CandidateInput {
  startedAtSec: number
  rate: number
  tier: Cinema2ElectricStormStrikeTier
  power: number
  groupId: number | null
  detail?: number
  durationScale?: number
}

export interface Cinema2ElectricStormStrikeFrame {
  active: readonly Cinema2ElectricStormStrikeDescriptor[]
  started: readonly Cinema2ElectricStormStrikeDescriptor[]
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)) }
function mix(a: number, b: number, amount: number): number { return a + (b - a) * amount }
function toSeed(value: number): number { return Math.floor(clamp01(value) * 0xffffffff) >>> 0 }

function weightedChoice<T>(random: number, choices: readonly (readonly [T, number])[]): T {
  const total = choices.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  let cursor = random * total
  for (const [choice, weight] of choices) {
    cursor -= Math.max(0, weight)
    if (cursor <= 0) return choice
  }
  return choices[choices.length - 1][0]
}

function orientationFor(stream: Cinema2RandomStream): Cinema2ElectricStormStrikeOrientation {
  return weightedChoice(stream.next(), [['diagonal', 0.44], ['vertical', 0.31], ['horizontal', 0.25]] as const)
}

function placementFor(stream: Cinema2RandomStream, tier: Cinema2ElectricStormStrikeTier): Cinema2ElectricStormStrikePlacement {
  if (tier === 'micro') return weightedChoice(stream.next(), [['interiorToInterior', 0.52], ['edgeToInterior', 0.2], ['interiorToEdge', 0.2], ['edgeToEdge', 0.08]] as const)
  if (tier === 'hero') return weightedChoice(stream.next(), [['edgeToEdge', 0.44], ['edgeToInterior', 0.21], ['interiorToEdge', 0.21], ['interiorToInterior', 0.14]] as const)
  return weightedChoice(stream.next(), [['edgeToEdge', 0.32], ['edgeToInterior', 0.24], ['interiorToEdge', 0.24], ['interiorToInterior', 0.2]] as const)
}

function tierFor(random: number, rate: number): Cinema2ElectricStormStrikeTier {
  return weightedChoice(random, [['medium', 0.52], ['strong', mix(0.18, 0.34, rate)], ['micro', mix(0.3, 0.18, rate)]] as const)
}

function angleFor(stream: Cinema2RandomStream, orientation: Cinema2ElectricStormStrikeOrientation): number {
  const jitter = mix(-1, 1, stream.next())
  if (orientation === 'vertical') return Math.PI * 0.5 + jitter * 0.2
  if (orientation === 'horizontal') return jitter * 0.2
  return (stream.next() < 0.5 ? Math.PI * 0.25 : Math.PI * 0.75) + jitter * 0.17
}

function boundaryDistance(midpoint: Cinema2ElectricStormPoint, direction: Cinema2ElectricStormPoint, sign: -1 | 1): number {
  const dx = direction.x * sign
  const dy = direction.y * sign
  const tx = Math.abs(dx) < 0.00001 ? Number.POSITIVE_INFINITY : ((dx > 0 ? 1 : -1) - midpoint.x) / dx
  const ty = Math.abs(dy) < 0.00001 ? Number.POSITIVE_INFINITY : ((dy > 0 ? 1 : -1) - midpoint.y) / dy
  return Math.max(0, Math.min(tx > 0 ? tx : Number.POSITIVE_INFINITY, ty > 0 ? ty : Number.POSITIVE_INFINITY))
}

function linePoint(midpoint: Cinema2ElectricStormPoint, direction: Cinema2ElectricStormPoint, distance: number): Cinema2ElectricStormPoint {
  return { x: clamp(midpoint.x + direction.x * distance, -1, 1), y: clamp(midpoint.y + direction.y * distance, -1, 1) }
}

function endpointsFor(
  stream: Cinema2RandomStream,
  orientation: Cinema2ElectricStormStrikeOrientation,
  placement: Cinema2ElectricStormStrikePlacement,
  tier: Cinema2ElectricStormStrikeTier,
  power: number,
): { start: Cinema2ElectricStormPoint; end: Cinema2ElectricStormPoint } {
  const angle = angleFor(stream, orientation)
  const directionSign = stream.next() < 0.5 ? -1 : 1
  const direction = { x: Math.cos(angle) * directionSign, y: Math.sin(angle) * directionSign }
  const midpoint = { x: mix(-0.24, 0.24, stream.next()), y: mix(-0.24, 0.24, stream.next()) }
  const negative = boundaryDistance(midpoint, direction, -1)
  const positive = boundaryDistance(midpoint, direction, 1)
  const interiorMin = tier === 'micro' ? 0.2 : 0.42
  const interiorMax = tier === 'micro' ? 0.58 : 0.82
  const traversalBoost = mix(0.78, 1.08, clamp01(power))
  const startFraction = clamp(mix(interiorMin, interiorMax, stream.next()) * traversalBoost, 0.12, 0.96)
  const endFraction = clamp(mix(interiorMin, interiorMax, stream.next()) * traversalBoost, 0.12, 0.96)
  const negativeBoundary = linePoint(midpoint, direction, -negative)
  const positiveBoundary = linePoint(midpoint, direction, positive)
  const negativeInterior = linePoint(midpoint, direction, -negative * startFraction)
  const positiveInterior = linePoint(midpoint, direction, positive * endFraction)
  return {
    start: placement === 'edgeToEdge' || placement === 'edgeToInterior' ? negativeBoundary : negativeInterior,
    end: placement === 'edgeToEdge' || placement === 'interiorToEdge' ? positiveBoundary : positiveInterior,
  }
}

function pointRegion(point: Cinema2ElectricStormPoint): string {
  const edge = 0.985
  if (point.x <= -edge) return 'left'
  if (point.x >= edge) return 'right'
  if (point.y <= -edge) return 'bottom'
  if (point.y >= edge) return 'top'
  const horizontal = point.x < -0.28 ? 'left' : point.x > 0.28 ? 'right' : 'center'
  const vertical = point.y < -0.28 ? 'bottom' : point.y > 0.28 ? 'top' : 'middle'
  return `${vertical}-${horizontal}`
}

function lengthClassFor(start: Cinema2ElectricStormPoint, end: Cinema2ElectricStormPoint): Cinema2ElectricStormStrikeLengthClass {
  const distance = Math.hypot(start.x - end.x, start.y - end.y)
  return distance < 0.92 ? 'short' : distance < 1.62 ? 'medium' : 'long'
}

function createCandidate(stream: Cinema2RandomStream, input: CandidateInput): Cinema2ElectricStormStrikeDescriptor {
  const orientation = orientationFor(stream)
  const placement = placementFor(stream, input.tier)
  const endpoints = endpointsFor(stream, orientation, placement, input.tier, input.power)
  const startRegion = pointRegion(endpoints.start)
  const endRegion = pointRegion(endpoints.end)
  const lengthClass = lengthClassFor(endpoints.start, endpoints.end)
  const seed = toSeed(stream.next())
  const branchSeed = toSeed(stream.next())
  const randomBranchDetail = mix(0.34, 1, stream.next())
  const branchDetail = input.detail === undefined ? randomBranchDetail : clamp01(mix(randomBranchDetail, clamp01(input.detail), 0.68))
  const durationRandom = stream.next()
  const intensityRandom = stream.next()
  const durationScale = clamp(input.durationScale ?? 1, 0.4, 1.35)
  const durationSec = input.tier === 'micro'
    ? mix(0.08, 0.2, durationRandom) * mix(0.88, 1.08, input.power) * durationScale
    : input.tier === 'strong' || input.tier === 'hero'
      ? mix(0.22, 0.46, durationRandom) * mix(0.94, 1.16, input.rate) * mix(0.94, 1.12, input.power) * durationScale
      : mix(0.15, 0.36, durationRandom) * mix(0.92, 1.12, input.rate) * mix(0.92, 1.08, input.power) * durationScale
  const intensityBase = input.tier === 'micro' ? mix(0.38, 0.64, intensityRandom) : input.tier === 'medium' ? mix(0.58, 0.86, intensityRandom) : mix(0.76, 1, intensityRandom)
  const thicknessBase = input.tier === 'micro' ? 0.64 : input.tier === 'medium' ? 0.9 : 1.08
  const glowBase = input.tier === 'micro' ? 0.62 : input.tier === 'medium' ? 0.9 : 1.12
  return {
    ...endpoints,
    startedAtSec: input.startedAtSec,
    durationSec,
    intensity: intensityBase * mix(0.72, 1.18, clamp01(input.power)),
    seed,
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
    signature: `${placement}|${orientation}|${startRegion}>${endRegion}|${lengthClass}`,
  }
}

function historyEntry(strike: Cinema2ElectricStormStrikeDescriptor): HistoryEntry {
  return { signature: strike.signature, orientation: strike.orientation, placement: strike.placement, startRegion: pointRegion(strike.start), endRegion: pointRegion(strike.end), lengthClass: strike.lengthClass }
}

function repetitionScore(candidate: Cinema2ElectricStormStrikeDescriptor, history: readonly HistoryEntry[]): number {
  let score = 0
  const startRegion = pointRegion(candidate.start)
  const endRegion = pointRegion(candidate.end)
  for (let index = history.length - 1, distance = 0; index >= 0; index -= 1, distance += 1) {
    const previous = history[index]
    const recency = Math.max(1, CINEMA2_ELECTRIC_STORM_HISTORY_LIMIT - distance)
    if (previous.signature === candidate.signature) score += recency * 8
    if (previous.orientation === candidate.orientation && previous.placement === candidate.placement) score += recency * 2.2
    if (previous.startRegion === startRegion && previous.endRegion === endRegion) score += recency * 1.6
    if (previous.lengthClass === candidate.lengthClass) score += recency * 0.25
  }
  return score
}

/** Electric Storm-specific scheduler. Engine randomness is namespaced by the
 * module host; anti-repeat history remains deliberately local creative state. */
export class Cinema2ElectricStormStrikeGenerator {
  private bucket = Number.NaN
  private active: Cinema2ElectricStormStrikeDescriptor[] = []
  private history: HistoryEntry[] = []
  private pending: Cinema2ElectricStormStrikeIntent[] = []
  private requestOrdinal = 0

  constructor(private readonly randomness: Cinema2ModuleRandomnessFacet) {}

  request(intent: Cinema2ElectricStormStrikeIntent): void {
    if (this.pending.length >= MAX_PENDING_REQUESTS) return
    this.pending.push({
      ...intent,
      power: clamp(intent.power ?? 1, 0, 1),
      count: Math.max(1, Math.min(CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES, Math.floor(intent.count ?? (intent.tier === 'hero' ? 2 : 1)))),
      detail: intent.detail === undefined ? undefined : clamp01(intent.detail),
      durationScale: intent.durationScale === undefined ? undefined : clamp(intent.durationScale, 0.4, 1.35),
    })
  }

  update(timeSec: number, strikeRate: number): Readonly<Cinema2ElectricStormStrikeFrame> {
    const safeTime = Math.max(0, Number.isFinite(timeSec) ? timeSec : 0)
    const rate = clamp01(strikeRate)
    const intervalSec = mix(1.8, 0.42, rate)
    const bucket = Math.floor(safeTime / intervalSec)
    const started: Cinema2ElectricStormStrikeDescriptor[] = []
    this.pruneExpired(safeTime)
    this.drainPending(safeTime, rate, started)
    if (bucket !== this.bucket) {
      this.bucket = bucket
      const available = Math.max(0, CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES - this.active.length - started.length)
      if (available > 0) started.push(...this.generateBucket(bucket, intervalSec, rate, available))
    }
    this.appendActive(started)
    return Object.freeze({ active: Object.freeze([...this.active]), started: Object.freeze([...started]) })
  }

  reset(): void {
    this.bucket = Number.NaN
    this.active = []
    this.history = []
    this.pending = []
    this.requestOrdinal = 0
  }

  getDiagnostics(): Readonly<{ activeCount: number; historyCount: number; pendingRequestCount: number }> {
    return Object.freeze({ activeCount: this.active.length, historyCount: this.history.length, pendingRequestCount: this.pending.length })
  }

  private pruneExpired(timeSec: number): void {
    this.active = this.active.filter(strike => timeSec <= strike.startedAtSec + strike.durationSec)
  }

  private appendActive(generated: readonly Cinema2ElectricStormStrikeDescriptor[]): void {
    if (generated.length === 0) return
    this.active.push(...generated)
    this.active.sort((a, b) => a.startedAtSec - b.startedAtSec)
    if (this.active.length > CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES) this.active.splice(0, this.active.length - CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
  }

  private drainPending(timeSec: number, rate: number, started: Cinema2ElectricStormStrikeDescriptor[]): void {
    const queued = this.pending.splice(0, this.pending.length)
    for (const intent of queued) {
      const available = CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES - this.active.length - started.length
      if (available <= 0) continue
      const count = Math.min(intent.count ?? 1, available)
      const requestKey = intent.eventId ?? `local-request-${this.requestOrdinal}`
      const groupId = count > 1 ? toSeed(this.randomness.sample('strike-request-group', this.requestOrdinal, requestKey)) : null
      for (let ordinal = 0; ordinal < count; ordinal += 1) {
        started.push(this.generateWithAntiRepeat({
          startedAtSec: timeSec + ordinal * 0.018,
          rate,
          tier: intent.tier,
          power: intent.power ?? 1,
          groupId,
          detail: intent.detail,
          durationScale: intent.durationScale,
        }, 'request', `${requestKey}:${ordinal}`))
      }
      this.requestOrdinal += 1
    }
  }

  private generateBucket(bucket: number, intervalSec: number, rate: number, available: number): Cinema2ElectricStormStrikeDescriptor[] {
    const probability = Math.min(0.95, mix(0, 0.9, rate) + Math.max(0, rate - 0.15) * 0.25)
    if (rate <= 0 || !this.randomness.probability('strike-bucket-opportunity', probability, bucket)) return []
    let count = 1
    if (rate > 0.45 && this.randomness.sample('strike-bucket-count-two', bucket) < (rate - 0.4) * 0.6) count += 1
    if (rate > 0.72 && this.randomness.sample('strike-bucket-count-three', bucket) < (rate - 0.65) * 0.75) count += 1
    count = Math.min(available, CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES, count)
    const groupId = count > 1 ? toSeed(this.randomness.sample('strike-bucket-group', bucket)) : null
    const bucketStartSec = bucket * intervalSec
    return Array.from({ length: count }, (_, ordinal) => {
      const tier = tierFor(this.randomness.sample('strike-tier', bucket * 8 + ordinal), rate)
      const power = mix(0.58, 1, this.randomness.sample('strike-power', bucket * 8 + ordinal))
      const startOffset = intervalSec * mix(0.04, 0.36, this.randomness.sample('strike-start-offset', bucket * 8 + ordinal))
      return this.generateWithAntiRepeat({ startedAtSec: bucketStartSec + startOffset + ordinal * 0.035, rate, tier, power, groupId }, 'bucket', `${bucket}:${ordinal}`)
    })
  }

  private generateWithAntiRepeat(input: CandidateInput, source: string, key: string): Cinema2ElectricStormStrikeDescriptor {
    let best = createCandidate(this.randomness.stream('strike-candidate', `${source}:${key}:0`), input)
    let bestScore = repetitionScore(best, this.history)
    for (let attempt = 1; attempt < CANDIDATE_ATTEMPTS && bestScore > 0; attempt += 1) {
      const candidate = createCandidate(this.randomness.stream('strike-candidate', `${source}:${key}:${attempt}`), input)
      const score = repetitionScore(candidate, this.history)
      if (score < bestScore) { best = candidate; bestScore = score }
    }
    this.history.push(historyEntry(best))
    if (this.history.length > CINEMA2_ELECTRIC_STORM_HISTORY_LIMIT) this.history.splice(0, this.history.length - CINEMA2_ELECTRIC_STORM_HISTORY_LIMIT)
    return best
  }
}
