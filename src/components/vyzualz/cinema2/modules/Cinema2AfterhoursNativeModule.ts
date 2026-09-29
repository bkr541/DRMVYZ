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
import {
  CINEMA2_AFTERHOURS_CUE_SCENE_BEATS,
  evaluateCinema2AfterhoursCues,
  type Cinema2AfterhoursCueBeam,
} from './afterhours/Cinema2AfterhoursCueChoreography'
import { generateCinema2AfterhoursBeamFrame } from './afterhours/Cinema2AfterhoursGeometry'
import {
  CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS,
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

const MORPH_DURATION_SEC = 0.34
/** With no beat tracking (or BPM Sync off) the cues count beats at this steady tempo. */
const FREE_RUN_BPM = 120
const DEFAULT_PRIMARY = Object.freeze([0.455, 0.961, 1, 1]) as Cinema2Color
const DEFAULT_ACCENT = Object.freeze([1, 1, 1, 1]) as Cinema2Color
const TOPOLOGY_SET = new Set<string>(CINEMA2_AFTERHOURS_TOPOLOGY_IDS)
const TRIGGER_SET = new Set<string>(CINEMA2_AFTERHOURS_TRIGGER_IDS)
const PATTERN_CHANGE_SET = new Set<string>(CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS)

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
  readonly autoPerformance: boolean
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
  if (module.parameters?.pattern !== undefined && !isTopology(module.parameters.pattern)) {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_PATTERN_INVALID', '$.parameters.pattern', `Afterhours pattern must be one of: ${CINEMA2_AFTERHOURS_TOPOLOGY_IDS.join(', ')}.`))
  }
  if (module.parameters?.beamCount !== undefined && !numberInRange(module.parameters.beamCount, CINEMA2_AFTERHOURS_MIN_BEAMS, CINEMA2_AFTERHOURS_MAX_BEAMS)) {
    diagnostics.push(diagnostic('CINEMA2_AFTERHOURS_BEAM_COUNT_INVALID', '$.parameters.beamCount', `Afterhours Beam Count must be between ${CINEMA2_AFTERHOURS_MIN_BEAMS} and ${CINEMA2_AFTERHOURS_MAX_BEAMS}.`))
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
    let signature = ''
    let transition: BeamTransition | null = null
    let settled = new Map<string, Readonly<BeamTransitionState>>()
    let hardCutRequested = false
    let lastTimeSec: number | null = null
    let lastTrackId: string | null | undefined = undefined
    let lastPaused: boolean | null = null
    let lastContextGeneration: number | null = null
    let renderBeams: readonly Cinema2AfterhoursRenderBeam[] = Object.freeze([])
    let lastTriggerEventId: string | null = null
    let pulseStartedAtSec = Number.NEGATIVE_INFINITY
    let lastAuthoredPattern: Cinema2AfterhoursTopologyId | null = null
    let lastPatternChange: Cinema2AfterhoursPatternChangeId | null = null
    let lastPatternCadenceIdentity: string | null = null
    let manualPatternStep = 0
    const cueSeed = String(context.randomness.sample('afterhours-cue-seed'))
    let cueBeat = 0

    const resetTransientState = () => {
      signature = ''
      transition = null
      settled = new Map()
      renderBeams = Object.freeze([])
      lastTriggerEventId = null
      pulseStartedAtSec = Number.NEGATIVE_INFINITY
      lastAuthoredPattern = null
      lastPatternChange = null
      lastPatternCadenceIdentity = null
      manualPatternStep = 0
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
            manualPatternStep = 0
            lastPatternCadenceIdentity = cadenceIdentity
          } else if (
            frame.transport?.playing !== false
            && frame.transport?.paused !== true
            && cadenceIdentity !== lastPatternCadenceIdentity
            && !cadenceIdentity.endsWith(':unavailable')
          ) {
            manualPatternStep += 1
            lastPatternCadenceIdentity = cadenceIdentity
          }

          lastAuthoredPattern = config.pattern
          lastPatternChange = config.patternChange

          const showPlan = planCinema2AfterhoursShow(
            Object.freeze({ ...config, patternStep: manualPatternStep }),
            structure,
            randomAdapter,
          )
          const nextSignature = createGeometrySignature(config, showPlan)
          if (nextSignature !== signature) {
            const nextDescriptors = generateCinema2AfterhoursBeamFrame({
              topologyId: showPlan.topologyId,
              beamCount: showPlan.beamCount,
              symmetry: showPlan.symmetry,
              sideLasers: showPlan.sideLasers,
              topLasers: showPlan.topLasers,
              spread: config.spread,
              variationKey: showPlan.variationKey,
              random: randomAdapter,
            })
            const current = resolveTransitionState(transition, settled, timeSec)
            const next = descriptorStateMap(nextDescriptors)
            if (current.size === 0 || !animationActive) {
              // Nothing to morph from, or time is frozen and a morph would hang half done: show the new layout at once.
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
            if (showPlan.transitionIntent === 'hardCut') hardCutRequested = true
          }
          if (hardCutRequested) {
            if (transition) {
              settled = new Map(transition.to)
              transition = null
            }
            hardCutRequested = false
          }

          const resolved = limitTransitionStates(resolveTransitionState(transition, settled, timeSec), showPlan.beamCount, showPlan.symmetry)
          if (transition && transitionProgress(transition, timeSec) >= 1) {
            settled = new Map(transition.to)
            transition = null
          }
          if (animationActive) cueBeat = resolveCinema2AfterhoursCueBeat(frame, timeSec, config.bpmSync) ?? cueBeat
          const sceneKey = `${structure.sourceIdentity}:${showPlan.topologyId}:${Math.floor(Math.max(0, cueBeat) / CINEMA2_AFTERHOURS_CUE_SCENE_BEATS)}`
          renderBeams = buildRenderBeams(resolved, config, showPlan, pulse, { beat: cueBeat, sceneKey, seed: cueSeed })

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
    pattern: isTopology(source.parameters.get('pattern')) ? source.parameters.get('pattern') as Cinema2AfterhoursTopologyId : 'wideFan',
    // Runtime authority is carried through the canonical target path. The Show
    // Auto Performance may choose topology/presentation, but fixture-bank
    // enables remain hard user authority in the Show Planner.
    autoPerformance: booleanValue(source.parameters.get('autoPerformance'), false),
    beamCount: clamp(Math.round(numberValue(source.parameters.get('beamCount'), 8)), CINEMA2_AFTERHOURS_MIN_BEAMS, CINEMA2_AFTERHOURS_MAX_BEAMS),
    symmetry: booleanValue(source.parameters.get('symmetry'), true),
    sideLasers: booleanValue(source.parameters.get('sideLasers'), false),
    topLasers: booleanValue(source.parameters.get('topLasers'), false),
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

function limitTransitionStates(
  states: ReadonlyMap<string, Readonly<BeamTransitionState>>,
  beamCount: number,
  symmetry: boolean,
): ReadonlyMap<string, Readonly<BeamTransitionState>> {
  const ceiling = clamp(Math.round(beamCount), CINEMA2_AFTERHOURS_MIN_BEAMS, CINEMA2_AFTERHOURS_MAX_BEAMS)
  if (states.size <= ceiling) return states

  const ranked = [...states.entries()].sort(compareTransitionEntries)
  if (!symmetry) return new Map(ranked.slice(0, ceiling))

  const pairBudget = Math.floor(ceiling / 2)
  const pairs = new Map<string, Array<readonly [string, Readonly<BeamTransitionState>]>>()
  for (const entry of ranked) {
    const pairId = entry[1].descriptor.symmetry?.pairId
    if (!pairId) continue
    const group = pairs.get(pairId) ?? []
    group.push(entry)
    pairs.set(pairId, group)
  }

  const rankedPairs = [...pairs.entries()]
    .filter(([, entries]) => entries.length >= 2)
    .sort((left, right) => {
      const leftScore = left[1].reduce((sum, entry) => sum + entry[1].alpha, 0) / left[1].length
      const rightScore = right[1].reduce((sum, entry) => sum + entry[1].alpha, 0) / right[1].length
      if (Math.abs(rightScore - leftScore) > 1e-9) return rightScore - leftScore
      return left[0].localeCompare(right[0])
    })
    .slice(0, pairBudget)

  const selected = rankedPairs
    .flatMap(([, entries]) => [...entries].sort(compareTransitionEntries).slice(0, 2))
    .sort(compareTransitionEntries)
  return new Map(selected)
}

function compareTransitionEntries(
  left: readonly [string, Readonly<BeamTransitionState>],
  right: readonly [string, Readonly<BeamTransitionState>],
): number {
  if (Math.abs(right[1].alpha - left[1].alpha) > 1e-9) return right[1].alpha - left[1].alpha
  if (left[1].descriptor.slot !== right[1].descriptor.slot) return left[1].descriptor.slot - right[1].descriptor.slot
  return left[0].localeCompare(right[0])
}

function buildRenderBeams(
  states: ReadonlyMap<string, Readonly<BeamTransitionState>>,
  config: Readonly<FrameConfig>,
  showPlan: Readonly<Cinema2AfterhoursShowPlan>,
  pulse: number,
  cue: Readonly<{ beat: number; sceneKey: string; seed: string }>,
): readonly Cinema2AfterhoursRenderBeam[] {
  const pulseAuthority = resolveCinema2AfterhoursPulseAuthority(pulse, config.pulseAmount)
  const blackoutScale = clamp01(1 - showPlan.blackout * config.blackoutAmount)
  // Motion Amount is how far a burst aims away from home (and how much it sweeps while lit); 0 fires every burst at the home position.
  const motion = config.motionAmount > 1e-5
    ? clamp(clamp01(config.motionAmount) * showPlan.motionScale + pulseAuthority * 0.1, 0, 1.3)
    : 0
  const cueBeams: Cinema2AfterhoursCueBeam[] = [...states.values()].map(state => cueBeamOf(state.descriptor))
  const cues = evaluateCinema2AfterhoursCues({
    beams: cueBeams,
    beat: cue.beat,
    sceneKey: cue.sceneKey,
    seed: cue.seed,
    intensity: config.directorIntensity,
    peak: Math.max(config.directorImpact, config.dropAccent),
    motion,
  })
  const result: Cinema2AfterhoursRenderBeam[] = []
  for (const [fixtureId, state] of states) {
    const cueState = cues.get(fixtureId)
    const gate = cueState?.gate ?? 1
    const home = applyPerformanceSpread(state.targetWorld, showPlan.spreadScale)
    const target = cueState
      ? Object.freeze([
          clamp(home[0] + cueState.offsetX, -7.8, 7.8),
          clamp(home[1] + cueState.offsetY, 0.6, 6.8),
          home[2],
        ]) as Cinema2Vector3
      : home
    const bankIntensity = state.descriptor.bank === 'bottom'
      ? showPlan.bottomIntensity
      : state.descriptor.bank === 'overhead'
        ? showPlan.topIntensity
        : showPlan.sideIntensity
    const intensity = state.descriptor.intensityWeight
      * bankIntensity
      * (1 + pulseAuthority * 0.42)
      * blackoutScale
      * gate
    result.push(Object.freeze({
      fixtureId,
      originWorld: state.descriptor.originWorld,
      targetWorld: target,
      intensity,
      // The shutter closes the beam completely between bursts.
      alpha: state.alpha * blackoutScale * gate,
      accentWeight: stableUnitHash(state.descriptor.symmetry?.pairId ?? fixtureId),
    }))
  }
  return Object.freeze(result)
}

function cueBeamOf(descriptor: Readonly<Cinema2AfterhoursBeamDescriptor>): Cinema2AfterhoursCueBeam {
  const side = descriptor.symmetry?.side === 'left' ? -1 : descriptor.symmetry?.side === 'right' ? 1 : (descriptor.originWorld[0] < 0 ? -1 : 1)
  return {
    fixtureId: descriptor.fixtureId,
    slot: descriptor.slot,
    unitKey: descriptor.symmetry?.pairId ?? descriptor.fixtureId,
    side,
    yawAuthorityDeg: descriptor.scanner.yawAuthorityDeg,
    pitchAuthorityDeg: descriptor.scanner.pitchAuthorityDeg,
    topologyId: descriptor.topologyId,
  }
}

function applyPerformanceSpread(target: Cinema2Vector3, scale: number): Cinema2Vector3 {
  return Object.freeze([
    clamp(target[0] * clamp(scale, 0.56, 1.08), -7.8, 7.8),
    target[1],
    target[2],
  ]) as Cinema2Vector3
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

function transitionProgress(transition: Readonly<BeamTransition>, timeSec: number): number {
  return clamp01((timeSec - transition.startedAtSec) / MORPH_DURATION_SEC)
}

function createGeometrySignature(config: Readonly<FrameConfig>, showPlan: Readonly<Cinema2AfterhoursShowPlan>): string {
  return [
    showPlan.topologyId,
    showPlan.variationKey,
    showPlan.beamCount,
    showPlan.symmetry ? 1 : 0,
    showPlan.sideLasers ? 1 : 0,
    showPlan.topLasers ? 1 : 0,
    config.spread.toFixed(4),
  ].join('|')
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
