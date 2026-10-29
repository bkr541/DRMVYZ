import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { resolveRawCinema2MainframeBeatClock, resolveCinema2MainframeTimeSec } from '../mainframe/Cinema2MainframePatternEngine'
import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { Cinema2InertiaPerformance, type InertiaPerformanceSelection } from './Cinema2InertiaPerformance'

export const INERTIA_PATTERNS = [
  ['reference-cycle', 'Reference Cycle', 8, 5], ['countertwist', 'Countertwist', 8, 5],
  ['breathing-cage', 'Breathing Cage', 4, 3], ['torsion-wave', 'Torsion Wave', 8, 5],
  ['slice-shear', 'Slice Shear', 4, 3], ['collapse-release', 'Collapse / Release', 8, 5],
] as const
export type InertiaPattern = typeof INERTIA_PATTERNS[number][0]
export interface InertiaMotionSettings {
  pattern: InertiaPattern; sync: boolean; speed: number; amount: number; deformation: number; damping: number
  patternChange: boolean; trigger: Cinema2AfterhoursTriggerId; editRevision: number
  autoPerformance?: boolean; audioResponse?: number; buildValue?: number
  resolvePerformance?: (selection: InertiaPerformanceSelection) => InertiaPattern
}
export interface InertiaMotionPose {
  rotation: [number, number, number]
  /** countertwist, traveling twist, row shear, uniform pressure scale */
  shape: [number, number, number, number]
  phase: number
  travel: number
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mod = (v: number) => ((v % 1) + 1) % 1

export function inertiaPatternPose(pattern: InertiaPattern, phase: number, amount: number, deformation: number, damping: number): InertiaMotionPose {
  const duration = INERTIA_PATTERNS.find(p => p[0] === pattern)![3]
  // Analytic first-order phase lag: no frame-rate-dependent spring or stale simulation state.
  const lag = Math.atan(2 * Math.PI / duration * (0.12 + 0.53 * damping))
  const angle = phase * Math.PI * 2 - lag, wave = Math.sin(angle)
  const strength = amount * deformation, base = deformation
  const rotation: [number, number, number] = [0, 0, 0]
  const shape: [number, number, number, number] = [0, 0, 0, 1]
  if (pattern === 'reference-cycle') {
    const fold = Math.max(0, Math.sin((mod(phase) - 0.4) / 0.6 * Math.PI)) ** 2
    rotation[0] = 0.25 * wave * amount; rotation[1] = 1.4 * Math.sin(angle + 0.3) * amount; rotation[2] = 0.65 * wave * amount
    shape[0] = 1.8 * fold * strength; shape[2] = 0.09 * fold * strength
  } else if (pattern === 'countertwist') {
    shape[0] = 0.7 * base + 2.1 * wave * strength
    rotation[1] = 0.35 * wave * amount
  } else if (pattern === 'breathing-cage') {
    shape[3] = 1.035 - 0.24 * wave * strength
    shape[2] = 0.025 * Math.sin(angle - 0.6) * strength
    rotation[2] = 0.1 * wave * amount
  } else if (pattern === 'torsion-wave') {
    shape[1] = 0.45 * base + 1.8 * strength
    rotation[2] = 0.2 * wave * amount
  } else if (pattern === 'slice-shear') {
    shape[2] = 0.06 * base + 0.22 * strength
    rotation[0] = 0.15 * wave * amount
  } else {
    const compression = (1 - Math.cos(angle)) / 2
    // Small bounded recovery overshoot; high damping reduces it.
    shape[3] = 0.86 - 0.28 * compression * strength + 0.035 * (1 - damping) * Math.sin(angle * 2) * strength
    shape[0] = 0.18 * base + 0.35 * wave * strength
    rotation[1] = 0.22 * wave * amount
  }
  const traveling = pattern === 'torsion-wave' || pattern === 'slice-shear'
  return { rotation, shape, phase: traveling ? phase : 0, travel: traveling ? amount : 0 }
}

/** Native visual phase only. Shared beat timing/events remain engine-owned. */
export class Cinema2InertiaMotion {
  private selection = new Cinema2MainframePatternController<InertiaPattern>(INERTIA_PATTERNS.map(p => p[0]), 'reference-cycle')
  private lastTime: number | null = null
  private lastBeat: number | null = null
  private identity = ''
  private editRevision = -1
  private phase = 0
  private runSeconds = 0
  private active: InertiaPattern = 'reference-cycle'
  private previous: InertiaMotionPose | null = null
  private transitionFrom: InertiaMotionPose | null = null
  private transitionAge = 1
  private lastSync = false
  private lastSource = ''
  private lastBpm = 0
  private alignRemaining = 0
  private alignCorrection = 0
  private lastFrame = -1
  private seenEvents = new Set<string>()
  private wasPlaying = false
  private analysisIdentity = ''
  private performance = new Cinema2InertiaPerformance()
  private performed: InertiaPattern = 'reference-cycle'
  private output: InertiaMotionPose = inertiaPatternPose('reference-cycle', 0, 0, 0.45, 0.65)

  getActivePattern(): InertiaPattern { return this.active }
  getPerformedPattern(): InertiaPattern { return this.performed }

  update(frame: Cinema2ModuleFrameReadContext, settings: InertiaMotionSettings): InertiaMotionPose {
    if (frame.frameId === this.lastFrame) return this.output
    this.lastFrame = frame.frameId
    const time = resolveCinema2MainframeTimeSec(frame)
    const transport = frame.transport
    const playing = !!transport?.playing && !transport.paused
    const present = !!transport?.sourcePresent
    const analysisIdentity = frame.audio ? `${frame.audio.upstream.analysisRevision}:${frame.audio.upstream.timelineRevision}`
      : transport?.paused ? this.analysisIdentity : ''
    const identity = `${transport?.trackId}:${frame.contextGeneration}:${analysisIdentity}`
    const delta = this.lastTime == null ? 0 : time - this.lastTime
    const reset = this.lastTime == null || identity !== this.identity || delta < -1e-6
      || delta > Math.max(0.5, frame.deltaTimeSec * 2)
      || !!(frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation')
    const effective = settings.sync && transport?.bpmSync !== false
    // The stateful Mainframe resolver requires analyzed audio playback; native Inertia
    // motion also works from an explicit playing host transport before analysis exists.
    const clock = resolveRawCinema2MainframeBeatClock(frame, effective)
    const locked = effective && clock.source !== 'visual-fallback-120'
    if (reset) this.seenEvents.clear()
    let eventId = resolveCinema2AfterhoursTriggerEventIdentity(frame, settings.trigger, this.lastTime)
    if (eventId) {
      const key = `${settings.trigger}:${eventId}`, seen = this.seenEvents.has(key)
      this.seenEvents.add(key)
      if (this.seenEvents.size > 512) this.seenEvents.delete(this.seenEvents.values().next().value!)
      if (seen || (!this.wasPlaying && playing)) eventId = null
    }
    const selected = this.selection.update({
      authoredPattern: settings.pattern, patternChange: settings.patternChange, trigger: settings.trigger,
      triggerEventId: eventId,
      absoluteBeat: clock.beats, reset: reset || this.editRevision !== settings.editRevision,
    })
    const performance = this.performance.update(frame, selected.activePattern, settings.autoPerformance === true,
      settings.audioResponse ?? 0, settings.editRevision, settings.buildValue ?? 0)
    const pattern = settings.resolvePerformance?.(performance) ?? performance.pattern
    const [, , beats, seconds] = INERTIA_PATTERNS.find(p => p[0] === pattern)!
    if (reset || !present) {
      this.phase = present ? (locked ? clock.beats / beats : time / seconds) * settings.speed : 0
      this.runSeconds = 0; this.transitionFrom = null; this.previous = null
      this.alignRemaining = 0; this.alignCorrection = 0
    } else if (playing) {
      const dt = Math.max(0, Math.min(0.25, delta))
      const beatDelta = clock.confirmedGrid && this.lastBeat != null
        ? Math.max(0, clock.beats - this.lastBeat) : dt * clock.bpm / 60
      this.phase += (locked && this.lastSync ? beatDelta / beats : dt / seconds) * settings.speed
      if (locked && (!this.lastSync || this.lastSource !== clock.source || this.lastBpm !== clock.bpm)) {
        const desired = clock.beats / beats * settings.speed
        this.alignCorrection = mod(desired - this.phase + 0.5) - 0.5
        this.alignRemaining = beats * 60 / clock.bpm / settings.speed
      }
      if (!locked) this.alignRemaining = 0
      if (this.alignRemaining > 0) {
        const fraction = Math.min(1, dt / this.alignRemaining)
        this.phase += this.alignCorrection * fraction
        this.alignCorrection *= 1 - fraction; this.alignRemaining = Math.max(0, this.alignRemaining - dt)
      }
      this.runSeconds += dt
      this.transitionAge += dt
    }
    const amount = present ? settings.amount * Math.min(1, this.runSeconds / 0.2) : 0
    const next = inertiaPatternPose(pattern, this.phase, amount, settings.deformation, settings.damping)
    if (pattern !== this.performed && this.previous && playing) {
      this.transitionFrom = this.previous; this.transitionAge = 0.025
    }
    const duration = locked ? Math.max(0.12, Math.min(0.5, 30 / clock.bpm)) : 0.25
    const t = playing ? Math.min(1, this.transitionAge / duration) : 1
    if (this.transitionFrom && t < 1) {
      const smooth = t * t * (3 - 2 * t), from = this.transitionFrom
      this.output = {
        rotation: next.rotation.map((v, i) => mix(from.rotation[i], v, smooth)) as [number, number, number],
        shape: next.shape.map((v, i) => mix(from.shape[i], v, smooth)) as [number, number, number, number],
        phase: mix(from.phase, next.phase, smooth),
        travel: mix(from.travel, next.travel, smooth),
      }
    } else { this.output = next; this.transitionFrom = null }
    this.active = selected.activePattern; this.performed = pattern; this.previous = this.output
    this.lastTime = time; this.lastBeat = clock.beats; this.lastSync = locked
    this.lastSource = clock.source; this.lastBpm = clock.bpm
    this.identity = identity; this.editRevision = settings.editRevision
    this.wasPlaying = playing; this.analysisIdentity = analysisIdentity
    return this.output
  }
}

/** Same deformation for every cage role and both endpoints of every rib. */
export const INERTIA_DEFORM_GLSL = `
uniform vec3 u_rotation;
uniform vec4 u_shape;
uniform float u_phase;
uniform float u_travel;
uniform float u_cageSize;
uniform float u_coreSize;
uniform float u_safeRadius;
uniform float u_displacement;
vec3 deform(vec3 p, bool core) {
  if (core) return p * u_coreSize;
  float twistWave = mix(sin(p.y * 7.0), sin(p.y * 7.0 - u_phase * 6.2831853), u_travel);
  float shearWave = mix(sin(p.y * 12.0), sin(p.y * 12.0 - u_phase * 6.2831853), u_travel);
  float angle = u_shape.x * p.y + u_shape.y * twistWave;
  float c = cos(angle), s = sin(angle);
  p.xz = mat2(c,-s,s,c) * p.xz;
  p.x += u_shape.z * shearWave;
  p *= u_shape.w * u_cageSize;
  p += normalize(p + vec3(0.00001)) * u_displacement;
  c=cos(u_rotation.x); s=sin(u_rotation.x); p.yz=mat2(c,-s,s,c)*p.yz;
  c=cos(u_rotation.y); s=sin(u_rotation.y); p.xz=mat2(c,-s,s,c)*p.xz;
  c=cos(u_rotation.z); s=sin(u_rotation.z); p.xy=mat2(c,-s,s,c)*p.xy;
  return p * min(1.0, u_safeRadius / max(length(p), 0.0001));
}`
