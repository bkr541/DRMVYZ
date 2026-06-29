import type {
  CinematicCameraConfig,
  CinematicCameraEasing,
  CinematicCameraRig,
} from '../../CinematicWorldConfig'
import type { ReactSectionType } from '../../ReactTypes'
import type {
  CinematicNormalizedAudioFrame,
} from './CinematicAudioModulation'
import type {
  CinematicCameraPose,
  CinematicCameraPosePatch,
  CinematicDirectionAction,
  CinematicFlyThroughPathPoint,
  CinematicVector3,
  CinematicWorldDirection,
  CinematicWorldSafeCameraRange,
  CinematicWorldShot,
} from './CinematicWorldDirection'

export type CinematicDirectionSectionSource = 'analyzed' | 'inferred' | 'none'

export interface CinematicDirectionSection {
  type: ReactSectionType | null
  source: CinematicDirectionSectionSource
  key: string
  progress: number
}

export interface CinematicScheduledShot {
  shot: CinematicWorldShot
  startedAtSec: number
  section: CinematicDirectionSection
  changed: boolean
}

export interface CinematicCameraFrame {
  rig: Exclude<CinematicCameraRig, 'autoDirector'>
  requestedRig: CinematicCameraRig
  pose: CinematicCameraPose
  shotId: string
  action: CinematicDirectionAction
  routeProgress: number
  transitionProgress: number
  sectionType: ReactSectionType | null
  sectionSource: CinematicDirectionSectionSource
  usedFallbackRig: boolean
}

export interface CinematicCameraUpdateInput {
  worldId: string
  direction: CinematicWorldDirection
  requestedRig: CinematicCameraRig
  camera: CinematicCameraConfig
  audio: CinematicNormalizedAudioFrame
  transportTimeSec: number
  deltaTimeSec: number
  isPlaying: boolean
  seed: number
}

const DEFAULT_POSE: CinematicCameraPose = {
  position: { x: 0, y: 0, z: 1.8 },
  rotation: { x: 0, y: 0, z: 0 },
  fieldOfView: 58,
}

const FALLBACK_SECTIONS: readonly ReactSectionType[] = ['unknown']

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpVector(a: CinematicVector3, b: CinematicVector3, t: number): CinematicVector3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }
}

export function interpolateCinematicCameraPose(
  from: CinematicCameraPose,
  to: CinematicCameraPose,
  progress: number,
): CinematicCameraPose {
  const t = clamp01(progress)
  return {
    position: lerpVector(from.position, to.position, t),
    rotation: lerpVector(from.rotation, to.rotation, t),
    fieldOfView: lerp(from.fieldOfView, to.fieldOfView, t),
  }
}

function copyPose(pose: CinematicCameraPose): CinematicCameraPose {
  return {
    position: { ...pose.position },
    rotation: { ...pose.rotation },
    fieldOfView: pose.fieldOfView,
  }
}

function applyPosePatch(base: CinematicCameraPose, patch?: CinematicCameraPosePatch): CinematicCameraPose {
  if (!patch) return copyPose(base)
  return {
    position: { ...base.position, ...patch.position },
    rotation: { ...base.rotation, ...patch.rotation },
    fieldOfView: patch.fieldOfView ?? base.fieldOfView,
  }
}

function ease(value: number, easing: CinematicCameraEasing | 'easeOut'): number {
  const x = clamp01(value)
  switch (easing) {
    case 'easeInOut': return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
    case 'smoothstep': return x * x * (3 - 2 * x)
    case 'easeOut': return 1 - (1 - x) * (1 - x)
    default: return x
  }
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededUnit(seed: number): number {
  let value = seed >>> 0
  value += 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

function deterministicPhase(seed: number, salt: string): number {
  return seededUnit((seed ^ hashString(salt)) >>> 0) * Math.PI * 2
}

function sectionPosePatch(section: CinematicDirectionSection): CinematicCameraPosePatch {
  const progress = clamp01(section.progress)
  switch (section.type) {
    case 'intro':
      return { position: { z: 2.9 }, fieldOfView: 70 }
    case 'verse':
      return { position: { z: 2.15 }, fieldOfView: 60 }
    case 'build':
      return { position: { z: lerp(2.3, 1.35, progress) }, fieldOfView: lerp(62, 50, progress) }
    case 'preDrop':
      return { position: { z: lerp(1.55, 1.05, progress) }, fieldOfView: lerp(50, 43, progress) }
    case 'drop':
      return { position: { z: 1.3 }, fieldOfView: 66 }
    case 'breakdown':
    case 'bridge':
      return { position: { z: 2.55 }, fieldOfView: 64 }
    case 'outro':
      return { position: { z: lerp(2.3, 3.8, progress) }, fieldOfView: lerp(62, 76, progress) }
    default:
      return {}
  }
}

export function resolveCinematicDirectionSection(audio: CinematicNormalizedAudioFrame): CinematicDirectionSection {
  const exactType = audio.section.type
  const source = audio.section.source
  const exact = exactType != null && (source === 'manual' || source === 'analysis')
  if (exact) {
    return {
      type: exactType,
      source: 'analyzed',
      key: `analyzed:${exactType}:${audio.section.startSec}:${audio.section.endSec}`,
      progress: clamp01(audio.section.progress),
    }
  }
  if (exactType != null && source === 'inferred') {
    return {
      type: exactType,
      source: 'inferred',
      key: `inferred:${exactType}:${audio.section.startSec}:${audio.section.endSec}`,
      progress: clamp01(audio.section.progress),
    }
  }

  const values = audio.values
  const barIndex = audio.timing.barIndex
  const transport = Math.max(0, audio.transportTimeSec)
  let type: ReactSectionType = 'verse'
  if (transport < 12 || (barIndex >= 0 && barIndex < 4)) type = 'intro'
  else if (values.dropState > 0.5 || (values.overallEnergy > 0.82 && values.transientIntensity > 0.55)) type = 'drop'
  else if (values.buildProgress > 0.82) type = 'preDrop'
  else if (values.buildProgress > 0.38) type = 'build'
  else if (values.overallEnergy < 0.24 && transport > 24) type = 'breakdown'

  const boundary = barIndex >= 0 ? Math.floor(barIndex / 4) : Math.floor(transport / 8)
  return {
    type,
    source: 'inferred',
    key: `fallback:${type}:${boundary}`,
    progress: type === 'build' || type === 'preDrop' ? values.buildProgress : audio.timing.phraseProgress,
  }
}

export function resolveSupportedCameraRig(
  requested: CinematicCameraRig,
  supported: readonly CinematicCameraRig[],
): { rig: Exclude<CinematicCameraRig, 'autoDirector'>; usedFallback: boolean } {
  const direct = requested !== 'autoDirector' && supported.includes(requested)
    ? requested
    : null
  if (direct) return { rig: direct, usedFallback: false }
  const fallback = supported.find(rig => rig === 'locked')
    ?? supported.find(rig => rig !== 'autoDirector')
    ?? 'locked'
  return {
    rig: fallback as Exclude<CinematicCameraRig, 'autoDirector'>,
    usedFallback: requested !== fallback,
  }
}

function defaultShotForRig(
  rig: Exclude<CinematicCameraRig, 'autoDirector'>,
  section: ReactSectionType | null,
): CinematicWorldShot {
  return {
    id: `manual-${rig}`,
    rig,
    sections: section ? [section] : FALLBACK_SECTIONS,
    action: rig === 'flyThrough' ? 'travel' : rig === 'orbit' ? 'orbit' : 'hold',
  }
}

export class CinematicShotScheduler {
  private current: CinematicWorldShot | null = null
  private startedAtSec = 0
  private worldId: string | null = null
  private sectionKey: string | null = null
  private readonly history: string[] = []

  reset(): void {
    this.current = null
    this.startedAtSec = 0
    this.worldId = null
    this.sectionKey = null
    this.history.length = 0
  }

  update(input: {
    worldId: string
    direction: CinematicWorldDirection
    section: CinematicDirectionSection
    audio: CinematicNormalizedAudioFrame
    config: CinematicCameraConfig['autoDirector']
    seed: number
    transportTimeSec: number
  }): CinematicScheduledShot {
    const { worldId, direction, section, audio, config, seed, transportTimeSec } = input
    const worldChanged = this.worldId !== worldId
    const sectionChanged = this.sectionKey !== section.key
    const reset = audio.resetReasons.some(reason => (
      reason === 'seek' || reason === 'trackReplacement' || reason === 'worldReplacement' || reason === 'presetReplacement'
    ))

    if (worldChanged || reset) {
      this.current = null
      this.history.length = 0
    }

    const elapsed = Math.max(0, transportTimeSec - this.startedAtSec)
    const minimum = Math.max(config.minimumShotDurationSec, this.current?.minimumDurationSec ?? 0)
    const atBoundary = !config.preferMusicalBoundaries
      || audio.events.barStart
      || audio.events.downbeat
      || audio.events.sectionChange
      || sectionChanged
    const locked = config.lockUntilNextSection && !sectionChanged && this.current != null
    const maySwitch = this.current == null || sectionChanged || (!locked && elapsed >= minimum && atBoundary)

    let changed = false
    if (maySwitch) {
      const candidates = direction.shots.filter(shot => (
        shot.sections.includes(section.type ?? 'unknown')
        && direction.supportedCameraRigs.includes(shot.rig)
      ))
      const pool = candidates.length > 0
        ? candidates
        : direction.shots.filter(shot => direction.supportedCameraRigs.includes(shot.rig))
      const repeatWindow = this.history.slice(-config.repeatAvoidance)
      const fresh = pool.filter(shot => !repeatWindow.includes(shot.id))
      const selectable = fresh.length > 0 ? fresh : pool
      const fallbackRig = resolveSupportedCameraRig('locked', direction.supportedCameraRigs).rig
      const fallback = defaultShotForRig(fallbackRig, section.type)
      const token = `${worldId}:${section.key}:${audio.timing.barIndex}:${Math.floor(transportTimeSec / Math.max(1, minimum))}`
      const unit = seededUnit((seed ^ hashString(token)) >>> 0)
      const totalWeight = selectable.reduce((sum, shot) => sum + Math.max(0.01, shot.weight ?? 1), 0)
      let cursor = unit * totalWeight
      let selected = selectable[selectable.length - 1] ?? fallback
      for (const shot of selectable) {
        cursor -= Math.max(0.01, shot.weight ?? 1)
        if (cursor <= 0) { selected = shot; break }
      }
      if (this.current?.id !== selected.id || sectionChanged || worldChanged || reset) {
        this.current = selected
        this.startedAtSec = transportTimeSec
        this.history.push(selected.id)
        if (this.history.length > 16) this.history.shift()
        changed = true
      }
    }

    this.worldId = worldId
    this.sectionKey = section.key
    if (!this.current) {
      const rig = resolveSupportedCameraRig('locked', direction.supportedCameraRigs).rig
      this.current = defaultShotForRig(rig, section.type)
      this.startedAtSec = transportTimeSec
      changed = true
    }
    return { shot: this.current, startedAtSec: this.startedAtSec, section, changed }
  }
}

function safePose(pose: CinematicCameraPose, range: CinematicWorldSafeCameraRange): CinematicCameraPose {
  return {
    position: {
      x: clamp(pose.position.x, -range.maxLateral, range.maxLateral),
      y: clamp(pose.position.y, range.minElevation, range.maxElevation),
      z: clamp(pose.position.z, range.minDistance, range.maxDistance),
    },
    rotation: {
      x: clamp(pose.rotation.x, -0.45, 0.45),
      y: clamp(pose.rotation.y, -0.7, 0.7),
      z: clamp(pose.rotation.z, -0.28, 0.28),
    },
    fieldOfView: clamp(pose.fieldOfView, range.minFieldOfView, range.maxFieldOfView),
  }
}

function interpolatePath(
  path: readonly CinematicFlyThroughPathPoint[],
  progress: number,
): CinematicCameraPosePatch {
  if (path.length === 0) return {}
  if (path.length === 1) return path[0]
  const scaled = clamp01(progress) * (path.length - 1)
  const index = Math.min(path.length - 2, Math.floor(scaled))
  const local = scaled - index
  const a = path[index]
  const b = path[index + 1]
  return {
    position: lerpVector(a.position, b.position, local),
    rotation: {
      x: lerp(a.rotation?.x ?? 0, b.rotation?.x ?? 0, local),
      y: lerp(a.rotation?.y ?? 0, b.rotation?.y ?? 0, local),
      z: lerp(a.rotation?.z ?? 0, b.rotation?.z ?? 0, local),
    },
    fieldOfView: lerp(a.fieldOfView ?? 58, b.fieldOfView ?? 58, local),
  }
}

function actionForSection(section: ReactSectionType | null): CinematicDirectionAction {
  switch (section) {
    case 'intro': return 'establish'
    case 'build': return 'approach'
    case 'preDrop': return 'focus'
    case 'drop': return 'impact'
    case 'outro': return 'retreat'
    default: return 'hold'
  }
}

export class CinematicCameraSystem {
  private readonly scheduler = new CinematicShotScheduler()
  private displayedPose: CinematicCameraPose = copyPose(DEFAULT_POSE)
  private transitionFrom: CinematicCameraPose = copyPose(DEFAULT_POSE)
  private transitionElapsedSec = 99
  private impactAgeSec = 99
  private initialized = false
  private activeShotId = ''

  reset(): void {
    this.scheduler.reset()
    this.displayedPose = copyPose(DEFAULT_POSE)
    this.transitionFrom = copyPose(DEFAULT_POSE)
    this.transitionElapsedSec = 99
    this.impactAgeSec = 99
    this.initialized = false
    this.activeShotId = ''
  }

  update(input: CinematicCameraUpdateInput): CinematicCameraFrame {
    const dt = input.isPlaying ? clamp(input.deltaTimeSec, 0, 0.1) : 0
    const section = resolveCinematicDirectionSection(input.audio)
    const manualOverride = input.requestedRig === 'autoDirector'
      ? input.camera.autoDirector.manualOverrideRig
      : null

    let shot: CinematicWorldShot
    let changed = false
    if (input.requestedRig === 'autoDirector' && !manualOverride) {
      const scheduled = this.scheduler.update({
        worldId: input.worldId,
        direction: input.direction,
        section,
        audio: input.audio,
        config: input.camera.autoDirector,
        seed: input.seed,
        transportTimeSec: input.transportTimeSec,
      })
      shot = scheduled.shot
      changed = scheduled.changed
    } else {
      const requested = manualOverride ?? input.requestedRig
      const resolved = resolveSupportedCameraRig(requested, input.direction.supportedCameraRigs)
      shot = defaultShotForRig(resolved.rig, section.type)
      changed = this.activeShotId !== shot.id
    }

    const resolvedRig = resolveSupportedCameraRig(shot.rig, input.direction.supportedCameraRigs)
    if (resolvedRig.rig !== shot.rig) shot = { ...shot, rig: resolvedRig.rig }
    if (changed || this.activeShotId !== shot.id) {
      this.transitionFrom = copyPose(this.displayedPose)
      this.transitionElapsedSec = 0
      this.activeShotId = shot.id
    }

    if (input.audio.events.beat || input.audio.events.kick || input.audio.events.dropEntry) this.impactAgeSec = 0
    else this.impactAgeSec = Math.min(99, this.impactAgeSec + dt)

    const base = applyPosePatch({
      position: { ...input.camera.locked.position },
      rotation: { ...input.camera.locked.rotation },
      fieldOfView: input.camera.locked.fieldOfView,
    }, sectionPosePatch(section))
    let desired = applyPosePatch(base, shot.pose)
    let routeProgress = 0
    const time = Math.max(0, input.transportTimeSec)
    const beatImpulse = Math.exp(-this.impactAgeSec * 8)
    const build = input.audio.values.buildProgress

    switch (resolvedRig.rig) {
      case 'locked': {
        const breathing = Math.sin(time * Math.PI * 2 * input.camera.locked.breathingFrequency + deterministicPhase(input.seed, 'locked'))
          * input.camera.locked.breathingStrength
        desired.position.z -= breathing + beatImpulse * input.camera.locked.beatPunch
        desired.fieldOfView += beatImpulse * input.camera.locked.beatPunch * 18
        break
      }
      case 'dolly': {
        const speed = input.camera.dolly.speed * (1 + build * input.camera.dolly.buildAcceleration)
        const cycle = (Math.sin(time * speed * Math.PI * 2 * input.camera.dolly.direction) + 1) * 0.5
        routeProgress = ease(cycle, input.camera.dolly.easing)
        const travel = (routeProgress * 2 - 1) * input.camera.dolly.range
        desired.position.z -= travel + beatImpulse * input.camera.dolly.beatAcceleration
        break
      }
      case 'orbit': {
        const sectionScale = input.camera.orbit.sectionAware
          ? section.type === 'drop' ? 1.65 : section.type === 'build' || section.type === 'preDrop' ? 1.25 : 1
          : 1
        const angle = time * input.camera.orbit.angularSpeed * sectionScale * Math.PI * 2 * input.camera.orbit.direction
          + deterministicPhase(input.seed, 'orbit')
        const safeRadius = Math.max(
          input.direction.safeCameraRange.minDistance + input.camera.orbit.safeMargin,
          Math.min(input.camera.orbit.radius, input.direction.safeCameraRange.maxDistance - input.camera.orbit.safeMargin),
        )
        desired.position.x += Math.sin(angle) * safeRadius * 0.42
        desired.position.z = Math.max(input.direction.safeCameraRange.minDistance, Math.cos(angle) * safeRadius * 0.28 + safeRadius)
        desired.position.y += input.camera.orbit.elevation + Math.sin(angle * 0.5) * 0.08
        desired.rotation.y += -Math.sin(angle) * 0.22
        desired.rotation.x += -input.camera.orbit.elevation * 0.08
        routeProgress = ((angle / (Math.PI * 2)) % 1 + 1) % 1
        break
      }
      case 'flyThrough': {
        const speed = input.camera.flyThrough.speed * (
          1 + input.camera.flyThrough.speedModulation * (input.audio.values.overallEnergy * 0.6 + build * 0.4)
        )
        const rawProgress = time * speed
        routeProgress = input.camera.flyThrough.loop ? rawProgress - Math.floor(rawProgress) : clamp01(rawProgress)
        const paths = input.direction.flyThroughPaths
        if (paths && paths.length > 0) {
          const pathIndex = Math.floor(seededUnit((input.seed ^ hashString(input.worldId)) >>> 0) * paths.length) % paths.length
          desired = applyPosePatch(desired, interpolatePath(paths[pathIndex], routeProgress))
        } else {
          desired.position.x += Math.sin(routeProgress * Math.PI * 2) * 0.45
          desired.position.y += Math.sin(routeProgress * Math.PI * 4) * 0.12
          desired.position.z = lerp(input.direction.safeCameraRange.maxDistance, input.direction.safeCameraRange.minDistance, routeProgress)
        }
        desired.rotation.z += Math.sin(routeProgress * Math.PI * 2) * input.camera.flyThrough.banking
        break
      }
      case 'handheld': {
        const frequency = input.camera.handheld.frequency
        const phaseX = deterministicPhase(input.seed, 'handheld-x')
        const phaseY = deterministicPhase(input.seed, 'handheld-y')
        const phaseR = deterministicPhase(input.seed, 'handheld-r')
        const strength = input.camera.handheld.strength
        const drift = input.camera.handheld.driftStrength
        const shake = beatImpulse * input.camera.handheld.impactShake
        desired.position.x += clamp(
          (Math.sin(time * frequency * 1.17 + phaseX) * drift + Math.sin(time * 19 + phaseY) * shake) * strength,
          -input.camera.handheld.maxTranslation,
          input.camera.handheld.maxTranslation,
        )
        desired.position.y += clamp(
          (Math.sin(time * frequency * 0.83 + phaseY) * drift * 0.72 + Math.cos(time * 23 + phaseX) * shake) * strength,
          -input.camera.handheld.maxTranslation,
          input.camera.handheld.maxTranslation,
        )
        desired.rotation.z += clamp(
          (Math.sin(time * frequency * 0.61 + phaseR) * drift * 0.45 + Math.sin(time * 17 + phaseR) * shake) * strength,
          -input.camera.handheld.maxRotation,
          input.camera.handheld.maxRotation,
        )
        const dampingAlpha = dt <= 0 ? 0 : 1 - Math.exp(-dt * input.camera.handheld.damping)
        desired = interpolateCinematicCameraPose(this.displayedPose, desired, dampingAlpha)
        break
      }
    }

    desired = safePose(desired, input.direction.safeCameraRange)
    if (!this.initialized || input.audio.resetReasons.some(reason => reason === 'seek' || reason === 'trackReplacement')) {
      this.displayedPose = copyPose(desired)
      this.transitionFrom = copyPose(desired)
      this.transitionElapsedSec = input.camera.autoDirector.transitionDurationSec
      this.initialized = true
    } else {
      this.transitionElapsedSec += dt
      const duration = input.camera.autoDirector.transitionDurationSec
      const transitionProgress = duration <= 0 ? 1 : ease(this.transitionElapsedSec / duration, 'smoothstep')
      this.displayedPose = interpolateCinematicCameraPose(this.transitionFrom, desired, transitionProgress)
    }

    const duration = input.camera.autoDirector.transitionDurationSec
    const transitionProgress = duration <= 0 ? 1 : clamp01(this.transitionElapsedSec / duration)
    return {
      rig: resolvedRig.rig,
      requestedRig: input.requestedRig,
      pose: copyPose(this.displayedPose),
      shotId: shot.id,
      action: shot.action ?? actionForSection(section.type),
      routeProgress,
      transitionProgress,
      sectionType: section.type,
      sectionSource: section.source,
      usedFallbackRig: resolvedRig.usedFallback || shot.rig !== resolvedRig.rig,
    }
  }
}

export function cinematicDirectionActionValue(action: CinematicDirectionAction): number {
  const values: Record<CinematicDirectionAction, number> = {
    establish: 0,
    approach: 1,
    focus: 2,
    impact: 3,
    open: 4,
    reveal: 5,
    travel: 6,
    orbit: 7,
    retreat: 8,
    close: 9,
    hold: 10,
  }
  return values[action]
}
