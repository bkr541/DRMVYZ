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
import { CINEMA2_INTERLOCK_RIG } from './interlock/Cinema2InterlockRig'
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

interface FrameConfig {
  readonly pattern: Cinema2InterlockPatternId
  readonly ledColor: Cinema2Color
  readonly ledIntensity: number
  readonly rotationAmount: number
  readonly morphDurationSec: number
  readonly symmetry: boolean
}

interface ActiveTransition {
  readonly targetPatternId: Cinema2InterlockPatternId
  readonly states: readonly Cinema2InterlockTransitionState[]
  elapsedSec: number
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
  if (module.config && Object.keys(module.config).length > 0) {
    diagnostics.push(diagnostic(
      'CINEMA2_INTERLOCK_MODULE_CONFIG_UNSUPPORTED',
      '$.config',
      'Interlock Stage 2 does not accept module-local config; authored state belongs in supported parameters.',
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
    let activePattern = config.pattern
    let lastViewportKey: string | null = null
    let lastTimeSec: number | null = null
    let lastTrackId: string | null | undefined = undefined
    let lastContextGeneration: number | null = null
    let disposed = false

    const rebuildSettledLayout = (viewport: Cinema2InterlockViewport, patternId = config.pattern) => {
      const layout = resolveCinema2InterlockLayout(patternId, viewport)
      currentGeometry = new Map(layout.fixtures.map(candidate => [candidate.fixtureId, candidate]))
      activePattern = layout.patternId
      transition = null
      renderFixtures = toRenderFixtures(layout.fixtures)
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
      transition = { targetPatternId, states: Object.freeze(states), elapsedSec: 0 }
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
          const timeSec = resolveTimeSec(frame)
          const backwards = lastTimeSec != null && timeSec < lastTimeSec - 1e-6
          const discontinuity = Boolean(frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation')
          const sourceReplaced = lastTrackId !== undefined && frame.transport?.trackId !== lastTrackId
          const contextChanged = lastContextGeneration != null && frame.contextGeneration !== lastContextGeneration
          const resized = lastViewportKey != null && lastViewportKey !== nextViewportKey
          const reset = discontinuity || backwards || sourceReplaced || contextChanged || resized

          if (lastViewportKey == null || currentGeometry.size === 0 || reset) {
            rebuildSettledLayout(viewport, config.pattern)
          } else if (config.pattern !== previousConfig.pattern) {
            beginPatternTransition(viewport, config.pattern)
          }

          if (transition) {
            if (animationActive(frame)) transition.elapsedSec += Math.max(0, finite(frame.deltaTimeSec, 0))
            const progress = clamp01(transition.elapsedSec / config.morphDurationSec)
            const next = transition.states.map((state, index) => resolveTransitionFixture(
              state,
              progress,
              config.rotationAmount,
              config.symmetry,
              index,
            ))
            currentGeometry = new Map(next.map(candidate => [candidate.fixtureId, candidate]))
            renderFixtures = toRenderFixtures(next)
            if (progress >= 1) {
              // Always settle to the Stage 1 authored target. Rotation Amount
              // only governs the legal-pivot angular excursion during the morph.
              rebuildSettledLayout(viewport, transition.targetPatternId)
            }
          } else if (config.pattern !== activePattern) {
            beginPatternTransition(viewport, config.pattern)
          }

          lastViewportKey = nextViewportKey
          lastTimeSec = timeSec
          lastTrackId = frame.transport?.trackId
          lastContextGeneration = frame.contextGeneration
        },
        dispose() {
          disposed = true
          transition = null
          currentGeometry.clear()
          renderFixtures = Object.freeze([])
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
): readonly Cinema2InterlockRenderFixture[] {
  if (fixtures.length !== CINEMA2_INTERLOCK_FIXTURE_COUNT) {
    throw new Error(`Interlock expected ${CINEMA2_INTERLOCK_FIXTURE_COUNT} resolved fixtures, received ${fixtures.length}.`)
  }
  return Object.freeze(fixtures.map(geometry => Object.freeze({ fixtureId: geometry.fixtureId, geometry })))
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

function resolveTimeSec(frame: Readonly<Cinema2ModuleFrameReadContext>): number {
  const transportTime = frame.transport?.timeSec
  if (typeof transportTime === 'number' && Number.isFinite(transportTime)) return transportTime
  return Number.isFinite(frame.elapsedTimeSec) ? frame.elapsedTimeSec : 0
}

function isPattern(value: unknown): value is Cinema2InterlockPatternId {
  return typeof value === 'string' && (CINEMA2_INTERLOCK_PATTERN_IDS as readonly string[]).includes(value)
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
})
