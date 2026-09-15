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
}

interface ActiveTransition {
  readonly targetPatternId: Cinema2InterlockPatternId
  readonly states: readonly Cinema2InterlockTransitionState[]
  progress: number
}

interface PendingTransition {
  readonly targetPatternId: Cinema2InterlockPatternId
  readonly startBeat: number
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
    let disposed = false

    const rebuildSettledLayout = (viewport: Cinema2InterlockViewport, patternId = config.pattern) => {
      const layout = resolveCinema2InterlockLayout(patternId, viewport)
      currentGeometry = new Map(layout.fixtures.map(candidate => [candidate.fixtureId, candidate]))
      activePattern = layout.patternId
      transition = null
      renderFixtures = toRenderFixtures(layout.fixtures, config.mirrorSegmentDirection)
    }

    const beginPatternTransition = (viewport: Cinema2InterlockViewport, targetPatternId: Cinema2InterlockPatternId) => {
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
      transition = { targetPatternId, states: Object.freeze(states), progress: 0 }
      pendingTransition = null
    }

    const requestPatternTransition = (
      viewport: Cinema2InterlockViewport,
      targetPatternId: Cinema2InterlockPatternId,
      syncEnabled: boolean,
      canonicalBeatPosition: number,
    ) => {
      if (!syncEnabled) {
        beginPatternTransition(viewport, targetPatternId)
        return
      }
      pendingTransition = Object.freeze({
        targetPatternId,
        startBeat: nextCinema2InterlockBeatBoundary(canonicalBeatPosition),
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
          fixtures: renderFixtures,
          width: execution.width,
          height: execution.height,
          ledColor: config.ledColor,
          ledIntensity: config.ledIntensity,
          segmentProgram: config.segmentPattern,
          segmentPhase,
          litDensity: config.litDensity,
          segmentFade: config.segmentFade,
          segmentAfterglow: config.segmentAfterglow * config.effectsIntensity,
          unlitVisibility: config.unlitVisibility,
          segmentEnergy: config.segmentEnergy,
          segmentImpact: config.segmentImpact * config.effectsIntensity,
          segmentDirectionBias: config.segmentDirectionBias,
          segmentBankPhase: config.segmentBankPhase,
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
          segmentPhase = resolveCinema2InterlockSegmentClockPhase(clock, config.segmentSpeed)
          const resized = lastViewportKey != null && lastViewportKey !== nextViewportKey
          const reanchored = lastReanchorGeneration != null && clock.reanchorGeneration !== lastReanchorGeneration

          if (pendingTransition && reanchored && clock.syncEnabled) {
            pendingTransition = Object.freeze({
              targetPatternId: pendingTransition.targetPatternId,
              startBeat: nextCinema2InterlockBeatBoundary(clock.canonicalBeatPosition),
            })
          }

          if (lastViewportKey == null || currentGeometry.size === 0 || resized) {
            rebuildSettledLayout(viewport, config.pattern)
            pendingTransition = null
          } else if (config.pattern !== previousConfig.pattern) {
            requestPatternTransition(viewport, config.pattern, clock.syncEnabled, clock.canonicalBeatPosition)
          }

          if (pendingTransition && (
            !clock.syncEnabled
            || clock.canonicalBeatPosition + 1e-6 >= pendingTransition.startBeat
          )) {
            beginPatternTransition(viewport, pendingTransition.targetPatternId)
          }

          if (transition) {
            if (animationActive(frame)) {
              if (clock.syncEnabled) {
                const deltaBeats = lastMotionBeatPosition == null || reanchored
                  ? 0
                  : Math.max(0, clock.motionBeatPosition - lastMotionBeatPosition)
                transition.progress += deltaBeats / 2
              } else {
                transition.progress += Math.max(0, finite(frame.deltaTimeSec, 0)) / config.morphDurationSec
              }
            }
            const progress = clamp01(transition.progress)
            const next = transition.states.map((state, index) => resolveTransitionFixture(
              state,
              progress,
              config.rotationAmount,
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
        },
        dispose() {
          disposed = true
          transition = null
          pendingTransition = null
          currentGeometry.clear()
          renderFixtures = Object.freeze([])
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
  })
}

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
})
