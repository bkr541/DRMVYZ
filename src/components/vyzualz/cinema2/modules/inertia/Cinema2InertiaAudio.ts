import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { INERTIA_RESPONSE_LIMITS as limits, type InertiaAudioChannel } from '../../presets/Cinema2InertiaAudioRoutes'
import type { InertiaMotionPose } from './Cinema2InertiaMotion'
import { selectCinema2MainframeAudio } from '../mainframe/Cinema2MainframeAudioDelivery'
import { resolveCinema2AfterhoursTriggerEventIdentity } from '../Cinema2AfterhoursNativeModule'

export interface InertiaAudioResponse { displacement: number; shear: number; corePulse: number; sparkle: number; drive: number }
const ZERO: InertiaAudioResponse = { displacement: 0, shear: 0, corePulse: 0, sparkle: 0, drive: 1 }
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0))
const ease = (v: number) => v * v * (3 - 2 * v)

/** Only gates resolved shared targets; there is no local music detector or envelope clock. */
export class Cinema2InertiaAudio {
  private identity = ''
  private enabled = false
  private previousTime: number | null = null
  private previousAudioTime: number | null = null
  private lastIds = new Map<string, string>()
  private allowed = new Set<string>()

  update(frame: Cinema2ModuleFrameReadContext, read: (name: InertiaAudioChannel) => number,
    response: number, amount: number, deformation: number, damping = 0.65): InertiaAudioResponse {
    const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
    const time = frame.transport?.timeSec ?? audio?.upstream.timeSec ?? 0
    const identity = `${frame.transport?.trackId}:${frame.contextGeneration}:${audio?.upstream.analysisRevision}:${audio?.upstream.timelineRevision}`
    const enabled = !!audio && frame.transport?.sourcePresent === true && frame.transport.playing && !frame.transport.paused && response > 0
    const reset = identity !== this.identity || (this.previousTime != null && (time < this.previousTime - 1e-6 || time - this.previousTime > Math.max(0.5, frame.deltaTimeSec * 2)))
      || !!(audio?.discontinuity.occurred && audio.discontinuity.reason !== 'activation')
    const events = {
      kickDisplacement: audio?.rhythm.kick?.id,
      shearAccent: audio?.rhythm.snare?.id,
      transientAccent: audio?.rhythm.transient?.id,
      dropRelease: resolveCinema2AfterhoursTriggerEventIdentity({ ...frame, audio }, 'drop', this.previousAudioTime),
    }
    if (!enabled || !this.enabled || reset) this.allowed.clear()
    for (const [channel, id] of Object.entries(events)) {
      if (id) {
        if (enabled && this.enabled && !reset && this.lastIds.get(channel) !== id) this.allowed.add(channel)
        this.lastIds.set(channel, id)
      }
    }
    this.identity = identity; this.enabled = enabled; this.previousTime = time
    this.previousAudioTime = audio?.upstream.timeSec ?? this.previousAudioTime
    if (!enabled || !audio) return ZERO
    const value = (name: InertiaAudioChannel) => clamp(read(name))
    const pulse = (name: InertiaAudioChannel, authority: keyof typeof events = name as keyof typeof events) =>
      this.allowed.has(authority) && (authority === 'dropRelease' ? audio.capabilities.semanticMoments : audio.capabilities.rhythmEvents) ? ease(value(name)) : 0
    const r = clamp(response), m = clamp(amount), d = clamp(deformation)
    const kick = pulse('kickDisplacement'), snare = Math.max(pulse('shearAccent'), pulse('transientAccent'))
    const impactGain = frame.director?.authority.impact.available ? 1 + 0.15 * value('directorImpact') * clamp(response) : 1
    const drop = Math.min(1, pulse('dropRelease') * impactGain)
    const kickRecovery = pulse('kickRecovery', 'kickDisplacement')
    const shearRecovery = Math.max(pulse('snareRecovery', 'shearAccent'), pulse('transientRecovery', 'transientAccent'))
    const dropRecovery = pulse('dropRecovery', 'dropRelease')
    const core = pulse('corePulse', 'kickDisplacement')
    const recoil = 1 - 0.7 * clamp(damping)
    const bass = audio.bands.bass.available ? value('bassPressure') : 0
    const buildGain = frame.director?.context.build.available ? 1 + 0.15 * value('directorBuild') * r : 1
    const build = audio.features.buildProgress.available ? Math.min(1, ease(value('buildCompression')) * buildGain) * (1 - Math.max(drop, dropRecovery)) : 0
    const vocal = audio.features.vocalPresence.available ? value('vocalRestraint') : 0
    const energy = audio.features.overallEnergy.available ? value('energyMotion') : 1
    const meaning = ((frame.director?.continuous.intensity.available ? value('directorIntensity') : 0)
      + (frame.director?.continuous.momentum.available ? value('directorMomentum') : 0)) / 2
    return {
      displacement: clamp((-limits.bass * bass - limits.build * build + limits.kick * kick + limits.drop * drop
        - recoil * (limits.kickRecovery * kickRecovery + limits.dropRecovery * dropRecovery)) * r * m * d, -limits.radialBudget, limits.radialBudget),
      shear: (limits.shear * snare - limits.shearRecovery * recoil * shearRecovery) * r * m * d,
      corePulse: limits.core * core * r * m,
      sparkle: audio.bands.high.available ? 0.10 * value('pointSparkle') * r : 0,
      drive: m > 0 ? Math.min(1, (1 - 0.2 * (1 - energy) * r) * (1 - 0.25 * vocal * r) * (1 + 0.15 * meaning * r)) : 1,
    }
  }
}

export function applyInertiaAudio(pose: InertiaMotionPose, response: InertiaAudioResponse): InertiaMotionPose {
  return { ...pose,
    rotation: pose.rotation.map(v => v * response.drive) as [number, number, number],
    shape: [pose.shape[0] * response.drive, pose.shape[1] * response.drive, pose.shape[2] * response.drive + response.shear, pose.shape[3]],
    travel: pose.travel * response.drive,
  }
}
