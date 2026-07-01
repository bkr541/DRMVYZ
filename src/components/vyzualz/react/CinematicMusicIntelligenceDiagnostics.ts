import type { MusicIntelligenceCapabilities } from '../../../features/musicIntelligence/types'
import type {
  CinematicAudioRoute,
  CinematicAudioSource,
  CinematicAudioTarget,
} from './CinematicWorldConfig'

export type CinematicSourceCapability =
  | 'liveBands'
  | 'rhythmEvents'
  | 'beatGrid'
  | 'sections'
  | 'trackEnergyCurve'
  | 'vocalAnalysis'

export type CinematicMissingInputCode =
  | 'liveAudio'
  | 'beatGrid'
  | 'sections'
  | 'trackEnergyCurve'
  | 'stemCurves'
  | 'lyrics'

export interface CinematicMissingInputReason {
  code: CinematicMissingInputCode
  label: string
  message: string
}

export interface CinematicRouteInputDiagnostic {
  routeId: string
  routeIndex: number
  source: CinematicAudioSource
  reasons: readonly CinematicMissingInputReason[]
}

export interface CinematicInputDiagnostics {
  activeRouteCount: number
  unavailableRoutes: readonly CinematicRouteInputDiagnostic[]
  reasons: readonly CinematicMissingInputReason[]
}

export const CINEMATIC_SOURCE_CAPABILITY: Partial<Record<CinematicAudioSource, CinematicSourceCapability>> = {
  subBass: 'liveBands',
  lowMid: 'liveBands',
  highMid: 'liveBands',
  transientIntensity: 'rhythmEvents',
  kickStrength: 'rhythmEvents',
  snareStrength: 'rhythmEvents',
  beat: 'beatGrid',
  kick: 'rhythmEvents',
  snare: 'rhythmEvents',
  downbeat: 'beatGrid',
  barStart: 'beatGrid',
  beatPhase: 'beatGrid',
  barPosition: 'beatGrid',
  phraseProgress: 'beatGrid',
  sectionProgress: 'sections',
  buildProgress: 'liveBands',
  dropState: 'sections',
  sectionChange: 'sections',
  dropEntry: 'sections',
  sectionEnergy: 'sections',
  trackEnergy: 'trackEnergyCurve',
  vocalEnergy: 'vocalAnalysis',
}

const MISSING_INPUT_REASONS: Record<CinematicMissingInputCode, CinematicMissingInputReason> = {
  liveAudio: {
    code: 'liveAudio',
    label: 'Live audio input',
    message: 'Waiting for live audio input.',
  },
  beatGrid: {
    code: 'beatGrid',
    label: 'BPM / beat grid',
    message: 'BPM or beat grid unavailable.',
  },
  sections: {
    code: 'sections',
    label: 'Track sections',
    message: 'Track sections unavailable. Add manual sections or complete track analysis.',
  },
  trackEnergyCurve: {
    code: 'trackEnergyCurve',
    label: 'Track energy',
    message: 'Track-energy analysis unavailable.',
  },
  stemCurves: {
    code: 'stemCurves',
    label: 'Stem analysis',
    message: 'Stem analysis unavailable.',
  },
  lyrics: {
    code: 'lyrics',
    label: 'Timed lyrics',
    message: 'Timed lyrics unavailable.',
  },
}

const TARGET_ALIASES: Partial<Record<CinematicAudioTarget, CinematicAudioTarget>> = {
  fog: 'fogDensity',
  debris: 'particleEmission',
  atmosphere: 'environmentBrightness',
  glow: 'environmentBrightness',
  cameraMotion: 'cameraPunch',
  portalPulse: 'impact',
}

function reasonsForSource(
  source: CinematicAudioSource,
  capabilities: MusicIntelligenceCapabilities,
): readonly CinematicMissingInputReason[] {
  const capability = CINEMATIC_SOURCE_CAPABILITY[source]
  if (!capability) return []

  if (capability === 'vocalAnalysis') {
    if (capabilities.stemCurves || capabilities.lyrics) return []
    return [MISSING_INPUT_REASONS.stemCurves, MISSING_INPUT_REASONS.lyrics]
  }

  if (capabilities[capability]) return []
  if (capability === 'liveBands' || capability === 'rhythmEvents') {
    return [MISSING_INPUT_REASONS.liveAudio]
  }
  return [MISSING_INPUT_REASONS[capability]]
}

export function isCinematicSourceAvailable(
  source: CinematicAudioSource,
  capabilities: MusicIntelligenceCapabilities,
): boolean {
  return reasonsForSource(source, capabilities).length === 0
}

export function isCinematicAudioRouteActive(
  route: CinematicAudioRoute | null | undefined,
  mappingEnabled: boolean,
  supportedTargets: readonly CinematicAudioTarget[],
): route is CinematicAudioRoute {
  if (!mappingEnabled || !route || !route.enabled) return false
  if (!Number.isFinite(route.amount) || Math.abs(route.amount) <= Number.EPSILON) return false

  const supported = new Set(supportedTargets.map(target => TARGET_ALIASES[target] ?? target))
  return supported.has(TARGET_ALIASES[route.target] ?? route.target)
}

export function diagnoseCinematicMusicIntelligenceInputs(
  routes: readonly CinematicAudioRoute[],
  mappingEnabled: boolean,
  supportedTargets: readonly CinematicAudioTarget[],
  capabilities: MusicIntelligenceCapabilities,
): CinematicInputDiagnostics {
  const unavailableRoutes: CinematicRouteInputDiagnostic[] = []
  const reasonsByCode = new Map<CinematicMissingInputCode, CinematicMissingInputReason>()
  let activeRouteCount = 0

  routes.forEach((route, routeIndex) => {
    if (!isCinematicAudioRouteActive(route, mappingEnabled, supportedTargets)) return
    activeRouteCount += 1

    const reasons = reasonsForSource(route.source, capabilities)
    if (reasons.length === 0) return

    unavailableRoutes.push({ routeId: route.id, routeIndex, source: route.source, reasons })
    reasons.forEach(reason => reasonsByCode.set(reason.code, reason))
  })

  return {
    activeRouteCount,
    unavailableRoutes,
    reasons: [...reasonsByCode.values()],
  }
}
