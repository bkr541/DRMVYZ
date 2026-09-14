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
  CINEMA2_AFTERHOURS_MAX_BEAMS,
  CINEMA2_AFTERHOURS_MIN_BEAMS,
  CINEMA2_AFTERHOURS_TOPOLOGY_IDS,
  type Cinema2AfterhoursBeamDescriptor,
  type Cinema2AfterhoursRandomSource,
  type Cinema2AfterhoursTopologyId,
} from './afterhours/Cinema2AfterhoursDomain'
import { generateCinema2AfterhoursBeamFrame } from './afterhours/Cinema2AfterhoursGeometry'
import {
  CINEMA2_AFTERHOURS_TEMPORAL_HISTORY_MAX_SAMPLES,
  CINEMA2_AFTERHOURS_TEMPORAL_HISTORY_WINDOW_SEC,
  Cinema2AfterhoursRenderer,
  type Cinema2AfterhoursRenderBeam,
  type Cinema2AfterhoursTemporalBeamSample,
} from './afterhours/Cinema2AfterhoursRenderer'

export const CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('afterhours-native-render')
export const CINEMA2_AFTERHOURS_NATIVE_MODULE_VERSION = 1 as const
export const CINEMA2_AFTERHOURS_HARD_CUT_ACTION = 'hardStructuralCut' as const

export const CINEMA2_AFTERHOURS_NATIVE_PARAMETER_NAMES = Object.freeze([
  'pattern',
  'beamCount',
  'symmetry',
  'sideLasers',
  'topLasers',
  'colorMode',
  'primaryColor',
  'accentColor',
  'accentMix',
  'atmosphere',
  'masterIntensity',
] as const)

const MORPH_DURATION_SEC = 0.34
const HISTORY_SAMPLE_INTERVAL_SEC = 1 / 45
const IDLE_SWAY_WORLD = 0.035
const DEFAULT_PRIMARY = Object.freeze([0.455, 0.961, 1, 1]) as Cinema2Color
const DEFAULT_ACCENT = Object.freeze([1, 1, 1, 1]) as Cinema2Color
const TOPOLOGY_SET = new Set<string>(CINEMA2_AFTERHOURS_TOPOLOGY_IDS)

type AfterhoursColorMode = 'manual' | 'auto'

interface BeamTransitionState {
  readonly descriptor: Readonly<Cinema2AfterhoursBeamDescriptor>
  readonly targetWorld: Cinema2Vector3
  readonly alpha: number
}

interface BeamTransition {
  readonly startedAtSec: number
  readonly from: ReadonlyMap<string, Readonly<BeamTransitionState>>
  readonly to: ReadonlyMap<string, Readonly<BeamTransitionState>>
}

interface FrameConfig {
  readonly pattern: Cinema2AfterhoursTopologyId
  readonly beamCount: number
  readonly symmetry: boolean
  readonly sideLasers: boolean
  readonly topLasers: boolean
  readonly colorMode: AfterhoursColorMode
  readonly primaryColor: Cinema2Color
  readonly accentColor: Cinema2Color
  readonly accentMix: number
  readonly atmosphere: number
  readonly masterIntensity: number
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
  if (module.parameters?.pattern !== undefined && !isTopology(module.parameters.pattern)) {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_PATTERN_INVALID', '$.parameters.pattern', `Afterhours pattern must be one of: ${CINEMA2_AFTERHOURS_TOPOLOGY_IDS.join(', ')}.`))
  }
  if (module.parameters?.beamCount !== undefined && !numberInRange(module.parameters.beamCount, CINEMA2_AFTERHOURS_MIN_BEAMS, CINEMA2_AFTERHOURS_MAX_BEAMS)) {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_BEAM_COUNT_INVALID', '$.parameters.beamCount', `Afterhours Beam Count must be between ${CINEMA2_AFTERHOURS_MIN_BEAMS} and ${CINEMA2_AFTERHOURS_MAX_BEAMS}.`))
  }
  for (const property of ['symmetry', 'sideLasers', 'topLasers'] as const) {
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
  for (const property of ['accentMix', 'atmosphere', 'masterIntensity'] as const) {
    if (module.parameters?.[property] !== undefined && !numberInRange(module.parameters[property], 0, 1)) {
      diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_NORMALIZED_PARAMETER_INVALID', `$.parameters.${property}`, `Afterhours "${property}" must be between 0 and 1.`))
    }
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
    let signature = ''
    let transition: BeamTransition | null = null
    let settled = new Map<string, Readonly<BeamTransitionState>>()
    let hardCutRequested = false
    let history: Cinema2AfterhoursTemporalBeamSample[] = []
    let lastHistorySampleSec = Number.NEGATIVE_INFINITY
    let lastTimeSec: number | null = null
    let lastTrackId: string | null | undefined = undefined
    let lastContextGeneration: number | null = null
    let lastViewportKey = ''
    let renderBeams: readonly Cinema2AfterhoursRenderBeam[] = Object.freeze([])

    const clearTemporalHistory = () => {
      history = []
      lastHistorySampleSec = Number.NEGATIVE_INFINITY
    }
    const resetTransientState = () => {
      signature = ''
      transition = null
      settled = new Map()
      renderBeams = Object.freeze([])
      clearTemporalHistory()
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
          history,
          timeSec: lastTimeSec ?? execution.frame.elapsedTimeSec,
          worldToClipMatrix: execution.camera.viewProjectionMatrix,
          cameraPosition: execution.camera.position,
          primaryColor: config.primaryColor,
          accentColor: config.accentColor,
          accentMix: config.accentMix,
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
          const viewportKey = `${frame.viewport.width}x${frame.viewport.height}@${frame.viewport.dpr}`
          const discontinuity = Boolean(frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation')
          const backwards = lastTimeSec != null && timeSec < lastTimeSec - 1e-6
          const sourceReplaced = lastTrackId !== undefined && frame.transport?.trackId !== lastTrackId
          const contextChanged = lastContextGeneration != null && frame.contextGeneration !== lastContextGeneration
          const viewportChanged = lastViewportKey.length > 0 && viewportKey !== lastViewportKey
          if (discontinuity || backwards || sourceReplaced || contextChanged) resetTransientState()
          else if (viewportChanged) clearTemporalHistory()

          const nextSignature = createGeometrySignature(config)
          if (nextSignature !== signature) {
            const nextDescriptors = generateCinema2AfterhoursBeamFrame({
              topologyId: config.pattern,
              beamCount: config.beamCount,
              symmetry: config.symmetry,
              sideLasers: config.sideLasers,
              topLasers: config.topLasers,
              variationKey: `renderer:${config.pattern}`,
              random: randomAdapter,
            })
            const current = resolveTransitionState(transition, settled, timeSec)
            const next = descriptorStateMap(nextDescriptors)
            if (current.size === 0) {
              settled = new Map(next)
              transition = null
            } else {
              transition = {
                startedAtSec: timeSec,
                from: current,
                to: next,
              }
            }
            signature = nextSignature
          }
          if (hardCutRequested) {
            if (transition) {
              settled = new Map(transition.to)
              transition = null
              clearTemporalHistory()
            }
            hardCutRequested = false
          }

          const resolved = resolveTransitionState(transition, settled, timeSec)
          if (transition && transitionProgress(transition, timeSec) >= 1) {
            settled = new Map(transition.to)
            transition = null
          }
          renderBeams = buildRenderBeams(resolved, frame, timeSec)

          if (timeSec - lastHistorySampleSec >= HISTORY_SAMPLE_INTERVAL_SEC && renderBeams.length > 0) {
            const sample = Object.freeze({ timeSec, beams: cloneRenderBeams(renderBeams) })
            history = [...history, sample].filter(candidate => timeSec - candidate.timeSec <= CINEMA2_AFTERHOURS_TEMPORAL_HISTORY_WINDOW_SEC)
            if (history.length > CINEMA2_AFTERHOURS_TEMPORAL_HISTORY_MAX_SAMPLES) {
              history = history.slice(history.length - CINEMA2_AFTERHOURS_TEMPORAL_HISTORY_MAX_SAMPLES)
            }
            lastHistorySampleSec = timeSec
          }

          lastTimeSec = timeSec
          lastTrackId = frame.transport?.trackId
          lastContextGeneration = frame.contextGeneration
          lastViewportKey = viewportKey
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
    pattern: isTopology(source.parameters.get('pattern')) ? source.parameters.get('pattern') as Cinema2AfterhoursTopologyId : 'wideFan',
    beamCount: clamp(Math.round(numberValue(source.parameters.get('beamCount'), 8)), CINEMA2_AFTERHOURS_MIN_BEAMS, CINEMA2_AFTERHOURS_MAX_BEAMS),
    symmetry: booleanValue(source.parameters.get('symmetry'), true),
    sideLasers: booleanValue(source.parameters.get('sideLasers'), false),
    topLasers: booleanValue(source.parameters.get('topLasers'), false),
    colorMode,
    primaryColor: colorMode === 'auto' ? autoPalette.primary : colorValue(source.parameters.get('primaryColor'), DEFAULT_PRIMARY),
    accentColor: colorMode === 'auto' ? autoPalette.accent : colorValue(source.parameters.get('accentColor'), DEFAULT_ACCENT),
    accentMix: clamp01(numberValue(source.parameters.get('accentMix'), 0.25)),
    atmosphere: clamp01(numberValue(source.parameters.get('atmosphere'), 0.55)),
    masterIntensity: clamp01(numberValue(source.parameters.get('masterIntensity'), 0.75)),
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

function descriptorStateMap(descriptors: readonly Cinema2AfterhoursBeamDescriptor[]): Map<string, Readonly<BeamTransitionState>> {
  return new Map(descriptors.map(descriptor => [descriptor.fixtureId, Object.freeze({ descriptor, targetWorld: descriptor.targetWorld, alpha: 1 })]))
}

function resolveTransitionState(
  transition: Readonly<BeamTransition> | null,
  settled: ReadonlyMap<string, Readonly<BeamTransitionState>>,
  timeSec: number,
): Map<string, Readonly<BeamTransitionState>> {
  if (!transition) return new Map(settled)
  const progress = transitionProgress(transition, timeSec)
  const eased = smoothstep(progress)
  const ids = new Set([...transition.from.keys(), ...transition.to.keys()])
  const result = new Map<string, Readonly<BeamTransitionState>>()
  for (const fixtureId of ids) {
    const previous = transition.from.get(fixtureId)
    const next = transition.to.get(fixtureId)
    const descriptor = next?.descriptor ?? previous?.descriptor
    if (!descriptor) continue
    const fromTarget = previous?.targetWorld ?? next!.targetWorld
    const toTarget = next?.targetWorld ?? previous!.targetWorld
    const alpha = lerp(previous?.alpha ?? 0, next?.alpha ?? 0, eased)
    if (alpha <= 0.0001 && !next) continue
    result.set(fixtureId, Object.freeze({
      descriptor,
      targetWorld: vectorLerp(fromTarget, toTarget, eased),
      alpha,
    }))
  }
  return result
}

function buildRenderBeams(
  states: ReadonlyMap<string, Readonly<BeamTransitionState>>,
  frame: Readonly<Cinema2ModuleUpdateContext['frame']>,
  timeSec: number,
): readonly Cinema2AfterhoursRenderBeam[] {
  const idle = frame.transport?.sourcePresent === false
  const paused = frame.transport?.sourcePresent === true && frame.transport.paused
  const result: Cinema2AfterhoursRenderBeam[] = []
  for (const [fixtureId, state] of states) {
    const target = idle && !paused
      ? applyIdleSway(state.targetWorld, state.descriptor.scanner.phase, timeSec)
      : state.targetWorld
    result.push(Object.freeze({
      fixtureId,
      originWorld: state.descriptor.originWorld,
      targetWorld: target,
      intensity: state.descriptor.intensityWeight,
      alpha: state.alpha,
      accentWeight: stableUnitHash(state.descriptor.symmetry?.pairId ?? fixtureId),
    }))
  }
  return Object.freeze(result)
}

function applyIdleSway(target: Cinema2Vector3, phase: number, timeSec: number): Cinema2Vector3 {
  const angle = timeSec * 0.23 + phase * Math.PI * 2
  return Object.freeze([
    target[0] + Math.sin(angle) * IDLE_SWAY_WORLD,
    target[1] + Math.cos(angle * 0.83) * IDLE_SWAY_WORLD * 0.55,
    target[2],
  ]) as Cinema2Vector3
}

function cloneRenderBeams(beams: readonly Cinema2AfterhoursRenderBeam[]): readonly Cinema2AfterhoursRenderBeam[] {
  return Object.freeze(beams.map(beam => Object.freeze({
    ...beam,
    originWorld: Object.freeze([...beam.originWorld]) as Cinema2Vector3,
    targetWorld: Object.freeze([...beam.targetWorld]) as Cinema2Vector3,
  })))
}

function transitionProgress(transition: Readonly<BeamTransition>, timeSec: number): number {
  return clamp01((timeSec - transition.startedAtSec) / MORPH_DURATION_SEC)
}

function createGeometrySignature(config: Readonly<FrameConfig>): string {
  return [
    config.pattern,
    config.beamCount,
    config.symmetry ? 1 : 0,
    config.sideLasers ? 1 : 0,
    config.topLasers ? 1 : 0,
  ].join('|')
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

function resolveTimeSec(frame: Readonly<Cinema2ModuleUpdateContext['frame']>): number {
  if (frame.transport?.sourcePresent === false) return frame.elapsedTimeSec
  const transportTime = frame.transport?.timeSec
  return typeof transportTime === 'number' && Number.isFinite(transportTime) ? transportTime : frame.elapsedTimeSec
}

function vectorLerp(a: Cinema2Vector3, b: Cinema2Vector3, amount: number): Cinema2Vector3 {
  return Object.freeze([
    lerp(a[0], b[0], amount),
    lerp(a[1], b[1], amount),
    lerp(a[2], b[2], amount),
  ]) as Cinema2Vector3
}

function stableUnitHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function isTopology(value: unknown): value is Cinema2AfterhoursTopologyId {
  return typeof value === 'string' && TOPOLOGY_SET.has(value)
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

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
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
