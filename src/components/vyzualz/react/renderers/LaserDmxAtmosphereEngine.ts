import type { LaserDmxSettings } from '../ReactTypes'
import {
  normalizeProductionAtmosphereSettings,
  normalizeProductionAtmosphericFixtureSettings,
  PRODUCTION_ATMOSPHERE_PARTICLE_BUDGETS,
  normalizeProductionStageModel,
  resolveLaserDmxFixtureStageTransform,
  type ProductionAtmosphereSettings,
  type ProductionAtmosphereQualityTier,
  type ProductionStageVector3,
} from '../LaserDmxProductionRig'

export interface ProductionAtmosphereParticle {
  id: string
  fixtureId: string
  medium: 'fog' | 'cryo'
  position: ProductionStageVector3
  radius: number
  density: number
  age01: number
}

export interface ProductionAtmosphereBurstSnapshot {
  fixtureId: string
  medium: 'fog' | 'cryo'
  startedAtSec: number
  endsAtSec: number
  cooldownUntilSec: number
  particleCount: number
}

export interface ProductionAtmosphereFrame {
  settings: ProductionAtmosphereSettings
  timeSec: number
  particles: ProductionAtmosphereParticle[]
  bursts: ProductionAtmosphereBurstSnapshot[]
  localHazeDensity: number
  budget: number
  droppedParticles: number
}

interface ActiveBurst {
  fixtureId: string
  medium: 'fog' | 'cryo'
  requestId: number
  startedAtSec: number
  endsAtSec: number
  cooldownUntilSec: number
  seed: number
}

interface FixtureRuntime {
  lastRequestId: number
  cooldownUntilSec: number
}

const fixtureRuntime = new Map<string, FixtureRuntime>()
let bursts: ActiveBurst[] = []
let lastClearRequestId = 0
let pausedAtSec: number | null = null
let baseHazeSuppressed = false
let consumeExistingRequestsOnNextStep = false

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function hash(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function orientedDirection(yawDeg: number, pitchDeg: number): ProductionStageVector3 {
  const yaw = (yawDeg * Math.PI) / 180
  const pitch = (pitchDeg * Math.PI) / 180
  const cp = Math.cos(pitch)
  return {
    x: Math.sin(yaw) * cp,
    y: Math.max(0.08, Math.cos(yaw) * 0 + Math.sin(-pitch)),
    z: Math.cos(yaw) * cp,
  }
}

export function particleBudgetForQuality(quality: ProductionAtmosphereQualityTier): number {
  return PRODUCTION_ATMOSPHERE_PARTICLE_BUDGETS[quality]
}

export function resetProductionAtmosphereRuntime(options: { consumeExistingRequests?: boolean } = {}): void {
  fixtureRuntime.clear()
  bursts = []
  lastClearRequestId = 0
  pausedAtSec = null
  baseHazeSuppressed = false
  consumeExistingRequestsOnNextStep = Boolean(options.consumeExistingRequests)
}

export function pauseProductionAtmosphere(timeSec: number): void {
  if (pausedAtSec === null) pausedAtSec = timeSec
}

export function resumeProductionAtmosphere(timeSec: number): void {
  if (pausedAtSec === null) return
  const offset = Math.max(0, timeSec - pausedAtSec)
  bursts = bursts.map((burst) => ({
    ...burst,
    startedAtSec: burst.startedAtSec + offset,
    endsAtSec: burst.endsAtSec + offset,
    cooldownUntilSec: burst.cooldownUntilSec + offset,
  }))
  for (const runtime of fixtureRuntime.values()) runtime.cooldownUntilSec += offset
  pausedAtSec = null
}

export function clearProductionAtmosphereBursts(): void {
  bursts = []
}

function lowerQuality(
  authored: ProductionAtmosphereQualityTier,
  stageQuality: ProductionAtmosphereQualityTier,
): ProductionAtmosphereQualityTier {
  const rank: Record<ProductionAtmosphereQualityTier, number> = {
    low: 0,
    medium: 1,
    high: 2,
  }
  return rank[authored] <= rank[stageQuality] ? authored : stageQuality
}

function consumeTriggerRequest(fixtureId: string, requestId: number, resetCooldown: boolean): void {
  const runtime = fixtureRuntime.get(fixtureId)
  fixtureRuntime.set(fixtureId, {
    lastRequestId: Math.max(runtime?.lastRequestId ?? 0, requestId),
    cooldownUntilSec: resetCooldown ? 0 : (runtime?.cooldownUntilSec ?? 0),
  })
}

function triggerBurst(
  fixtureId: string,
  medium: 'fog' | 'cryo',
  requestId: number,
  timeSec: number,
  settings: ReturnType<typeof normalizeProductionAtmosphericFixtureSettings>,
): void {
  const runtime = fixtureRuntime.get(fixtureId) ?? {
    lastRequestId: 0,
    cooldownUntilSec: 0,
  }
  if (requestId <= runtime.lastRequestId) return
  runtime.lastRequestId = requestId

  const existing = bursts.find((burst) => burst.fixtureId === fixtureId)
  if (existing && timeSec < existing.endsAtSec) {
    if (settings.retriggerPolicy === 'ignoreWhileActive') {
      fixtureRuntime.set(fixtureId, runtime)
      return
    }
    if (settings.retriggerPolicy === 'extend') {
      existing.endsAtSec = Math.max(existing.endsAtSec, timeSec + settings.outputDurationSec)
      existing.cooldownUntilSec = existing.endsAtSec + settings.cooldownSec
      runtime.cooldownUntilSec = existing.cooldownUntilSec
      fixtureRuntime.set(fixtureId, runtime)
      return
    }
    bursts = bursts.filter((burst) => burst.fixtureId !== fixtureId)
  } else if (timeSec < runtime.cooldownUntilSec) {
    fixtureRuntime.set(fixtureId, runtime)
    return
  }

  const startedAtSec = timeSec + settings.warmupSec
  const endsAtSec = startedAtSec + settings.outputDurationSec
  const cooldownUntilSec = endsAtSec + settings.cooldownSec
  bursts.push({
    fixtureId,
    medium,
    requestId,
    startedAtSec,
    endsAtSec,
    cooldownUntilSec,
    seed: settings.seed,
  })
  runtime.cooldownUntilSec = cooldownUntilSec
  fixtureRuntime.set(fixtureId, runtime)
}

export interface StepProductionAtmosphereInput {
  settings: LaserDmxSettings
  timeSec: number
  dt: number
  seeked?: boolean
}

export function stepProductionAtmosphere(input: StepProductionAtmosphereInput): ProductionAtmosphereFrame {
  const atmosphere = normalizeProductionAtmosphereSettings(input.settings.atmosphere)
  const stage = normalizeProductionStageModel(input.settings.productionStage)
  const timeSec = Number.isFinite(input.timeSec) ? input.timeSec : 0
  const clearRequestId = Math.max(0, Math.round(input.settings.runtime?.atmosphereClearRequestId ?? 0))
  const clearRequested = clearRequestId > lastClearRequestId
  if (clearRequested) {
    clearProductionAtmosphereBursts()
    baseHazeSuppressed = !atmosphere.retainBaseHazeOnClear
    lastClearRequestId = clearRequestId
  }
  if (input.seeked) {
    clearProductionAtmosphereBursts()
    fixtureRuntime.clear()
  }

  const consumeExistingRequests = consumeExistingRequestsOnNextStep || Boolean(input.seeked) || clearRequested
  const resetConsumedCooldowns = consumeExistingRequestsOnNextStep || Boolean(input.seeked)
  let localHazeDensity = 0
  for (const fixture of input.settings.fixtures) {
    if (!fixture.enabled) continue
    const medium =
      fixture.fixtureKind === 'hazer'
        ? 'haze'
        : fixture.fixtureKind === 'fogger'
          ? 'fog'
          : fixture.fixtureKind === 'cryoJet'
            ? 'cryo'
            : null
    if (!medium) continue
    const authored = normalizeProductionAtmosphericFixtureSettings(fixture.atmospheric, medium)
    if (medium === 'haze') {
      localHazeDensity += authored.outputLevel * authored.density * 0.35
      continue
    }
    if (consumeExistingRequests) consumeTriggerRequest(fixture.id, authored.triggerRequestId, resetConsumedCooldowns)
    else triggerBurst(fixture.id, medium, authored.triggerRequestId, timeSec, authored)
  }
  consumeExistingRequestsOnNextStep = false

  bursts = bursts.filter((burst) => timeSec <= burst.endsAtSec)
  const quality = lowerQuality(atmosphere.qualityTier, stage.editor.qualityTier)
  const budget = Math.min(atmosphere.maxParticleBudget, particleBudgetForQuality(quality))
  const particles: ProductionAtmosphereParticle[] = []
  let droppedParticles = 0

  for (const burst of bursts) {
    const fixture = input.settings.fixtures.find((candidate) => candidate.id === burst.fixtureId)
    if (!fixture) continue
    const medium = burst.medium
    const authored = normalizeProductionAtmosphericFixtureSettings(fixture.atmospheric, medium)
    if (timeSec < burst.startedAtSec) continue
    const transform = resolveLaserDmxFixtureStageTransform(fixture, stage)
    const ageSec = Math.max(0, timeSec - burst.startedAtSec)
    const age01 = clamp01(ageSec / Math.max(0.001, authored.outputDurationSec))
    const direction =
      authored.orientationMode === 'vertical'
        ? { x: 0, y: 1, z: 0 }
        : orientedDirection(transform.orientation.yawDeg, transform.orientation.pitchDeg)
    const requested = Math.max(
      0,
      Math.round(
        (medium === 'cryo' ? 90 : 55) *
          authored.density *
          authored.outputLevel *
          (quality === 'low' ? 0.55 : quality === 'high' ? 1.35 : 1),
      ),
    )
    const available = Math.max(0, budget - particles.length)
    const count = Math.min(requested, available)
    droppedParticles += requested - count

    for (let index = 0; index < count; index += 1) {
      const seed = burst.seed * 100003 + burst.requestId * 997 + index * 37
      const along = hash(seed + 1)
      const sideA = hash(seed + 2) * 2 - 1
      const sideB = hash(seed + 3) * 2 - 1
      const turbulence = (hash(seed + Math.floor(ageSec * 12) + 4) * 2 - 1) * authored.turbulence
      const expansion = authored.spread * (0.15 + age01 * (medium === 'cryo' ? 1.6 : 0.9))
      const travel = Math.min(authored.height, authored.plumeVelocity * ageSec * (0.35 + along * 0.8))
      const driftX = Math.cos((authored.driftDirectionDeg * Math.PI) / 180) * authored.driftSpeed * ageSec
      const driftZ = Math.sin((authored.driftDirectionDeg * Math.PI) / 180) * authored.driftSpeed * ageSec
      const decay = Math.pow(1 - age01, medium === 'cryo' ? 1.8 + authored.dissipation * 2 : 0.7 + authored.dissipation)
      particles.push({
        id: `${burst.fixtureId}:${burst.requestId}:${index}`,
        fixtureId: burst.fixtureId,
        medium,
        position: {
          x: transform.position.x + direction.x * travel + sideA * expansion + turbulence * 0.3 + driftX,
          y: transform.position.y + Math.max(0, direction.y * travel) + along * expansion * 0.45,
          z: transform.position.z + direction.z * travel + sideB * expansion + turbulence * 0.2 + driftZ,
        },
        radius: (medium === 'cryo' ? 0.16 : 0.28) + expansion * (0.2 + hash(seed + 5) * 0.45),
        density: clamp01(authored.density * authored.outputLevel * decay * (0.55 + hash(seed + 6) * 0.45)),
        age01,
      })
    }
  }

  const qualityAdjustedAtmosphere =
    quality === atmosphere.qualityTier ? atmosphere : { ...atmosphere, qualityTier: quality }
  const effectiveAtmosphere = baseHazeSuppressed
    ? {
        ...qualityAdjustedAtmosphere,
        persistentHaze: {
          ...qualityAdjustedAtmosphere.persistentHaze,
          enabled: false,
          baseDensity: 0,
        },
      }
    : qualityAdjustedAtmosphere
  return {
    settings: effectiveAtmosphere,
    timeSec,
    particles,
    bursts: bursts.map((burst) => ({
      ...burst,
      particleCount: particles.filter((particle) => particle.fixtureId === burst.fixtureId).length,
    })),
    localHazeDensity: baseHazeSuppressed ? 0 : clamp01(localHazeDensity),
    budget,
    droppedParticles,
  }
}
