import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2JsonValue,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleFrameReadContext,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import {
  CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID,
  CINEMA2_INTERLOCK_FIXTURE_COUNT,
  CINEMA2_INTERLOCK_PATTERN_IDS,
  type Cinema2InterlockPatternId,
  type Cinema2InterlockResolvedFixtureGeometry,
  type Cinema2InterlockTransitionState,
  type Cinema2InterlockViewport,
} from './interlock/Cinema2InterlockDomain'
import {
  createCinema2InterlockTransitionState,
  resolveCinema2InterlockGeometryFromPivot,
  resolveCinema2InterlockLayout,
  resolveCinema2InterlockTransition,
} from './interlock/Cinema2InterlockGeometry'
import { getCinema2InterlockPatternTarget, normalizeCinema2InterlockPatternId } from './interlock/Cinema2InterlockPatternCatalog'
import { CINEMA2_INTERLOCK_RIG, getCinema2InterlockFixture } from './interlock/Cinema2InterlockRig'
import {
  CINEMA2_INTERLOCK_DEFAULT_LIT_DENSITY,
  CINEMA2_INTERLOCK_DEFAULT_MIRROR_SEGMENT_DIRECTION,
  CINEMA2_INTERLOCK_DEFAULT_SEGMENT_AFTERGLOW,
  CINEMA2_INTERLOCK_DEFAULT_SEGMENT_FADE,
  CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID,
  CINEMA2_INTERLOCK_DEFAULT_SEGMENT_SPEED,
  CINEMA2_INTERLOCK_DEFAULT_UNLIT_VISIBILITY,
  CINEMA2_INTERLOCK_SEGMENT_BANK_INDEX,
  CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS,
  normalizeCinema2InterlockSegmentProgramId,
  resolveCinema2InterlockCellCount,
  type Cinema2InterlockSegmentProgramId,
} from './interlock/Cinema2InterlockSegments'
import {
  Cinema2InterlockClockResolver,
  nextCinema2InterlockBeatBoundary,
  resolveCinema2InterlockSegmentClockPhase,
} from './interlock/Cinema2InterlockClock'
import {
  Cinema2InterlockRenderer,
  type Cinema2InterlockRenderFixture,
} from './interlock/Cinema2InterlockRenderer'
import {
  CINEMA2_INTERLOCK_PATTERN_CHANGE_IDS,
  CINEMA2_INTERLOCK_TRIGGER_IDS,
  planCinema2InterlockShow,
  type Cinema2InterlockPatternChangeId,
  type Cinema2InterlockRandomSource,
  type Cinema2InterlockShowPlan,
  type Cinema2InterlockShowPlannerStructure,
  type Cinema2InterlockTriggerId,
} from './interlock/Cinema2InterlockShowPlanner'

export const CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('interlock-native-render')
export const CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION = 1 as const

export const CINEMA2_INTERLOCK_NATIVE_PARAMETER_NAMES = Object.freeze([
  'pattern',
  'ledColor',
  'ledIntensity',
  'rotationAmount',
  'morphDuration',
  'symmetry',
  'segmentPattern',
  'litDensity',
  'segmentSpeed',
  'segmentFade',
  'segmentAfterglow',
  'unlitVisibility',
  'mirrorSegmentDirection',
  'segmentEnergy',
  'segmentImpact',
  'segmentDirectionBias',
  'segmentBankPhase',
  'effectsIntensity',
  'autoPerformance',
  'patternChange',
  'masterReactivity',
  'bassRotation',
  'segmentReactivity',
  'transientPulse',
  'highShimmer',
  'buildTension',
  'vocalRestraint',
  'trigger',
  'directorIntensity',
  'directorMomentum',
  'directorBuild',
  'directorImpact',
  'directorVariation',
  'subEnergy',
  'bassEnergy',
  'overallEnergy',
  'spectralFlux',
  'highEnergy',
  'airEnergy',
  'vocalPresence',
  'kickAccent',
  'snareAccent',
  'downbeatAccent',
  'barAccent',
  'phraseAccent',
  'sectionAccent',
  'dropAccent',
] as const)

const PARAMETER_NAME_SET = new Set<string>(CINEMA2_INTERLOCK_NATIVE_PARAMETER_NAMES)
const DEFAULT_LED_COLOR = Object.freeze([0.94, 0.98, 1, 1]) as Cinema2Color
const DEFAULT_LED_INTENSITY = 0.78
const DEFAULT_ROTATION_AMOUNT = 0.75
const DEFAULT_MORPH_DURATION_SEC = 2
const DEFAULT_SYMMETRY = true
const MIN_MORPH_DURATION_SEC = 0.25
const MAX_MORPH_DURATION_SEC = 8
const EXCURSION_SCALE_RADIANS = 0.18
const DEFAULT_SEGMENT_ENERGY = 0.65
const DEFAULT_SEGMENT_IMPACT = 0
const DEFAULT_SEGMENT_DIRECTION_BIAS = 0
const DEFAULT_SEGMENT_BANK_PHASE = 0
const DEFAULT_EFFECTS_INTENSITY = 0.35
const DEFAULT_AUTO_PERFORMANCE = true
const DEFAULT_MASTER_REACTIVITY = 0.75
const DEFAULT_BASS_ROTATION = 0.6
const DEFAULT_SEGMENT_REACTIVITY = 0.75
const DEFAULT_TRANSIENT_PULSE = 0.7
const DEFAULT_HIGH_SHIMMER = 0.15
const DEFAULT_BUILD_TENSION = 0.65
const DEFAULT_VOCAL_RESTRAINT = 0.35

interface FrameConfig {
  readonly pattern: Cinema2InterlockPatternId
  readonly ledColor: Cinema2Color
  readonly ledIntensity: number
  readonly rotationAmount: number
  readonly morphDurationSec: number
  readonly symmetry: boolean
  readonly segmentPattern: Cinema2InterlockSegmentProgramId
  readonly litDensity: number
  readonly segmentSpeed: number
  readonly segmentFade: number
  readonly segmentAfterglow: number
  readonly unlitVisibility: number
  readonly mirrorSegmentDirection: boolean
  readonly segmentEnergy: number
  readonly segmentImpact: number
  readonly segmentDirectionBias: number
  readonly segmentBankPhase: number
  readonly effectsIntensity: number
  readonly autoPerformance: boolean
  readonly patternChange: Cinema2InterlockPatternChangeId
  readonly masterReactivity: number
  readonly bassRotation: number
  readonly segmentReactivity: number
  readonly transientPulse: number
  readonly highShimmer: number
  readonly buildTension: number
  readonly vocalRestraint: number
  readonly trigger: Cinema2InterlockTriggerId
  readonly directorIntensity: number
  readonly directorMomentum: number
  readonly directorBuild: number
  readonly directorImpact: number
  readonly directorVariation: number
  readonly subEnergy: number
  readonly bassEnergy: number
  readonly overallEnergy: number
  readonly spectralFlux: number
  readonly highEnergy: number
  readonly airEnergy: number
  readonly vocalPresence: number
  readonly kickAccent: number
  readonly snareAccent: number
  readonly downbeatAccent: number
  readonly barAccent: number
  readonly phraseAccent: number
  readonly sectionAccent: number
  readonly dropAccent: number
}

interface ActiveTransition {
  readonly targetPatternId: Cinema2InterlockPatternId
  readonly states: readonly Cinema2InterlockTransitionState[]
  readonly durationBeats: number
  progress: number
}

interface PendingTransition {
  readonly targetPatternId: Cinema2InterlockPatternId
  readonly startBeat: number
  readonly durationBeats: number
}

function validate(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  const parameters = module.parameters ?? {}

  for (const property of CINEMA2_INTERLOCK_NATIVE_PARAMETER_NAMES) {
    if (parameters[property] === undefined) diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_MODULE_PARAMETER_MISSING',
      `$.parameters.${property}`,
      `Interlock native renderer requires the "${property}" parameter.`,
    ))
  }
  for (const property of Object.keys(parameters)) {
    if (!PARAMETER_NAME_SET.has(property)) diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_MODULE_PARAMETER_UNKNOWN',
      `$.parameters.${property}`,
      `Interlock native renderer does not support the "${property}" parameter.`,
    ))
  }
  if (parameters.pattern !== undefined && !isPattern(parameters.pattern)) {
    diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_PATTERN_INVALID',
      '$.parameters.pattern',
      `Interlock Pattern must be one of: ${CINEMA2_INTERLOCK_PATTERN_IDS.join(', ')}.`,
    ))
  }
  if (parameters.ledColor !== undefined && !isColor(parameters.ledColor)) {
    diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_LED_COLOR_INVALID',
      '$.parameters.ledColor',
      'Interlock LED Color must contain four finite values from 0 through 1.',
    ))
  }
  for (const property of ['ledIntensity', 'rotationAmount'] as const) {
    if (parameters[property] !== undefined && !numberInRange(parameters[property], 0, 1)) {
      diagnostics.push(diagnostic(
        'CINEMA2_INTERLOCK_NORMALIZED_PARAMETER_INVALID',
        `$.parameters.${property}`,
        `Interlock "${property}" must be between 0 and 1.`,
      ))
    }
  }
  if (parameters.morphDuration !== undefined && !numberInRange(parameters.morphDuration, MIN_MORPH_DURATION_SEC, MAX_MORPH_DURATION_SEC)) {
    diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_MORPH_DURATION_INVALID',
      '$.parameters.morphDuration',
      `Interlock Morph Duration must be between ${MIN_MORPH_DURATION_SEC} and ${MAX_MORPH_DURATION_SEC} seconds.`,
    ))
  }
  if (parameters.symmetry !== undefined && typeof parameters.symmetry !== 'boolean') {
    diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_SYMMETRY_INVALID',
      '$.parameters.symmetry',
      'Interlock Symmetry must be boolean.',
    ))
  }
  if (parameters.autoPerformance !== undefined && typeof parameters.autoPerformance !== 'boolean') {
    diagnostics.push(diagnostic('CINEMA2_INTERLOCK_AUTO_PERFORMANCE_INVALID', '$.parameters.autoPerformance', 'Interlock Auto Performance must be boolean.'))
  }
  if (parameters.patternChange !== undefined && !isPatternChange(parameters.patternChange)) {
    diagnostics.push(diagnostic('CINEMA2_INTERLOCK_PATTERN_CHANGE_INVALID', '$.parameters.patternChange', `Interlock Pattern Change must be one of: ${CINEMA2_INTERLOCK_PATTERN_CHANGE_IDS.join(', ')}.`))
  }
  if (parameters.trigger !== undefined && !isTrigger(parameters.trigger)) {
    diagnostics.push(diagnostic('CINEMA2_INTERLOCK_TRIGGER_INVALID', '$.parameters.trigger', `Interlock Trigger must be one of: ${CINEMA2_INTERLOCK_TRIGGER_IDS.join(', ')}.`))
  }
  if (parameters.segmentPattern !== undefined && !isSegmentProgram(parameters.segmentPattern)) {
    diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_SEGMENT_PATTERN_INVALID',
      '$.parameters.segmentPattern',
      `Interlock Segment Pattern must be one of: ${CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS.join(', ')}.`,
    ))
  }
  for (const [property, minimum, maximum] of [
    ['litDensity', 0.05, 1],
    ['segmentSpeed', 0, 1],
    ['segmentFade', 0, 1],
    ['segmentAfterglow', 0, 1],
    ['unlitVisibility', 0, 0.15],
    ['segmentEnergy', 0, 1],
    ['segmentImpact', 0, 1],
    ['segmentDirectionBias', -1, 1],
    ['segmentBankPhase', 0, 1],
    ['effectsIntensity', 0, 1],
    ['masterReactivity', 0, 1],
    ['bassRotation', 0, 1],
    ['segmentReactivity', 0, 1],
    ['transientPulse', 0, 1],
    ['highShimmer', 0, 1],
    ['buildTension', 0, 1],
    ['vocalRestraint', 0, 1],
    ['directorIntensity', 0, 1],
    ['directorMomentum', 0, 1],
    ['directorBuild', 0, 1],
    ['directorImpact', 0, 1],
    ['directorVariation', 0, 1],
    ['subEnergy', 0, 1],
    ['bassEnergy', 0, 1],
    ['overallEnergy', 0, 1],
    ['spectralFlux', 0, 1],
    ['highEnergy', 0, 1],
    ['airEnergy', 0, 1],
    ['vocalPresence', 0, 1],
    ['kickAccent', 0, 1],
    ['snareAccent', 0, 1],
    ['downbeatAccent', 0, 1],
    ['barAccent', 0, 1],
    ['phraseAccent', 0, 1],
    ['sectionAccent', 0, 1],
    ['dropAccent', 0, 1],
  ] as const) {
    if (parameters[property] !== undefined && !numberInRange(parameters[property], minimum, maximum)) {
      diagnostics.push(diagnostic(
        'CINEMA2_INTERLOCK_SEGMENT_PARAMETER_INVALID',
        `$.parameters.${property}`,
        `Interlock "${property}" must be between ${minimum} and ${maximum}.`,
      ))
    }
  }
  if (parameters.mirrorSegmentDirection !== undefined && typeof parameters.mirrorSegmentDirection !== 'boolean') {
    diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_INVALID',
      '$.parameters.mirrorSegmentDirection',
      'Interlock Mirror Segment Direction must be boolean.',
    ))
  }
  if (module.config && Object.keys(module.config).length > 0) {
    diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_MODULE_CONFIG_UNSUPPORTED',
      '$.config',
      'Interlock does not accept module-local config; authored state belongs in supported parameters.',
    ))
  }
  return Object.freeze(diagnostics.map(entry => Object.freeze(entry)))
}

export const cinema2InterlockNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
  validate,
  create: (context: Cinema2ModuleCreateContext) => {
    let config = readFrameConfig(context)
    let renderFixtures: readonly Cinema2InterlockRenderFixture[] = Object.freeze([])
    let currentGeometry = new Map<string, Readonly<Cinema2InterlockResolvedFixtureGeometry>>()
    let transition: ActiveTransition | null = null
    let pendingTransition: PendingTransition | null = null
    let activePattern = config.pattern
    let lastViewportKey: string | null = null
    let lastMotionBeatPosition: number | null = null
    let lastReanchorGeneration: number | null = null
    let segmentPhase = 0
    const clockResolver = new Cinema2InterlockClockResolver()
    const randomAdapter = createInterlockRandomAdapter(context)
    let showPlan: Readonly<Cinema2InterlockShowPlan> | null = null
    let lastTrackId: string | null | undefined = undefined
    let lastSourceId: string | null | undefined = undefined
    let lastPaused: boolean | null = null
    let lastTimeSec: number | null = null
    let lastContextGeneration: number | null = null
    let renderSegmentPattern = config.segmentPattern
    let renderLedIntensity = config.ledIntensity
    let renderLitDensity = config.litDensity
    let renderSegmentSpeed = config.segmentSpeed
    let renderSegmentEnergy = config.segmentEnergy
    let renderSegmentImpact = config.segmentImpact
    let renderSegmentDirectionBias = config.segmentDirectionBias
    let renderSegmentBankPhase = config.segmentBankPhase
    let reactiveRotationAmount = config.rotationAmount
    let disposed = false

    const rebuildSettledLayout = (viewport: Cinema2InterlockViewport, patternId = config.pattern) => {
      const layout = resolveCinema2InterlockLayout(patternId, viewport)
      currentGeometry = new Map(layout.fixtures.map(candidate => [candidate.fixtureId, candidate]))
      activePattern = layout.patternId
      transition = null
      renderFixtures = toRenderFixtures(layout.fixtures, config.mirrorSegmentDirection)
    }

    const beginPatternTransition = (viewport: Cinema2InterlockViewport, targetPatternId: Cinema2InterlockPatternId, durationBeats = 2) => {
      if (currentGeometry.size !== CINEMA2_INTERLOCK_FIXTURE_COUNT) {
        rebuildSettledLayout(viewport, activePattern)
      }
      const states = CINEMA2_INTERLOCK_RIG.fixtures.map((fixture, index) => {
        const current = currentGeometry.get(fixture.id)
        if (!current) throw new Error(`Interlock transition is missing fixture geometry for ${fixture.id}.`)
        const target = getCinema2InterlockPatternTarget(targetPatternId, fixture.id)
        return createCinema2InterlockTransitionState(
          current,
          target,
          targetPatternId,
          resolveTransitionRotationMode(target.rotationMode, fixture.mirrorSide, index, config.symmetry),
        )
      })
      transition = { targetPatternId, states: Object.freeze(states), durationBeats: clamp(durationBeats, 0.5, 4), progress: 0 }
      pendingTransition = null
    }

    const requestPatternTransition = (
      viewport: Cinema2InterlockViewport,
      targetPatternId: Cinema2InterlockPatternId,
      syncEnabled: boolean,
      canonicalBeatPosition: number,
      durationBeats: number,
    ) => {
      if (!syncEnabled) {
        beginPatternTransition(viewport, targetPatternId, durationBeats)
        return
      }
      pendingTransition = Object.freeze({
        targetPatternId,
        startBeat: nextCinema2InterlockBeatBoundary(canonicalBeatPosition),
        durationBeats: clamp(durationBeats, 0.5, 4),
      })
    }

    const provider = Object.freeze({
      id: `${context.module.id}:interlock-native`,
      moduleId: context.module.id,
      intent: 'fullscreen' as const,
      execute(execution: Cinema2ModuleRenderExecutionContext) {
        if (disposed) return
        const renderer = context.resources.acquire(
          'interlock-native-renderer',
          'Cinema2InterlockRenderer',
          gl => new Cinema2InterlockRenderer(gl),
          value => value.dispose(),
        )
        renderer.draw({
          target: execution.target,
          fixtures: renderFixtures,
          width: execution.width,
          height: execution.height,
          ledColor: config.ledColor,
          ledIntensity: renderLedIntensity,
          segmentProgram: renderSegmentPattern,
          segmentPhase,
          litDensity: renderLitDensity,
          segmentFade: config.segmentFade,
          segmentAfterglow: config.segmentAfterglow * config.effectsIntensity,
          unlitVisibility: config.unlitVisibility,
          segmentEnergy: renderSegmentEnergy,
          segmentImpact: renderSegmentImpact * config.effectsIntensity,
          segmentDirectionBias: renderSegmentDirectionBias,
          segmentBankPhase: renderSegmentBankPhase,
        })
      },
    })

    return {
      lifecycle: {
        update(updateContext: Cinema2ModuleUpdateContext) {
          if (disposed) return
          const { frame } = updateContext
          const previousConfig = config
          config = readFrameConfig(updateContext)
          const viewport = normalizeViewport(frame)
          const nextViewportKey = viewportKey(viewport)
          const clock = clockResolver.resolve(frame)
          const currentTimeSec = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
          const discontinuity = Boolean(frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation')
          const backwards = lastTimeSec != null && currentTimeSec < lastTimeSec - 1e-6
          const currentSourceId = frame.audio?.upstream.sourceId ?? null
          const sourceReplaced = (lastTrackId !== undefined && frame.transport?.trackId !== lastTrackId)
            || (lastSourceId !== undefined && currentSourceId !== lastSourceId)
          const contextChanged = lastContextGeneration != null && frame.contextGeneration !== lastContextGeneration
          const paused = frame.transport?.sourcePresent === true && frame.transport.paused === true
          const enteredPause = paused && lastPaused === false
          if (discontinuity || backwards || sourceReplaced || contextChanged) {
            showPlan = null
            transition = null
            pendingTransition = null
          }
          if (enteredPause) {
            transition = null
            pendingTransition = null
          }

          const structure = resolveInterlockShowPlannerStructure(frame, config)
          showPlan = planCinema2InterlockShow(config, structure, randomAdapter, showPlan)
          // Choreography strength already applies Master Reactivity before values reach runtime targets.
          // Auto Performance owns show selection only; reactive target values remain live in manual mode.
          const vocalReduction = 1 - config.vocalRestraint * config.vocalPresence * 0.48
          const triggerAccent = resolveInterlockTriggerAccent(config)
          const bass = Math.max(config.subEnergy, config.bassEnergy)
          renderSegmentPattern = showPlan.segmentProgram
          const highAirShimmer = Math.max(config.highEnergy, config.airEnergy) * config.highShimmer
          renderLedIntensity = clamp01(config.ledIntensity * (0.72 + config.directorIntensity * 0.34 + triggerAccent * config.transientPulse * 0.28 + highAirShimmer * 0.08) * vocalReduction)
          renderLitDensity = clamp(config.litDensity * showPlan.densityScale * vocalReduction, 0.05, 1)
          renderSegmentSpeed = clamp01(config.segmentSpeed * (0.76 + config.directorMomentum * 0.58 + config.directorBuild * config.buildTension * 0.22))
          renderSegmentEnergy = clamp01(config.segmentEnergy + config.overallEnergy * config.segmentReactivity * 0.52 + bass * config.segmentReactivity * 0.28 + highAirShimmer * 0.10)
          renderSegmentImpact = clamp01(Math.max(config.segmentImpact, triggerAccent * config.transientPulse, config.directorImpact * 0.55))
          const snareDirection = config.snareAccent > 0.05 ? (((finiteBeatIndex(frame) ?? 0) % 2 === 0) ? 0.36 : -0.36) * config.snareAccent : 0
          renderSegmentDirectionBias = clamp(config.segmentDirectionBias + showPlan.segmentDirectionBias + snareDirection, -1, 1)
          renderSegmentBankPhase = fract(config.segmentBankPhase + showPlan.bankStagger + config.barAccent * 0.18 + config.snareAccent * 0.11)
          reactiveRotationAmount = clamp01(config.rotationAmount * (0.72 + bass * config.bassRotation * 0.42 + config.kickAccent * config.bassRotation * 0.18 + config.directorBuild * config.buildTension * 0.18))
          segmentPhase = resolveCinema2InterlockSegmentClockPhase(clock, renderSegmentSpeed)
          const resized = lastViewportKey != null && lastViewportKey !== nextViewportKey
          const reanchored = lastReanchorGeneration != null && clock.reanchorGeneration !== lastReanchorGeneration

          if (pendingTransition && reanchored && clock.syncEnabled) {
            pendingTransition = Object.freeze({
              targetPatternId: pendingTransition.targetPatternId,
              startBeat: nextCinema2InterlockBeatBoundary(clock.canonicalBeatPosition),
              durationBeats: pendingTransition.durationBeats,
            })
          }

          const desiredPattern = showPlan.layoutId
          const currentGoal = pendingTransition?.targetPatternId ?? transition?.targetPatternId ?? activePattern
          if (lastViewportKey == null || currentGeometry.size === 0 || resized) {
            rebuildSettledLayout(viewport, desiredPattern)
            pendingTransition = null
          } else if (!paused && (desiredPattern !== currentGoal || (!config.autoPerformance && config.pattern !== previousConfig.pattern))) {
            requestPatternTransition(viewport, desiredPattern, clock.syncEnabled, clock.canonicalBeatPosition, showPlan.transitionBeats)
          }

          if (pendingTransition && (
            !clock.syncEnabled
            || clock.canonicalBeatPosition + 1e-6 >= pendingTransition.startBeat
          )) {
            beginPatternTransition(viewport, pendingTransition.targetPatternId, pendingTransition.durationBeats)
          }

          if (transition) {
            if (animationActive(frame)) {
              if (clock.syncEnabled) {
                const deltaBeats = lastMotionBeatPosition == null || reanchored
                  ? 0
                  : Math.max(0, clock.motionBeatPosition - lastMotionBeatPosition)
                transition.progress += deltaBeats / Math.max(0.5, transition.durationBeats)
              } else {
                transition.progress += Math.max(0, finite(frame.deltaTimeSec, 0)) / config.morphDurationSec
              }
            }
            const progress = clamp01(transition.progress)
            const next = transition.states.map((state, index) => resolveTransitionFixture(
              state,
              progress,
              reactiveRotationAmount,
              config.symmetry,
              index,
            ))
            currentGeometry = new Map(next.map(candidate => [candidate.fixtureId, candidate]))
            renderFixtures = toRenderFixtures(next, config.mirrorSegmentDirection)
            if (progress >= 1) {
              // Always settle to the Stage 1 authored target. Rotation Amount
              // only governs the legal-pivot angular excursion during the morph.
              rebuildSettledLayout(viewport, transition.targetPatternId)
            }
          }

          if (config.mirrorSegmentDirection !== previousConfig.mirrorSegmentDirection && currentGeometry.size === CINEMA2_INTERLOCK_FIXTURE_COUNT) {
            renderFixtures = toRenderFixtures([...currentGeometry.values()], config.mirrorSegmentDirection)
          }

          lastViewportKey = nextViewportKey
          lastMotionBeatPosition = clock.motionBeatPosition
          lastReanchorGeneration = clock.reanchorGeneration
          lastTrackId = frame.transport?.trackId
          lastSourceId = currentSourceId
          lastPaused = paused
          lastTimeSec = currentTimeSec
          lastContextGeneration = frame.contextGeneration
        },
        dispose() {
          disposed = true
          transition = null
          pendingTransition = null
          currentGeometry.clear()
          renderFixtures = Object.freeze([])
          showPlan = null
          clockResolver.reset()
        },
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
})

function resolveTransitionFixture(
  state: Readonly<Cinema2InterlockTransitionState>,
  progress: number,
  rotationAmount: number,
  symmetry: boolean,
  fixtureIndex: number,
): Cinema2InterlockResolvedFixtureGeometry {
  const base = resolveCinema2InterlockTransition(state, smoothstep(progress))
  if (progress <= 0 || progress >= 1 || rotationAmount <= 0) return base

  const mirrorSign = fixtureIndex % 2 === 0 ? -1 : 1
  const freeSign = fixtureIndex % 4 < 2 ? -1 : 1
  const direction = symmetry ? mirrorSign : freeSign
  const angularExcursion = Math.sin(Math.PI * progress)
    * Math.min(Math.abs(state.deltaAngleRad), Math.PI)
    * EXCURSION_SCALE_RADIANS
    * clamp01(rotationAmount)
    * direction

  return resolveCinema2InterlockGeometryFromPivot({
    fixtureId: base.fixtureId,
    patternId: base.patternId,
    pivot: state.pivot,
    pivotPoint: state.pivotPoint,
    angleRad: base.angleRad + angularExcursion,
    lengthPx: state.lengthPx,
    thicknessPx: state.thicknessPx,
  })
}

function resolveTransitionRotationMode(
  authored: Cinema2InterlockTransitionState['rotationMode'],
  mirrorSide: 'left' | 'right',
  fixtureIndex: number,
  symmetry: boolean,
): Cinema2InterlockTransitionState['rotationMode'] {
  if (symmetry) return authored
  if (authored === 'longest') return authored
  if (fixtureIndex % 3 === 0) return mirrorSide === 'left' ? 'clockwise' : 'counterclockwise'
  return authored
}

function toRenderFixtures(
  fixtures: readonly Readonly<Cinema2InterlockResolvedFixtureGeometry>[],
  mirrorSegmentDirection: boolean,
): readonly Cinema2InterlockRenderFixture[] {
  if (fixtures.length !== CINEMA2_INTERLOCK_FIXTURE_COUNT) {
    throw new Error(`Interlock expected ${CINEMA2_INTERLOCK_FIXTURE_COUNT} resolved fixtures, received ${fixtures.length}.`)
  }
  return Object.freeze(fixtures.map((geometry, index) => {
    const fixture = getCinema2InterlockFixture(geometry.fixtureId)
    if (!fixture) throw new Error(`Interlock render data is missing rig fixture ${geometry.fixtureId}.`)
    return Object.freeze({
      fixtureId: geometry.fixtureId,
      geometry,
      cellCount: resolveCinema2InterlockCellCount(fixture),
      segmentDirection: mirrorSegmentDirection && fixture.mirrorSide === 'right' ? -1 as const : 1 as const,
      bankIndex: CINEMA2_INTERLOCK_SEGMENT_BANK_INDEX[fixture.bank],
      fixtureOrder: Math.floor(index / 2) / Math.max(1, CINEMA2_INTERLOCK_RIG.pairs.length - 1),
    })
  }))
}

function readFrameConfig(
  source: Pick<Cinema2ModuleCreateContext, 'parameters'> | Pick<Cinema2ModuleUpdateContext, 'parameters'>,
): FrameConfig {
  return Object.freeze({
    pattern: normalizeCinema2InterlockPatternId(source.parameters.get('pattern')),
    ledColor: colorValue(source.parameters.get('ledColor'), DEFAULT_LED_COLOR),
    ledIntensity: clamp01(numberValue(source.parameters.get('ledIntensity'), DEFAULT_LED_INTENSITY)),
    rotationAmount: clamp01(numberValue(source.parameters.get('rotationAmount'), DEFAULT_ROTATION_AMOUNT)),
    morphDurationSec: clamp(numberValue(source.parameters.get('morphDuration'), DEFAULT_MORPH_DURATION_SEC), MIN_MORPH_DURATION_SEC, MAX_MORPH_DURATION_SEC),
    symmetry: booleanValue(source.parameters.get('symmetry'), DEFAULT_SYMMETRY),
    segmentPattern: normalizeCinema2InterlockSegmentProgramId(source.parameters.get('segmentPattern')),
    litDensity: clamp(numberValue(source.parameters.get('litDensity'), CINEMA2_INTERLOCK_DEFAULT_LIT_DENSITY), 0.05, 1),
    segmentSpeed: clamp01(numberValue(source.parameters.get('segmentSpeed'), CINEMA2_INTERLOCK_DEFAULT_SEGMENT_SPEED)),
    segmentFade: clamp01(numberValue(source.parameters.get('segmentFade'), CINEMA2_INTERLOCK_DEFAULT_SEGMENT_FADE)),
    segmentAfterglow: clamp01(numberValue(source.parameters.get('segmentAfterglow'), CINEMA2_INTERLOCK_DEFAULT_SEGMENT_AFTERGLOW)),
    unlitVisibility: clamp(numberValue(source.parameters.get('unlitVisibility'), CINEMA2_INTERLOCK_DEFAULT_UNLIT_VISIBILITY), 0, 0.15),
    mirrorSegmentDirection: booleanValue(source.parameters.get('mirrorSegmentDirection'), CINEMA2_INTERLOCK_DEFAULT_MIRROR_SEGMENT_DIRECTION),
    segmentEnergy: clamp01(numberValue(source.parameters.get('segmentEnergy'), DEFAULT_SEGMENT_ENERGY)),
    segmentImpact: clamp01(numberValue(source.parameters.get('segmentImpact'), DEFAULT_SEGMENT_IMPACT)),
    segmentDirectionBias: clamp(numberValue(source.parameters.get('segmentDirectionBias'), DEFAULT_SEGMENT_DIRECTION_BIAS), -1, 1),
    segmentBankPhase: clamp01(numberValue(source.parameters.get('segmentBankPhase'), DEFAULT_SEGMENT_BANK_PHASE)),
    effectsIntensity: clamp01(numberValue(source.parameters.get('effectsIntensity'), DEFAULT_EFFECTS_INTENSITY)),
    autoPerformance: booleanValue(source.parameters.get('autoPerformance'), DEFAULT_AUTO_PERFORMANCE),
    patternChange: isPatternChange(source.parameters.get('patternChange')) ? source.parameters.get('patternChange') as Cinema2InterlockPatternChangeId : 'phrase',
    masterReactivity: clamp01(numberValue(source.parameters.get('masterReactivity'), DEFAULT_MASTER_REACTIVITY)),
    bassRotation: clamp01(numberValue(source.parameters.get('bassRotation'), DEFAULT_BASS_ROTATION)),
    segmentReactivity: clamp01(numberValue(source.parameters.get('segmentReactivity'), DEFAULT_SEGMENT_REACTIVITY)),
    transientPulse: clamp01(numberValue(source.parameters.get('transientPulse'), DEFAULT_TRANSIENT_PULSE)),
    highShimmer: clamp01(numberValue(source.parameters.get('highShimmer'), DEFAULT_HIGH_SHIMMER)),
    buildTension: clamp01(numberValue(source.parameters.get('buildTension'), DEFAULT_BUILD_TENSION)),
    vocalRestraint: clamp01(numberValue(source.parameters.get('vocalRestraint'), DEFAULT_VOCAL_RESTRAINT)),
    trigger: isTrigger(source.parameters.get('trigger')) ? source.parameters.get('trigger') as Cinema2InterlockTriggerId : 'auto',
    directorIntensity: clamp01(numberValue(source.parameters.get('directorIntensity'), 0)),
    directorMomentum: clamp01(numberValue(source.parameters.get('directorMomentum'), 0)),
    directorBuild: clamp01(numberValue(source.parameters.get('directorBuild'), 0)),
    directorImpact: clamp01(numberValue(source.parameters.get('directorImpact'), 0)),
    directorVariation: clamp01(numberValue(source.parameters.get('directorVariation'), 0)),
    subEnergy: clamp01(numberValue(source.parameters.get('subEnergy'), 0)),
    bassEnergy: clamp01(numberValue(source.parameters.get('bassEnergy'), 0)),
    overallEnergy: clamp01(numberValue(source.parameters.get('overallEnergy'), 0)),
    spectralFlux: clamp01(numberValue(source.parameters.get('spectralFlux'), 0)),
    highEnergy: clamp01(numberValue(source.parameters.get('highEnergy'), 0)),
    airEnergy: clamp01(numberValue(source.parameters.get('airEnergy'), 0)),
    vocalPresence: clamp01(numberValue(source.parameters.get('vocalPresence'), 0)),
    kickAccent: clamp01(numberValue(source.parameters.get('kickAccent'), 0)),
    snareAccent: clamp01(numberValue(source.parameters.get('snareAccent'), 0)),
    downbeatAccent: clamp01(numberValue(source.parameters.get('downbeatAccent'), 0)),
    barAccent: clamp01(numberValue(source.parameters.get('barAccent'), 0)),
    phraseAccent: clamp01(numberValue(source.parameters.get('phraseAccent'), 0)),
    sectionAccent: clamp01(numberValue(source.parameters.get('sectionAccent'), 0)),
    dropAccent: clamp01(numberValue(source.parameters.get('dropAccent'), 0)),
  })
}

function createInterlockRandomAdapter(context: Cinema2ModuleCreateContext): Cinema2InterlockRandomSource {
  return Object.freeze({
    sample(purpose: string, eventId: string, index = 0) {
      return context.randomness.sample(`${purpose}:${eventId}`, index, 'show-planner')
    },
  })
}

function resolveInterlockShowPlannerStructure(
  frame: Readonly<Cinema2ModuleUpdateContext['frame']>,
  config: Readonly<FrameConfig>,
): Readonly<Cinema2InterlockShowPlannerStructure> {
  const audio = frame.audio
  const timeSec = audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
  const phrases = audio?.structure.analyzedPhrases.available && audio.structure.analyzedPhrases.value ? audio.structure.analyzedPhrases.value : Object.freeze([])
  const drops = audio?.structure.semanticMoments.available && audio.structure.semanticMoments.value
    ? audio.structure.semanticMoments.value.filter(moment => moment.type === 'drop' || moment.type === 'drop_impact')
    : Object.freeze([])
  const beatIndex = finiteBeatIndex(frame)
  const routedDropEvent = config.dropAccent > 0.05
  const routedDropIdentity = routedDropEvent
    ? latestStructuralIdentity(drops, timeSec)
      ?? frame.director?.context.transition.eventId
      ?? `${frame.transport?.trackId ?? 'source'}:drop:${beatIndex ?? frame.frameId}`
    : null
  const canonicalPerformanceAvailable = audio != null && frame.transport?.sourcePresent !== false
  return Object.freeze({
    sourceIdentity: frame.transport?.trackId ?? audio?.upstream.trackId ?? audio?.upstream.sourceId ?? 'no-source',
    absoluteBeatIndex: beatIndex,
    phraseIdentity: latestStructuralIdentity(phrases, timeSec),
    sectionIdentity: frame.director?.context.section.available ? frame.director.context.section.value?.id ?? null : null,
    dropIdentity: routedDropIdentity,
    phase: frame.director?.phase.available && frame.director.phase.value ? frame.director.phase.value : 'low',
    performance: config.autoPerformance && canonicalPerformanceAvailable ? Object.freeze({
      intensity: config.directorIntensity,
      momentum: config.directorMomentum,
      build: config.directorBuild,
      impact: config.directorImpact,
      variation: config.directorVariation,
      bass: Math.max(config.subEnergy, config.bassEnergy),
      energy: config.overallEnergy,
      flux: config.spectralFlux,
      highAir: Math.max(config.highEnergy, config.airEnergy) * config.highShimmer,
      vocalPresence: config.vocalPresence,
      kickAccent: config.kickAccent,
      snareAccent: config.snareAccent,
      downbeatAccent: config.downbeatAccent,
      barAccent: config.barAccent,
      phraseAccent: config.phraseAccent,
      sectionAccent: config.sectionAccent,
      dropAccent: config.dropAccent,
    }) : undefined,
  })
}

function latestStructuralIdentity(items: readonly Readonly<{ id: string; timeSec: number }>[], timeSec: number): string | null {
  let latest: Readonly<{ id: string; timeSec: number }> | null = null
  for (const item of items) {
    if (!Number.isFinite(item.timeSec) || item.timeSec > timeSec + 1e-6) continue
    if (!latest || item.timeSec > latest.timeSec || (item.timeSec === latest.timeSec && item.id > latest.id)) latest = item
  }
  return latest?.id ?? null
}

function finiteBeatIndex(frame: Readonly<Cinema2ModuleUpdateContext['frame']>): number | null {
  const value = frame.audio?.rhythm.beatIndex.available ? frame.audio.rhythm.beatIndex.value : null
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null
}

function resolveInterlockTriggerAccent(config: Readonly<FrameConfig>): number {
  switch (config.trigger) {
    case 'beat': return Math.max(config.kickAccent, config.snareAccent, config.downbeatAccent * 0.7)
    case 'kick': return config.kickAccent
    case 'snare': return config.snareAccent
    case 'downbeat': return config.downbeatAccent
    case 'bar': return config.barAccent
    case 'phrase': return config.phraseAccent
    case 'auto':
    default: return Math.max(config.kickAccent, config.snareAccent * 0.9, config.downbeatAccent, config.phraseAccent * 0.65, config.dropAccent)
  }
}

function isPatternChange(value: unknown): value is Cinema2InterlockPatternChangeId {
  return typeof value === 'string' && (CINEMA2_INTERLOCK_PATTERN_CHANGE_IDS as readonly string[]).includes(value)
}

function isTrigger(value: unknown): value is Cinema2InterlockTriggerId {
  return typeof value === 'string' && (CINEMA2_INTERLOCK_TRIGGER_IDS as readonly string[]).includes(value)
}

function fract(value: number): number { return value - Math.floor(value) }

function normalizeViewport(frame: Readonly<Cinema2ModuleFrameReadContext>): Cinema2InterlockViewport {
  return Object.freeze({
    width: Math.max(1, finite(frame.viewport.width, 1)),
    height: Math.max(1, finite(frame.viewport.height, 1)),
    dpr: Math.max(0.01, finite(frame.viewport.dpr, 1)),
  })
}

function viewportKey(viewport: Cinema2InterlockViewport): string {
  return `${viewport.width.toFixed(4)}:${viewport.height.toFixed(4)}:${viewport.dpr.toFixed(4)}`
}

function animationActive(frame: Readonly<Cinema2ModuleFrameReadContext>): boolean {
  if (!frame.transport) return true
  return frame.transport.animationActive && !frame.transport.paused
}


function isPattern(value: unknown): value is Cinema2InterlockPatternId {
  return typeof value === 'string' && (CINEMA2_INTERLOCK_PATTERN_IDS as readonly string[]).includes(value)
}

function isSegmentProgram(value: unknown): value is Cinema2InterlockSegmentProgramId {
  return typeof value === 'string' && (CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS as readonly string[]).includes(value)
}

function isColor(value: unknown): value is Cinema2Color {
  return Array.isArray(value) && value.length === 4 && value.every(entry => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 && entry <= 1)
}

function colorValue(value: Cinema2JsonValue | undefined, fallback: Cinema2Color): Cinema2Color {
  return isColor(value) ? Object.freeze([value[0], value[1], value[2], value[3]]) as Cinema2Color : fallback
}

function numberValue(value: Cinema2JsonValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function booleanValue(value: Cinema2JsonValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberInRange(value: unknown, minimum: number, maximum: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function diagnostic(code: string, path: string, message: string): Cinema2ModuleDiagnostic {
  return { code, path, message }
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function smoothstep(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

export const CINEMA2_INTERLOCK_NATIVE_DEFAULTS = Object.freeze({
  pattern: CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID,
  ledColor: DEFAULT_LED_COLOR,
  ledIntensity: DEFAULT_LED_INTENSITY,
  rotationAmount: DEFAULT_ROTATION_AMOUNT,
  morphDuration: DEFAULT_MORPH_DURATION_SEC,
  symmetry: DEFAULT_SYMMETRY,
  segmentPattern: CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID,
  litDensity: CINEMA2_INTERLOCK_DEFAULT_LIT_DENSITY,
  segmentSpeed: CINEMA2_INTERLOCK_DEFAULT_SEGMENT_SPEED,
  segmentFade: CINEMA2_INTERLOCK_DEFAULT_SEGMENT_FADE,
  segmentAfterglow: CINEMA2_INTERLOCK_DEFAULT_SEGMENT_AFTERGLOW,
  unlitVisibility: CINEMA2_INTERLOCK_DEFAULT_UNLIT_VISIBILITY,
  mirrorSegmentDirection: CINEMA2_INTERLOCK_DEFAULT_MIRROR_SEGMENT_DIRECTION,
  segmentEnergy: DEFAULT_SEGMENT_ENERGY,
  segmentImpact: DEFAULT_SEGMENT_IMPACT,
  segmentDirectionBias: DEFAULT_SEGMENT_DIRECTION_BIAS,
  segmentBankPhase: DEFAULT_SEGMENT_BANK_PHASE,
  effectsIntensity: DEFAULT_EFFECTS_INTENSITY,
  autoPerformance: DEFAULT_AUTO_PERFORMANCE,
  patternChange: 'phrase' as Cinema2InterlockPatternChangeId,
  masterReactivity: DEFAULT_MASTER_REACTIVITY,
  bassRotation: DEFAULT_BASS_ROTATION,
  segmentReactivity: DEFAULT_SEGMENT_REACTIVITY,
  transientPulse: DEFAULT_TRANSIENT_PULSE,
  highShimmer: DEFAULT_HIGH_SHIMMER,
  buildTension: DEFAULT_BUILD_TENSION,
  vocalRestraint: DEFAULT_VOCAL_RESTRAINT,
  trigger: 'auto' as Cinema2InterlockTriggerId,
  directorIntensity: 0,
  directorMomentum: 0,
  directorBuild: 0,
  directorImpact: 0,
  directorVariation: 0,
  subEnergy: 0,
  bassEnergy: 0,
  overallEnergy: 0,
  spectralFlux: 0,
  highEnergy: 0,
  airEnergy: 0,
  vocalPresence: 0,
  kickAccent: 0,
  snareAccent: 0,
  downbeatAccent: 0,
  barAccent: 0,
  phraseAccent: 0,
  sectionAccent: 0,
  dropAccent: 0,
})
