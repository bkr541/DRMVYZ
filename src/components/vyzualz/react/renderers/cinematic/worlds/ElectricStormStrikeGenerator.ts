export const ELECTRIC_STORM_MAX_ACTIVE_STRIKES = 3

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
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
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

function randomPoint(seed: number): ElectricStormPoint {
  const edgeChoice = random01(seed ^ 0xa511e9b3)
  const a = random01(seed ^ 0x63d83595)
  const b = random01(seed ^ 0x9e3779b9)
  const interior = edgeChoice > 0.58
  if (interior) {
    return { x: mix(-0.82, 0.82, a), y: mix(-0.82, 0.82, b) }
  }
  const side = Math.floor(edgeChoice * 4) % 4
  if (side === 0) return { x: -1, y: mix(-0.94, 0.94, a) }
  if (side === 1) return { x: 1, y: mix(-0.94, 0.94, a) }
  if (side === 2) return { x: mix(-0.94, 0.94, a), y: -1 }
  return { x: mix(-0.94, 0.94, a), y: 1 }
}

function sufficientlySeparated(a: ElectricStormPoint, b: ElectricStormPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) >= 0.72
}

function strikeFor(bucket: number, ordinal: number, bucketStartSec: number, intervalSec: number, rate: number, seed: number): ElectricStormStrikeDescriptor {
  const strikeSeed = hash32(seed ^ Math.imul(bucket + 1, 0x45d9f3b) ^ Math.imul(ordinal + 11, 0x27d4eb2d))
  const start = randomPoint(strikeSeed ^ 0x8da6b343)
  let end = randomPoint(strikeSeed ^ 0xd8163841)
  if (!sufficientlySeparated(start, end)) {
    end = { x: -start.x * 0.92, y: -start.y * 0.92 }
  }
  const startOffset = intervalSec * mix(0.04, 0.36, random01(strikeSeed ^ 0xcb1ab31f))
  return {
    start,
    end,
    startedAtSec: bucketStartSec + startOffset + ordinal * 0.035,
    durationSec: mix(0.16, 0.42, random01(strikeSeed ^ 0x165667b1)) * mix(0.9, 1.18, rate),
    intensity: mix(0.62, 1, random01(strikeSeed ^ 0x85ebca6b)),
    seed: strikeSeed,
  }
}

/**
 * Stage 1 scheduling boundary. It creates bounded strike descriptors only when
 * a scheduling bucket changes, never new topology on every rendered frame.
 * Stage 2 can replace the bucket policy while retaining the renderer contract.
 */
export class ElectricStormStrikeGenerator {
  private bucket = Number.NaN
  private active: ElectricStormStrikeDescriptor[] = []

  update(timeSec: number, strikeRate: number, seed: number): readonly ElectricStormStrikeDescriptor[] {
    const safeTime = Math.max(0, Number.isFinite(timeSec) ? timeSec : 0)
    const rate = clamp01(strikeRate)
    const intervalSec = mix(1.8, 0.42, rate)
    const bucket = Math.floor(safeTime / intervalSec)

    if (bucket !== this.bucket) {
      this.bucket = bucket
      const carried = this.active.filter(strike => safeTime <= strike.startedAtSec + strike.durationSec)
      const generated = this.generateBucket(bucket, intervalSec, rate, seed >>> 0)
      this.active = [...carried, ...generated]
        .sort((a, b) => a.startedAtSec - b.startedAtSec)
        .slice(-ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
    }

    this.active = this.active.filter(strike => safeTime <= strike.startedAtSec + strike.durationSec)
    return this.active
  }

  reset(): void {
    this.bucket = Number.NaN
    this.active = []
  }

  private generateBucket(bucket: number, intervalSec: number, rate: number, seed: number): ElectricStormStrikeDescriptor[] {
    const bucketSeed = hash32(seed ^ Math.imul(bucket + 29, 0x9e3779b1))
    const opportunity = random01(bucketSeed ^ 0x68bc21eb)
    const probability = mix(0.18, 0.88, rate)
    if (opportunity > probability) return []

    let count = 1
    if (rate > 0.55 && random01(bucketSeed ^ 0x02e5be93) < (rate - 0.45) * 0.65) count += 1
    if (rate > 0.82 && random01(bucketSeed ^ 0x967a889b) < (rate - 0.75) * 0.8) count += 1
    count = Math.min(ELECTRIC_STORM_MAX_ACTIVE_STRIKES, count)

    const bucketStartSec = bucket * intervalSec
    return Array.from({ length: count }, (_, ordinal) => (
      strikeFor(bucket, ordinal, bucketStartSec, intervalSec, rate, bucketSeed)
    ))
  }
}
