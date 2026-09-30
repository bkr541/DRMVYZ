import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2JsonValue,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import {
  CINEMA2_AFTERHOURS_MAX_LASERS,
  CINEMA2_AFTERHOURS_MIN_LASERS,
  type Cinema2AfterhoursRandomSource,
} from './afterhours/Cinema2AfterhoursDomain'
import { evaluateCinema2AfterhoursPattern, type Cinema2AfterhoursPatternRay } from './afterhours/Cinema2AfterhoursPatternEngine'
import {
  CINEMA2_AFTERHOURS_DEFAULT_PATTERN_ID,
  CINEMA2_AFTERHOURS_PATTERN_IDS,
  getCinema2AfterhoursPattern,
  isCinema2AfterhoursPatternId,
} from './afterhours/Cinema2AfterhoursPatternLibrary'
import {
  CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS,
  pickCinema2AfterhoursNextPattern,
  planCinema2AfterhoursShow,
  resolveCinema2AfterhoursCadenceIdentity,
  type Cinema2AfterhoursPatternChangeId,
  type Cinema2AfterhoursShowPlan,
  type Cinema2AfterhoursShowPlannerStructure,
} from './afterhours/Cinema2AfterhoursShowPlanner'
import {
  Cinema2AfterhoursRenderer,
  type Cinema2AfterhoursRenderBeam,
} from './afterhours/Cinema2AfterhoursRenderer'

export const CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('afterhours-native-render')
export const CINEMA2_AFTERHOURS_NATIVE_MODULE_VERSION = 1 as const
export const CINEMA2_AFTERHOURS_HARD_CUT_ACTION = 'hardStructuralCut' as const
export const CINEMA2_AFTERHOURS_TRIGGER_IDS = Object.freeze([
  'beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop',
] as const)
export { CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS } from './afterhours/Cinema2AfterhoursShowPlanner'
export type { Cinema2AfterhoursPatternChangeId } from './afterhours/Cinema2AfterhoursShowPlanner'

export type Cinema2AfterhoursTriggerId = typeof CINEMA2_AFTERHOURS_TRIGGER_IDS[number]

export const CINEMA2_AFTERHOURS_NATIVE_PARAMETER_NAMES = Object.freeze([
  'pattern',
  'autoPerformance',
  'beamCount',
  'symmetry',
  'sideLasers',
  'topLasers',
  'spread',
  'colorMode',
  'primaryColor',
  'accentColor',
  'accentMix',
  'atmosphere',
  'bpmSync',
  'masterIntensity',
  'trigger',
  'pulseAmount',
  'pulseDecay',
  'motionAmount',
  'patternChange',
  'blackoutAmount',
  'directorIntensity',
  'directorBuild',
  'directorImpact',
  'vocalPresence',
  'kickAccent',
  'snareAccent',
  'downbeatAccent',
  'phraseAccent',
  'sectionAccent',
  'dropAccent',
] as const)

/** With no beat tracking (or BPM Sync off) the cues count beats at this steady tempo. */
const FREE_RUN_BPM = 120
const DEFAULT_PRIMARY = Object.freeze([0.455, 0.961, 1, 1]) as Cinema2Color
const DEFAULT_ACCENT = Object.freeze([1, 1, 1, 1]) as Cinema2Color
const WHITE = Object.freeze([1, 1, 1, 1]) as Cinema2Color
const TRIGGER_SET = new Set<string>(CINEMA2_AFTERHOURS_TRIGGER_IDS)
const PATTERN_CHANGE_SET = new Set<string>(CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS)

type AfterhoursColorMode = 'manual' | 'auto'

interface FrameConfig {
  readonly pattern: string
  readonly autoPerformance: boolean
  /** Laser Count (authored as the beamCount parameter): most lasers lit at once. */
  readonly beamCount: number
  readonly symmetry: boolean
  readonly sideLasers: boolean
  readonly topLasers: boolean
  readonly spread: number
  readonly colorMode: AfterhoursColorMode
  readonly primaryColor: Cinema2Color
  readonly accentColor: Cinema2Color
  readonly accentMix: number
  readonly atmosphere: number
  readonly bpmSync: boolean
  readonly masterIntensity: number
  readonly trigger: Cinema2AfterhoursTriggerId
  readonly pulseAmount: number
  readonly pulseDecay: number
  readonly motionAmount: number
  readonly patternChange: Cinema2AfterhoursPatternChangeId
  readonly blackoutAmount: number
  readonly directorIntensity: number
  readonly directorBuild: number
  readonly directorImpact: number
  readonly vocalPresence: number
  readonly kickAccent: number
  readonly snareAccent: number
  readonly downbeatAccent: number
  readonly phraseAccent: number
  readonly sectionAccent: number
  readonly dropAccent: number
}

function validate(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  for (const property of CINEMA2_AFTERHOURS_NATIVE_PARAMETER_NAMES) {
    if (module.parameters?.[property] === undefined) diagnostics.push(diagnostic(
      'CINEMA2_AFTERHOURS_MODULE_PARAMETER_MISSING',
      `$.parameters.${property}`,
      `Afterhours native renderer requires the "${property}" parameter.`,
    ))
  }
  if (module.parameters?.pattern !== undefined && !isCinema2AfterhoursPatternId(module.parameters.pattern)) {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_PATTERN_INVALID', '$.parameters.pattern', `Afterhours pattern must be one of: ${CINEMA2_AFTERHOURS_PATTERN_IDS.join(', ')}.`))
  }
  if (module.parameters?.beamCount !== undefined && !numberInRange(module.parameters.beamCount, CINEMA2_AFTERHOURS_MIN_LASERS, CINEMA2_AFTERHOURS_MAX_LASERS)) {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_BEAM_COUNT_INVALID', '$.parameters.beamCount', `Afterhours Laser Count must be between ${CINEMA2_AFTERHOURS_MIN_LASERS} and ${CINEMA2_AFTERHOURS_MAX_LASERS}.`))
  }
  for (const property of ['autoPerformance', 'symmetry', 'sideLasers', 'topLasers', 'bpmSync'] as const) {
    if (module.parameters?.[property] !== undefined && typeof module.parameters[property] !== 'boolean') {
      diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_BOOLEAN_PARAMETER_INVALID', `$.parameters.${property}`, `Afterhours "${property}" must be boolean.`))
    }
  }
  if (module.parameters?.colorMode !== undefined && module.parameters.colorMode !== 'manual' && module.parameters.colorMode !== 'auto') {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_COLOR_MODE_INVALID', '$.parameters.colorMode', 'Afterhours colorMode must be "manual" or "auto".'))
  }
  for (const property of ['primaryColor', 'accentColor'] as const) {
    if (module.parameters?.[property] !== undefined && !isColor(module.parameters[property])) {
      diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_COLOR_INVALID', `$.parameters.${property}`, `Afterhours "${property}" must contain four finite values from 0 through 1.`))
    }
  }
  for (const property of ['spread', 'accentMix', 'atmosphere', 'masterIntensity', 'pulseAmount', 'pulseDecay', 'motionAmount', 'blackoutAmount', 'directorIntensity', 'directorBuild', 'directorImpact', 'vocalPresence', 'kickAccent', 'snareAccent', 'downbeatAccent', 'phraseAccent', 'sectionAccent', 'dropAccent'] as const) {
    if (module.parameters?.[property] !== undefined && !numberInRange(module.parameters[property], 0, 1)) {
      diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_NORMALIZED_PARAMETER_INVALID', `$.parameters.${property}`, `Afterhours "${property}" must be between 0 and 1.`))
    }
  }
  if (module.parameters?.trigger !== undefined && !isTrigger(module.parameters.trigger)) {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_TRIGGER_INVALID', '$.parameters.trigger', `Afterhours trigger must be one of: ${CINEMA2_AFTERHOURS_TRIGGER_IDS.join(', ')}.`))
  }
  if (module.parameters?.patternChange !== undefined && !isPatternChange(module.parameters.patternChange)) {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_PATTERN_CHANGE_INVALID', '$.parameters.patternChange', `Afterhours patternChange must be one of: ${CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS.join(', ')}.`))
  }
  return Object.freeze(diagnostics.map(entry => Object.freeze(entry)))
}

export const cinema2AfterhoursNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_AFTERHOURS_NATIVE_MODULE_VERSION,
  validate,
  create: (context: Cinema2ModuleCreateContext) => {
    const autoPalette = createAutoPalette(context)
    const randomAdapter = createDomainRandomAdapter(context)
    let config = readFrameConfig(context, autoPalette)
    let hardCutRequested = false
    let lastTimeSec: number | null = null
    let lastTrackId: string | null | undefined = undefined
    let lastPaused: boolean | null = null
    let lastContextGeneration: number | null = null
    let renderBeams: readonly Cinema2AfterhoursRenderBeam[] = Object.freeze([])
    let lastTriggerEventId: string | null = null
    let pulseStartedAtSec = Number.NEGATIVE_INFINITY
    let lastAuthoredPattern: string | null = null
    let lastPatternChange: Cinema2AfterhoursPatternChangeId | null = null
    let lastPatternCadenceIdentity: string | null = null
    // The pattern Pattern Change has moved to (Manual mode), and the pattern on screen with the beat it started on.
    let activePattern: string = config.pattern
    let playingPattern: string | null = null
    let patternStartBeat = 0
    const cueSeed = String(context.randomness.sample('afterhours-cue-seed'))
    let cueBeat = 0

    const resetTransientState = () => {
      renderBeams = Object.freeze([])
      lastTriggerEventId = null
      pulseStartedAtSec = Number.NEGATIVE_INFINITY
      lastAuthoredPattern = null
      lastPatternChange = null
      lastPatternCadenceIdentity = null
      activePattern = config.pattern
      playingPattern = null
      patternStartBeat = 0
    }

    const provider = Object.freeze({
      id: `${context.module.id}:afterhours-native`,
      moduleId: context.module.id,
      intent: 'world' as const,
      execute(execution: Cinema2ModuleRenderExecutionContext) {
        if (!execution.depthAvailable) throw new Error(`Cinema 2.0 Afterhours module "${context.module.id}" requires a render target with a depth attachment.`)
        if (!execution.camera) throw new Error(`Cinema 2.0 Afterhours module "${context.module.id}" requires final Camera Runtime state.`)
        const renderer = context.resources.acquire(
          'afterhours-native-renderer',
          'Cinema2AfterhoursRenderer',
          gl => new Cinema2AfterhoursRenderer(gl),
          value => value.dispose(),
        )
        renderer.draw({
          beams: renderBeams,
          worldToClipMatrix: execution.camera.viewProjectionMatrix,
          cameraPosition: execution.camera.position,
          atmosphere: config.atmosphere,
          masterIntensity: config.masterIntensity,
        })
      },
    })

    return {
      lifecycle: {
        update(updateContext: Cinema2ModuleUpdateContext) {
          const { frame } = updateContext
          config = readFrameConfig(updateContext, autoPalette)
          const timeSec = resolveTimeSec(frame)
          // Nothing is playing (no source, paused, or analysis idle): the host has frozen visual time, so the show holds still like every other preset.
          const animationActive = frame.transport?.animationActive !== false
          const discontinuity = Boolean(frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation')
          const backwards = lastTimeSec != null && timeSec < lastTimeSec - 1e-6
          const sourceReplaced = lastTrackId !== undefined && frame.transport?.trackId !== lastTrackId
          const contextChanged = lastContextGeneration != null && frame.contextGeneration !== lastContextGeneration
          const paused = frame.transport?.sourcePresent === true && frame.transport.paused === true
          const enteredPause = paused && lastPaused === false
          const triggerPreviousTimeSec = discontinuity || backwards || sourceReplaced || contextChanged ? null : lastTimeSec
          if (discontinuity || backwards || sourceReplaced || contextChanged) resetTransientState()
          if (enteredPause) {
            pulseStartedAtSec = Number.NEGATIVE_INFINITY
          }

          const triggerEventId = resolveCinema2AfterhoursTriggerEventIdentity(frame, config.trigger, triggerPreviousTimeSec)
          if (triggerEventId && triggerEventId !== lastTriggerEventId && frame.transport?.playing !== false && frame.transport?.paused !== true) {
            lastTriggerEventId = triggerEventId
            pulseStartedAtSec = timeSec
          }
          const pulse = resolveCinema2AfterhoursPulseEnvelope(frame, timeSec, pulseStartedAtSec, config.pulseDecay)
          const structure = resolveShowPlannerStructure(frame, config)
          const cadenceIdentity = resolveCinema2AfterhoursCadenceIdentity(config.patternChange, structure)
          const patternEdited = lastAuthoredPattern != null && lastAuthoredPattern !== config.pattern
          const cadenceEdited = lastPatternChange != null && lastPatternChange !== config.patternChange
          const manualCadenceActive = !config.autoPerformance && config.patternChange !== 'off'

          if (!manualCadenceActive || patternEdited || cadenceEdited || lastPatternCadenceIdentity == null) {
            activePattern = config.pattern
            lastPatternCadenceIdentity = cadenceIdentity
          } else if (
            frame.transport?.playing !== false
            && frame.transport?.paused !== true
            && cadenceIdentity !== lastPatternCadenceIdentity
            && !cadenceIdentity.endsWith(':unavailable')
          ) {
            // Pattern Change reached its boundary: move to a random different pattern from the list.
            activePattern = pickCinema2AfterhoursNextPattern(activePattern, cadenceIdentity, randomAdapter)
            lastPatternCadenceIdentity = cadenceIdentity
          }

          lastAuthoredPattern = config.pattern
          lastPatternChange = config.patternChange

          const showPlan = planCinema2AfterhoursShow(
            Object.freeze({
              pattern: config.pattern,
              autoPerformance: config.autoPerformance,
              laserLimit: config.beamCount,
              symmetry: config.symmetry,
              sideLasers: config.sideLasers,
              topLasers: config.topLasers,
              patternChange: config.patternChange,
              activePattern,
            }),
            structure,
            randomAdapter,
          )
          if (animationActive) cueBeat = resolveCinema2AfterhoursCueBeat(frame, timeSec, config.bpmSync) ?? cueBeat
          const barStart = Math.floor(Math.max(0, cueBeat) / 4) * 4
          if (playingPattern == null) {
            // The first pattern after a (re)start follows the song's own bar grid, so a seek replays the same bars.
            playingPattern = showPlan.patternId
            patternStartBeat = 0
          } else if (showPlan.patternId !== playingPattern) {
            // A new pattern always starts from its own first bar, on the bar line where it took over.
            playingPattern = showPlan.patternId
            patternStartBeat = barStart
          }
          if (hardCutRequested) {
            patternStartBeat = barStart
            hardCutRequested = false
          }
          renderBeams = buildRenderBeams(config, showPlan, pulse, Math.max(0, cueBeat - patternStartBeat), cueSeed)

          lastTimeSec = timeSec
          lastTrackId = frame.transport?.trackId
          lastPaused = paused
          lastContextGeneration = frame.contextGeneration
        },
        dispose() {
          resetTransientState()
        },
      },
      render: { providers: Object.freeze([provider]) },
      handleAction(action: string) {
        if (action === CINEMA2_AFTERHOURS_HARD_CUT_ACTION) hardCutRequested = true
      },
    }
  },
})

function readFrameConfig(
  source: Pick<Cinema2ModuleCreateContext, 'parameters'> | Pick<Cinema2ModuleUpdateContext, 'parameters'>,
  autoPalette: Readonly<{ primary: Cinema2Color; accent: Cinema2Color }>,
): FrameConfig {
  const colorMode = source.parameters.get('colorMode') === 'auto' ? 'auto' : 'manual'
  return Object.freeze({
    pattern: isCinema2AfterhoursPatternId(source.parameters.get('pattern')) ? source.parameters.get('pattern') as string : CINEMA2_AFTERHOURS_DEFAULT_PATTERN_ID,
    // Runtime authority is carried through the canonical target path. The Show
    // Auto Performance may choose topology/presentation, but fixture-bank
    // enables remain hard user authority in the Show Planner.
    autoPerformance: booleanValue(source.parameters.get('autoPerformance'), false),
    beamCount: clamp(Math.round(numberValue(source.parameters.get('beamCount'), CINEMA2_AFTERHOURS_MAX_LASERS)), CINEMA2_AFTERHOURS_MIN_LASERS, CINEMA2_AFTERHOURS_MAX_LASERS),
    symmetry: booleanValue(source.parameters.get('symmetry'), true),
    sideLasers: booleanValue(source.parameters.get('sideLasers'), true),
    topLasers: booleanValue(source.parameters.get('topLasers'), true),
    spread: clamp01(numberValue(source.parameters.get('spread'), 0.65)),
    colorMode,
    primaryColor: colorMode === 'auto' ? autoPalette.primary : colorValue(source.parameters.get('primaryColor'), DEFAULT_PRIMARY),
    accentColor: colorMode === 'auto' ? autoPalette.accent : colorValue(source.parameters.get('accentColor'), DEFAULT_ACCENT),
    accentMix: clamp01(numberValue(source.parameters.get('accentMix'), 0.25)),
    atmosphere: clamp01(numberValue(source.parameters.get('atmosphere'), 0.55)),
    bpmSync: booleanValue(source.parameters.get('bpmSync'), true),
    masterIntensity: clamp01(numberValue(source.parameters.get('masterIntensity'), 0.75)),
    trigger: isTrigger(source.parameters.get('trigger')) ? source.parameters.get('trigger') as Cinema2AfterhoursTriggerId : 'beat',
    pulseAmount: clamp01(numberValue(source.parameters.get('pulseAmount'), 0.65)),
    pulseDecay: clamp01(numberValue(source.parameters.get('pulseDecay'), 0.45)),
    motionAmount: clamp01(numberValue(source.parameters.get('motionAmount'), 0.55)),
    patternChange: isPatternChange(source.parameters.get('patternChange')) ? source.parameters.get('patternChange') as Cinema2AfterhoursPatternChangeId : 'off',
    blackoutAmount: clamp01(numberValue(source.parameters.get('blackoutAmount'), 0.25)),
    directorIntensity: clamp01(numberValue(source.parameters.get('directorIntensity'), 0)),
    directorBuild: clamp01(numberValue(source.parameters.get('directorBuild'), 0)),
    directorImpact: clamp01(numberValue(source.parameters.get('directorImpact'), 0)),
    vocalPresence: clamp01(numberValue(source.parameters.get('vocalPresence'), 0)),
    kickAccent: clamp01(numberValue(source.parameters.get('kickAccent'), 0)),
    snareAccent: clamp01(numberValue(source.parameters.get('snareAccent'), 0)),
    downbeatAccent: clamp01(numberValue(source.parameters.get('downbeatAccent'), 0)),
    phraseAccent: clamp01(numberValue(source.parameters.get('phraseAccent'), 0)),
    sectionAccent: clamp01(numberValue(source.parameters.get('sectionAccent'), 0)),
    dropAccent: clamp01(numberValue(source.parameters.get('dropAccent'), 0)),
  })
}

function createDomainRandomAdapter(context: Cinema2ModuleCreateContext): Cinema2AfterhoursRandomSource {
  return Object.freeze({
    sample(namespace: Parameters<Cinema2AfterhoursRandomSource['sample']>[0], index = 0) {
      const event = namespace.eventId ? `:${namespace.eventId}` : ''
      const purpose = `${namespace.purpose}${event}`
      return context.randomness.sample(purpose, index, namespace.substream)
    },
  })
}

function buildRenderBeams(
  config: Readonly<FrameConfig>,
  showPlan: Readonly<Cinema2AfterhoursShowPlan>,
  pulse: number,
  patternBeat: number,
  seed: string,
): readonly Cinema2AfterhoursRenderBeam[] {
  const pulseAuthority = resolveCinema2AfterhoursPulseAuthority(pulse, config.pulseAmount)
  const blackoutScale = clamp01(1 - showPlan.blackout * config.blackoutAmount)
  // Motion Amount scales how far each laser travels between its pattern endpoints; the default 0.55 plays them as authored and 0 fires every
  // hit at the step's first endpoint.
  const motion = config.motionAmount > 1e-5
    ? clamp((clamp01(config.motionAmount) / 0.55) * showPlan.motionScale + pulseAuthority * 0.1, 0, 1.4)
    : 0
  const frame = evaluateCinema2AfterhoursPattern({
    pattern: getCinema2AfterhoursPattern(showPlan.patternId),
    beat: patternBeat,
    seed,
    symmetry: showPlan.symmetry,
    spread: clamp01(config.spread * showPlan.spreadScale),
    motion,
    sideLasers: showPlan.sideLasers,
    topLasers: showPlan.topLasers,
    laserLimit: showPlan.laserLimit,
  })
  return Object.freeze(frame.rays.map(ray => {
    const bankIntensity = ray.fixtureId.includes('-bottom-') || ray.fixtureId.endsWith('center-00')
      ? showPlan.bottomIntensity
      : ray.fixtureId.includes('-overhead-') || ray.fixtureId.endsWith('center-01')
        ? showPlan.topIntensity
        : showPlan.sideIntensity
    return Object.freeze({
      fixtureId: ray.fixtureId,
      originWorld: ray.originWorld,
      targetWorld: ray.targetWorld,
      intensity: ray.intensity * bankIntensity * (1 + pulseAuthority * 0.42) * blackoutScale,
      alpha: blackoutScale,
      color: rayColor(ray, config),
      width: ray.width,
    })
  }))
}

/** Primary beams lean toward the accent colour by Accent Mix (a stable amount per mirrored pair); accent and white roles are exact. */
function rayColor(ray: Readonly<Cinema2AfterhoursPatternRay>, config: Readonly<FrameConfig>): Cinema2Color {
  if (ray.color === 'w') return WHITE
  if (ray.color === 'a') return config.accentColor
  const accent = clamp01(config.accentMix) * stableUnitHash(ray.pairId)
  const primary = config.primaryColor
  const secondary = config.accentColor
  return Object.freeze([0, 1, 2, 3].map(channel => primary[channel]! * (1 - accent) + secondary[channel]! * accent)) as unknown as Cinema2Color
}

/**
 * The musical position, in beats, that the laser cues count on. With BPM Sync on and beat tracking available it is the track's own position
 * (bar and beat-in-bar when the grid provides them, else the beat index plus its phase); otherwise it runs at a steady 120 BPM from the
 * clock, so a playing source with no tempo to follow still cues. (The caller stops asking while nothing plays, so silence holds still.)
 * Null when the time is unusable.
 */
export function resolveCinema2AfterhoursCueBeat(
  frame: Readonly<Cinema2ModuleUpdateContext['frame']>,
  timeSec: number,
  bpmSync: boolean,
): number | null {
  if (bpmSync) {
    const rhythm = frame.audio?.rhythm
    const phase = rhythm?.beatPhase
    const finite = (signal: { available: boolean; value: unknown } | undefined): signal is { available: true; value: number } =>
      signal?.available === true && typeof signal.value === 'number' && Number.isFinite(signal.value)
    if (rhythm && finite(phase)) {
      const fraction = Math.min(Math.max(phase.value, 0), 0.999)
      if (finite(rhythm.barIndex) && finite(rhythm.beatInBar)) return Math.floor(rhythm.barIndex.value) * 4 + Math.floor(rhythm.beatInBar.value) + fraction
      if (finite(rhythm.beatIndex)) return Math.floor(rhythm.beatIndex.value) + fraction
    }
    // Beat tracking has not resolved yet (or never will for this source): keep cueing on the clock rather than going dark.
  }
  return Number.isFinite(timeSec) ? (timeSec * FREE_RUN_BPM) / 60 : null
}

function resolveShowPlannerStructure(
  frame: Readonly<Cinema2ModuleUpdateContext['frame']>,
  config: Readonly<FrameConfig>,
): Readonly<Cinema2AfterhoursShowPlannerStructure> {
  const audio = frame.audio
  const timeSec = audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
  const barValue = audio?.rhythm.barIndex.available ? audio.rhythm.barIndex.value : null
  const absoluteBarIndex = typeof barValue === 'number' && Number.isFinite(barValue)
    ? Math.max(0, Math.floor(barValue))
    : null
  const phrases = audio?.structure.analyzedPhrases.available && audio.structure.analyzedPhrases.value
    ? audio.structure.analyzedPhrases.value
    : Object.freeze([])
  const phraseIdentity = latestStructuralIdentity(phrases, timeSec)
  const moments = audio?.structure.semanticMoments.available && audio.structure.semanticMoments.value
    ? audio.structure.semanticMoments.value.filter(moment => moment.type === 'drop' || moment.type === 'drop_impact')
    : Object.freeze([])
  const dropIdentity = latestStructuralIdentity(moments, timeSec)
  const transition = frame.director?.context.transition
  const canonicalPerformanceAvailable = audio != null && frame.transport?.sourcePresent !== false
  const hardCutIntent = Boolean(
    canonicalPerformanceAvailable
    && transition?.occurred
    && transition.authority >= 0.88
    && config.sectionAccent >= 0.62
    && config.directorImpact >= 0.72,
  )
  return Object.freeze({
    sourceIdentity: frame.transport?.trackId ?? 'no-source',
    absoluteBarIndex,
    phraseIdentity,
    sectionIdentity: frame.director?.context.section?.available ? frame.director.context.section.value?.id ?? null : null,
    dropIdentity,
    hardCutIntent,
    // Core Audio Intelligence remains active in Manual mode. Auto Performance
    // controls topology/show direction, not whether the authored laser design
    // is allowed to perform to the music.
    performance: canonicalPerformanceAvailable
      ? Object.freeze({
          intensity: config.directorIntensity,
          build: config.directorBuild,
          impact: config.directorImpact,
          vocalPresence: config.vocalPresence,
          kickAccent: config.kickAccent,
          snareAccent: config.snareAccent,
          downbeatAccent: config.downbeatAccent,
          phraseAccent: config.phraseAccent,
          sectionAccent: config.sectionAccent,
          dropAccent: config.dropAccent,
        })
      : undefined,
  })
}

function latestStructuralIdentity(
  items: readonly Readonly<{ id: string; timeSec: number }>[],
  timeSec: number,
): string | null {
  let latest: Readonly<{ id: string; timeSec: number }> | null = null
  for (const item of items) {
    if (!Number.isFinite(item.timeSec) || item.timeSec > timeSec + 1e-6) continue
    if (!latest || item.timeSec > latest.timeSec || (item.timeSec === latest.timeSec && item.id > latest.id)) latest = item
  }
  return latest?.id ?? null
}


/**
 * Routes the user-selected Trigger to authoritative Cinema 2.0 event identity.
 * It never invents timing: beat2/beat4 use canonical beat identity, bar4/bar8
 * use canonical bar identity, and phrase/drop use published structure.
 */
export function resolveCinema2AfterhoursTriggerEventIdentity(
  frame: Readonly<Cinema2ModuleUpdateContext['frame']>,
  trigger: Cinema2AfterhoursTriggerId,
  previousTimeSec: number | null,
): string | null {
  const audio = frame.audio
  if (!audio || frame.transport?.sourcePresent === false || frame.transport?.paused === true || frame.transport?.playing === false) return null
  if (trigger === 'beat') return audio.rhythm.beat?.id ?? null
  if (trigger === 'kick') return audio.rhythm.kick?.id ?? null
  if (trigger === 'snare') return audio.rhythm.snare?.id ?? null
  if (trigger === 'downbeat') return audio.rhythm.downbeat?.id ?? null
  if (trigger === 'beat2' || trigger === 'beat4') {
    const beat = audio.rhythm.beat
    const index = audio.rhythm.beatIndex.available ? audio.rhythm.beatIndex.value : null
    const divisor = trigger === 'beat2' ? 2 : 4
    return beat && typeof index === 'number' && Number.isFinite(index) && Math.floor(index) % divisor === 0 ? beat.id : null
  }
  if (trigger === 'bar' || trigger === 'bar4' || trigger === 'bar8') {
    const boundary = audio.rhythm.fixedClocks[4].boundary
    if (!boundary) return null
    if (trigger === 'bar') return boundary.id
    const bar = audio.rhythm.barIndex.available ? audio.rhythm.barIndex.value : null
    const divisor = trigger === 'bar4' ? 4 : 8
    return typeof bar === 'number' && Number.isFinite(bar) && Math.floor(bar) % divisor === 0 ? `${boundary.id}:${trigger}:${Math.floor(bar)}` : null
  }
  if (trigger === 'phrase') {
    const phrase = crossedStructuralIdentity(
      audio.structure.analyzedPhrases.available && audio.structure.analyzedPhrases.value ? audio.structure.analyzedPhrases.value : Object.freeze([]),
      previousTimeSec,
      audio.upstream.timeSec,
    )
    return phrase ?? audio.rhythm.fixedClocks[16].boundary?.id ?? null
  }
  const drop = crossedStructuralIdentity(
    audio.structure.semanticMoments.available && audio.structure.semanticMoments.value
      ? audio.structure.semanticMoments.value.filter(moment => moment.type === 'drop' || moment.type === 'drop_impact')
      : Object.freeze([]),
    previousTimeSec,
    audio.upstream.timeSec,
  )
  if (drop) return drop
  const transition = frame.director?.context.transition
  const section = frame.director?.context.section
  return transition?.occurred && transition.eventId && section?.available && section.value?.type === 'drop'
    ? transition.eventId
    : null
}

function crossedStructuralIdentity(
  items: readonly Readonly<{ id: string; timeSec: number }>[],
  previousTimeSec: number | null,
  currentTimeSec: number,
): string | null {
  if (previousTimeSec == null || !Number.isFinite(currentTimeSec) || currentTimeSec <= previousTimeSec) return null
  let crossed: Readonly<{ id: string; timeSec: number }> | null = null
  for (const item of items) {
    if (!Number.isFinite(item.timeSec) || item.timeSec <= previousTimeSec || item.timeSec > currentTimeSec + 1e-6) continue
    if (!crossed || item.timeSec > crossed.timeSec || (item.timeSec === crossed.timeSec && item.id > crossed.id)) crossed = item
  }
  return crossed?.id ?? null
}

export function resolveCinema2AfterhoursPulseAuthority(pulse: number, pulseAmount: number): number {
  return clamp01(pulse) * clamp01(pulseAmount)
}

export function resolveCinema2AfterhoursPulseEnvelope(
  frame: Readonly<Cinema2ModuleUpdateContext['frame']>,
  timeSec: number,
  startedAtSec: number,
  decay: number,
): number {
  if (!Number.isFinite(startedAtSec) || startedAtSec === Number.NEGATIVE_INFINITY) return 0
  if (frame.transport?.sourcePresent === false || frame.transport?.paused === true || frame.transport?.playing === false) return 0
  const elapsed = Math.max(0, timeSec - startedAtSec)
  let releaseSec = 0.08 + clamp01(decay) * 0.72
  const bpm = frame.audio?.rhythm.bpm
  if (bpm?.available && bpm.value != null && bpm.value > 1) {
    const beatSec = 60 / bpm.value
    releaseSec = beatSec * (0.18 + clamp01(decay) * 1.32)
  }
  if (releaseSec <= 1e-6 || elapsed >= releaseSec) return 0
  const normalized = clamp01(elapsed / releaseSec)
  return 1 - smoothstep(normalized)
}

function createAutoPalette(context: Cinema2ModuleCreateContext): Readonly<{ primary: Cinema2Color; accent: Cinema2Color }> {
  const hue = context.randomness.sample('afterhours-auto-palette-hue') * 360
  const accentOffset = 38 + context.randomness.sample('afterhours-auto-palette-offset') * 122
  return Object.freeze({
    primary: hslColor(hue, 0.82, 0.64),
    accent: hslColor(hue + accentOffset, 0.72, 0.72),
  })
}

function hslColor(hueDegrees: number, saturation: number, lightness: number): Cinema2Color {
  const h = (((hueDegrees % 360) + 360) % 360) / 360
  const s = clamp01(saturation)
  const l = clamp01(lightness)
  if (s <= 1e-6) return Object.freeze([l, l, l, 1]) as Cinema2Color
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return Object.freeze([hueChannel(p, q, h + 1 / 3), hueChannel(p, q, h), hueChannel(p, q, h - 1 / 3), 1]) as Cinema2Color
}

function hueChannel(p: number, q: number, input: number): number {
  let t = input
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

/**
 * The module's clock. With a source it is the track's time. With no source it is the frame's visual time, which the host freezes while
 * nothing plays (and lets run in hosts with no transport at all): never the wall clock, or the lasers would keep moving in silence.
 */
function resolveTimeSec(frame: Readonly<Cinema2ModuleUpdateContext['frame']>): number {
  if (frame.transport?.sourcePresent === false) return frame.elapsedTimeSec
  const transportTime = frame.transport?.timeSec
  return typeof transportTime === 'number' && Number.isFinite(transportTime) ? transportTime : frame.elapsedTimeSec
}

function stableUnitHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function isTrigger(value: unknown): value is Cinema2AfterhoursTriggerId {
  return typeof value === 'string' && TRIGGER_SET.has(value)
}

function isPatternChange(value: unknown): value is Cinema2AfterhoursPatternChangeId {
  return typeof value === 'string' && PATTERN_CHANGE_SET.has(value)
}

function isColor(value: unknown): value is Cinema2Color {
  return Array.isArray(value)
    && value.length === 4
    && value.every(component => typeof component === 'number' && Number.isFinite(component) && component >= 0 && component <= 1)
}

function colorValue(value: Cinema2JsonValue | undefined, fallback: Cinema2Color): Cinema2Color {
  return isColor(value) ? Object.freeze([...value]) as Cinema2Color : fallback
}

function numberValue(value: Cinema2JsonValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function booleanValue(value: Cinema2JsonValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function diagnostic(code: string, path: string, message: string): Cinema2ModuleDiagnostic {
  return { code, path, message }
}

function smoothstep(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}
