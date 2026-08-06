import type {
  CinemaBrandRole,
  CinemaColor,
  CinemaCompositionDefinition,
  CinemaJsonObject,
  CinemaParameterValue,
  CinemaPerformanceAction,
  CinemaPerformanceCondition,
  CinemaPerformanceDuration,
  CinemaPerformanceRuleDefinition,
} from './CinemaDomain'
import {
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
} from './CinemaDomain'
import type {
  CinemaActionId,
  CinemaCameraId,
  CinemaEventId,
  CinemaNodeId,
} from './CinemaIdentifiers'
import { parseCinemaNamespacedId, parseCinemaParameterPath, parseCinemaStableId } from './CinemaIdentifiers'
import {
  CINEMA_PERFORMANCE_STATE_ACTION_IDS,
  type CinemaFrameContext,
  type CinemaPerformanceStateActionId,
} from './CinemaRendererContracts'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  deduplicateCinemaDiagnostics,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'

export type CinemaPerformanceStateCommandType = keyof typeof CINEMA_PERFORMANCE_STATE_ACTION_IDS

export interface CinemaPerformanceStateCommand {
  type: CinemaPerformanceStateCommandType
  actionId: CinemaPerformanceStateActionId
  nodeId: CinemaNodeId
  ruleId: string
  authoredActionId: CinemaActionId
  eventIdentity: string
  seed: number
}

export interface CinemaPerformanceEmittedEvent {
  eventId: CinemaEventId
  payload?: CinemaJsonObject
  ruleId: string
  actionId: CinemaActionId
  eventIdentity: string
}

export interface CinemaPerformanceEvaluation {
  parameterOverrides: Readonly<Record<string, CinemaParameterValue>>
  nodeEnabledOverrides: Readonly<Partial<Record<CinemaNodeId, boolean>>>
  activeCameraId: CinemaCameraId | null
  paletteOverrides: Readonly<Partial<Record<CinemaBrandRole, CinemaColor>>>
  stateCommands: readonly CinemaPerformanceStateCommand[]
  emittedEvents: readonly CinemaPerformanceEmittedEvent[]
  activeRuleCount: number
  activeTransientCount: number
  diagnostics: CinemaDiagnosticSnapshot
}

export interface CinemaPerformanceRuntimeSnapshot {
  ruleCount: number
  activeRuleCount: number
  activeTransientCount: number
  processedEventCount: number
  diagnostics: CinemaDiagnosticSnapshot
}

interface RuleOccurrence {
  rule: Readonly<CinemaPerformanceRuleDefinition>
  eventIdentity: string
  eventTriggered: boolean
}

interface RankedValue<Value> {
  value: Value
  priority: number
  ruleId: string
  actionId: string
  eventIdentity: string
}

interface ActiveTransient {
  key: string
  action: Readonly<CinemaPerformanceAction>
  priority: number
  ruleId: string
  eventIdentity: string
  expiresAtBeat: number | null
  expiresAtFrame: number | null
}

const MAXIMUM_PROCESSED_EVENT_IDENTITIES = 1024
const BUILT_IN_PERFORMANCE_EVENTS = new Set([
  'beat', 'bar', 'phrase', 'sectionStart', 'dropStart', 'lyricCue', 'lyricWord', 'manual',
])
const PERFORMANCE_ACTION_TYPES = new Set<CinemaPerformanceAction['type']>([
  'set-parameter',
  'trigger-parameter',
  'set-node-enabled',
  'set-effect-enabled',
  'select-camera',
  'set-palette',
  'resetNodeState',
  'resetFeedback',
  'reseedSimulation',
  'clearTrailHistory',
  'emit-event',
])

/**
 * Pure, deterministic evaluator for authored Cinema performance choreography.
 * It owns runtime-only transient envelopes and never mutates canonical state.
 */
export class CinemaPerformanceRuntime {
  private readonly rules: readonly Readonly<CinemaPerformanceRuleDefinition>[]
  private readonly authoredRuleCount: number
  private readonly diagnostics: CinemaDiagnostic[]
  private readonly activeTransients = new Map<string, ActiveTransient>()
  private readonly processedEventIdentities = new Set<string>()
  private readonly processedEventOrder: string[] = []
  private readonly previouslyMatchedContinuousRules = new Set<string>()
  private lastActiveRuleCount = 0
  private lastResetGeneration = -1

  constructor(composition: Readonly<CinemaCompositionDefinition>) {
    this.authoredRuleCount = composition.performanceRules.length
    this.rules = [...composition.performanceRules]
      .filter(rule => rule.enabled)
      .sort(compareRules)
    this.diagnostics = validateCinemaPerformanceRules(composition)
  }

  get ruleCount(): number {
    return this.authoredRuleCount
  }

  get snapshot(): CinemaPerformanceRuntimeSnapshot {
    return Object.freeze({
      ruleCount: this.authoredRuleCount,
      activeRuleCount: this.lastActiveRuleCount,
      activeTransientCount: this.activeTransients.size,
      processedEventCount: this.processedEventIdentities.size,
      diagnostics: createCinemaDiagnosticSnapshot(this.diagnostics),
    })
  }

  reset(options: { clearProcessedEvents?: boolean } = {}): void {
    this.activeTransients.clear()
    this.previouslyMatchedContinuousRules.clear()
    this.lastActiveRuleCount = 0
    this.lastResetGeneration = -1
    if (options.clearProcessedEvents === true) {
      this.processedEventIdentities.clear()
      this.processedEventOrder.length = 0
    }
  }

  evaluate(frame: Readonly<CinemaFrameContext>): CinemaPerformanceEvaluation {
    const frameDiagnostics: CinemaDiagnostic[] = []
    if (this.rules.length === 0 && this.activeTransients.size === 0) {
      this.lastActiveRuleCount = 0
      return emptyEvaluation(createCinemaDiagnosticSnapshot(this.diagnostics))
    }
    if (frame.transport.reset.required && frame.transport.reset.generation !== this.lastResetGeneration) {
      this.lastResetGeneration = frame.transport.reset.generation
      this.activeTransients.clear()
      this.previouslyMatchedContinuousRules.clear()
      if (frame.transport.reset.reasons.some(reason => (
        reason === 'track-change' || reason === 'playback-restart' || reason === 'loop-wrap'
      ))) {
        this.processedEventIdentities.clear()
        this.processedEventOrder.length = 0
      }
    }

    const beatPosition = currentBeatPosition(frame)
    this.expireTransients(frame, beatPosition)

    const occurrences: RuleOccurrence[] = []
    const matchedContinuousRules = new Set<string>()
    for (const rule of this.rules) {
      if (!matchesStaticCondition(rule.condition, frame)) continue
      const eventIdentities = resolveConditionEventIdentities(rule.condition, frame)
      if (rule.condition.event != null) {
        for (const eventIdentity of eventIdentities) {
          const scopedIdentity = `${rule.id}:${eventIdentity}`
          if (this.processedEventIdentities.has(scopedIdentity)) continue
          this.rememberProcessedEvent(scopedIdentity)
          occurrences.push({ rule, eventIdentity, eventTriggered: true })
        }
        continue
      }

      matchedContinuousRules.add(String(rule.id))
      occurrences.push({
        rule,
        eventIdentity: `continuous:${rule.id}:${frame.transport.trackId ?? 'no-track'}`,
        eventTriggered: false,
      })
    }

    const newlyMatchedContinuousRules = new Set(
      [...matchedContinuousRules].filter(ruleId => !this.previouslyMatchedContinuousRules.has(ruleId)),
    )
    this.previouslyMatchedContinuousRules.clear()
    for (const ruleId of matchedContinuousRules) this.previouslyMatchedContinuousRules.add(ruleId)
    this.lastActiveRuleCount = new Set(occurrences.map(occurrence => String(occurrence.rule.id))).size

    const parameterCandidates = new Map<string, RankedValue<CinemaParameterValue>>()
    const nodeEnabledCandidates = new Map<CinemaNodeId, RankedValue<boolean>>()
    const cameraCandidate: { value: RankedValue<CinemaCameraId> | null } = { value: null }
    const paletteCandidates = new Map<CinemaBrandRole, RankedValue<CinemaColor>>()
    const stateCommands: CinemaPerformanceStateCommand[] = []
    const emittedEvents: CinemaPerformanceEmittedEvent[] = []

    for (const transient of this.activeTransients.values()) {
      applyRankedAction(
        transient.action,
        transient.priority,
        transient.ruleId,
        transient.eventIdentity,
        parameterCandidates,
        nodeEnabledCandidates,
        candidate => { cameraCandidate.value = chooseRanked(cameraCandidate.value, candidate) },
        paletteCandidates,
      )
    }

    for (const occurrence of occurrences) {
      const { rule, eventIdentity, eventTriggered } = occurrence
      const continuousEdge = newlyMatchedContinuousRules.has(String(rule.id))
      for (const action of [...rule.actions].sort(compareActions)) {
        if (isStateCommand(action)) {
          if (!eventTriggered && !continuousEdge) continue
          stateCommands.push(createStateCommand(action, rule, eventIdentity, frame))
          continue
        }
        if (action.type === 'emit-event') {
          if (!eventTriggered && !continuousEdge) continue
          emittedEvents.push({
            eventId: action.eventId,
            ...(action.payload ? { payload: action.payload } : {}),
            ruleId: String(rule.id),
            actionId: action.id,
            eventIdentity,
          })
          continue
        }

        const duration = actionDuration(action)
        if (duration) {
          if (eventTriggered || continuousEdge) {
            const transient = createActiveTransient(action, rule, eventIdentity, duration, frame, beatPosition, frameDiagnostics)
            this.activeTransients.set(transient.key, transient)
            applyRankedAction(
              transient.action,
              transient.priority,
              transient.ruleId,
              transient.eventIdentity,
              parameterCandidates,
              nodeEnabledCandidates,
              candidate => { cameraCandidate.value = chooseRanked(cameraCandidate.value, candidate) },
              paletteCandidates,
            )
          }
          continue
        }

        if (eventTriggered || !rule.condition.event) {
          applyRankedAction(
            action,
            rule.priority,
            String(rule.id),
            eventIdentity,
            parameterCandidates,
            nodeEnabledCandidates,
            candidate => { cameraCandidate.value = chooseRanked(cameraCandidate.value, candidate) },
            paletteCandidates,
          )
        }
      }
    }

    stateCommands.sort(compareStateCommands)
    emittedEvents.sort((left, right) => compareStrings(left.ruleId, right.ruleId)
      || compareStrings(left.actionId, right.actionId)
      || compareStrings(left.eventIdentity, right.eventIdentity))

    return Object.freeze({
      parameterOverrides: Object.freeze(Object.fromEntries(
        [...parameterCandidates.entries()].map(([path, candidate]) => [path, candidate.value]),
      )),
      nodeEnabledOverrides: Object.freeze(Object.fromEntries(
        [...nodeEnabledCandidates.entries()].map(([nodeId, candidate]) => [nodeId, candidate.value]),
      ) as Partial<Record<CinemaNodeId, boolean>>),
      activeCameraId: cameraCandidate.value?.value ?? null,
      paletteOverrides: Object.freeze(Object.fromEntries(
        [...paletteCandidates.entries()].map(([role, candidate]) => [role, candidate.value]),
      ) as Partial<Record<CinemaBrandRole, CinemaColor>>),
      stateCommands: Object.freeze(stateCommands),
      emittedEvents: Object.freeze(emittedEvents),
      activeRuleCount: this.lastActiveRuleCount,
      activeTransientCount: this.activeTransients.size,
      diagnostics: createCinemaDiagnosticSnapshot([...this.diagnostics, ...frameDiagnostics]),
    })
  }

  private expireTransients(frame: Readonly<CinemaFrameContext>, beatPosition: number | null): void {
    for (const [key, transient] of this.activeTransients) {
      const beatExpired = transient.expiresAtBeat != null
        && beatPosition != null
        && beatPosition >= transient.expiresAtBeat - 1e-9
      const frameExpired = transient.expiresAtFrame != null && frame.timing.frameIndex >= transient.expiresAtFrame
      if (beatExpired || frameExpired) this.activeTransients.delete(key)
    }
  }

  private rememberProcessedEvent(identity: string): void {
    this.processedEventIdentities.add(identity)
    this.processedEventOrder.push(identity)
    while (this.processedEventOrder.length > MAXIMUM_PROCESSED_EVENT_IDENTITIES) {
      const expired = this.processedEventOrder.shift()
      if (expired) this.processedEventIdentities.delete(expired)
    }
  }
}

function emptyEvaluation(diagnostics: CinemaDiagnosticSnapshot): CinemaPerformanceEvaluation {
  return Object.freeze({
    parameterOverrides: Object.freeze({}),
    nodeEnabledOverrides: Object.freeze({}),
    activeCameraId: null,
    paletteOverrides: Object.freeze({}),
    stateCommands: Object.freeze([]),
    emittedEvents: Object.freeze([]),
    activeRuleCount: 0,
    activeTransientCount: 0,
    diagnostics,
  })
}

export function validateCinemaPerformanceRules(
  composition: Readonly<CinemaCompositionDefinition>,
): CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = []
  const ruleIds = new Set<string>()
  const actionIds = new Set<string>()
  const nodeById = new Map(composition.nodes.map(node => [String(node.id), node]))
  const cameraIds = new Set(composition.cameras.map(camera => String(camera.id)))

  for (const candidate of composition.performanceRules) {
    if (!isPlainRecord(candidate)
      || !isPlainRecord(candidate.condition)
      || !Array.isArray(candidate.actions)) {
      diagnostics.push(performanceDiagnostic('Cinema performance rule must include a condition and action list.', {
        compositionId: String(composition.id),
      }))
      continue
    }
    const rule = candidate as unknown as CinemaPerformanceRuleDefinition
    diagnostics.push(...parseCinemaStableId(rule.id, 'performance rule').diagnostics)
    if (ruleIds.has(String(rule.id))) diagnostics.push(performanceDiagnostic('Cinema performance rule IDs must be unique.', { ruleId: String(rule.id) }))
    ruleIds.add(String(rule.id))
    if (rule.schemaVersion !== CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION
      || rule.condition.schemaVersion !== CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION) {
      diagnostics.push(performanceDiagnostic('Cinema performance rule or condition schema version is unsupported.', {
        ruleId: String(rule.id),
        receivedVersion: Number(rule.schemaVersion ?? -1),
      }))
    }
    if (!Number.isFinite(rule.priority)) diagnostics.push(performanceDiagnostic('Cinema performance rule priority must be finite.', { ruleId: String(rule.id) }))
    validateCondition(rule.condition, rule, diagnostics)

    for (const actionCandidate of rule.actions) {
      if (!isPlainRecord(actionCandidate) || typeof actionCandidate.type !== 'string') {
        diagnostics.push(performanceDiagnostic('Cinema performance action is malformed.', { ruleId: String(rule.id) }))
        continue
      }
      const action = actionCandidate as CinemaPerformanceAction
      if (!PERFORMANCE_ACTION_TYPES.has(action.type)) {
        diagnostics.push(performanceDiagnostic('Cinema performance action type is unsupported.', {
          ruleId: String(rule.id),
          actionType: String(action.type),
        }))
        continue
      }
      diagnostics.push(...parseCinemaStableId(action.id, 'performance action').diagnostics)
      if (actionIds.has(String(action.id))) diagnostics.push(performanceDiagnostic('Cinema performance action IDs must be unique within a composition.', {
        ruleId: String(rule.id),
        actionId: String(action.id),
      }))
      actionIds.add(String(action.id))
      if (action.schemaVersion !== CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION) {
        diagnostics.push(performanceDiagnostic('Cinema performance action schema version is unsupported.', {
          ruleId: String(rule.id),
          actionId: String(action.id),
          receivedVersion: Number(action.schemaVersion ?? -1),
        }))
      }
      const durationCandidate = 'duration' in actionCandidate ? actionCandidate.duration : undefined
      if (durationCandidate != null) {
        if (!isPlainRecord(durationCandidate)
          || !Number.isFinite(durationCandidate.value)
          || Number(durationCandidate.value) <= 0
          || !['beats', 'bars'].includes(String(durationCandidate.unit))) {
          diagnostics.push(performanceDiagnostic('Cinema performance action duration must be a positive beat or bar value.', {
            ruleId: String(rule.id),
            actionId: String(action.id),
          }))
        }
      }
      if (action.type === 'set-parameter' || action.type === 'trigger-parameter') {
        diagnostics.push(...parseCinemaParameterPath(action.destination).diagnostics)
      }
      if (action.type === 'set-parameter' && !('value' in actionCandidate)) {
        diagnostics.push(performanceDiagnostic('Cinema set-parameter actions require a value.', {
          ruleId: String(rule.id),
          actionId: String(action.id),
        }))
      }
      if ((action.type === 'set-node-enabled' || action.type === 'set-effect-enabled')
        && typeof action.enabled !== 'boolean') {
        diagnostics.push(performanceDiagnostic('Cinema node and effect enable actions require a boolean enabled value.', {
          ruleId: String(rule.id),
          actionId: String(action.id),
        }))
      }
      if ('nodeId' in action) {
        const node = nodeById.get(String(action.nodeId))
        if (!node) diagnostics.push(performanceDiagnostic('Cinema performance action references a missing node.', {
          ruleId: String(rule.id),
          actionId: String(action.id),
          nodeId: String(action.nodeId),
        }))
        if (action.type === 'set-effect-enabled' && node?.family !== 'effect') {
          diagnostics.push(performanceDiagnostic('Cinema set-effect-enabled action must target an effect node.', {
            ruleId: String(rule.id),
            actionId: String(action.id),
            nodeId: String(action.nodeId),
          }))
        }
      }
      if (action.type === 'select-camera' && !cameraIds.has(String(action.cameraId))) {
        diagnostics.push(performanceDiagnostic('Cinema performance action references a missing camera.', {
          ruleId: String(rule.id),
          actionId: String(action.id),
          cameraId: String(action.cameraId),
        }))
      }
      if (action.type === 'emit-event') {
        diagnostics.push(...parseCinemaNamespacedId(action.eventId, 'emitted performance event').diagnostics)
        if (action.payload != null && !isPlainRecord(action.payload)) {
          diagnostics.push(performanceDiagnostic('Cinema emitted performance event payloads must be plain JSON objects.', {
            ruleId: String(rule.id),
            actionId: String(action.id),
          }))
        }
      }
      if (action.type === 'set-palette') {
        if (!isPlainRecord(action.colors)) {
          diagnostics.push(performanceDiagnostic('Cinema palette actions require a plain color map.', {
            ruleId: String(rule.id),
            actionId: String(action.id),
          }))
        } else {
          for (const color of Object.values(action.colors)) {
            if (!isColor(color)) diagnostics.push(performanceDiagnostic('Cinema palette actions require finite normalized RGBA colors.', {
              ruleId: String(rule.id),
              actionId: String(action.id),
            }))
          }
        }
      }
    }
  }
  return deduplicateCinemaDiagnostics(diagnostics)
}

function validateCondition(
  condition: Readonly<CinemaPerformanceCondition>,
  rule: Readonly<CinemaPerformanceRuleDefinition>,
  diagnostics: CinemaDiagnostic[],
): void {
  if (condition.minimumEnergy != null && (!Number.isFinite(condition.minimumEnergy) || condition.minimumEnergy < 0 || condition.minimumEnergy > 1)) {
    diagnostics.push(performanceDiagnostic('Cinema performance minimumEnergy must be in the inclusive 0..1 range.', { ruleId: String(rule.id) }))
  }
  if (condition.maximumEnergy != null && (!Number.isFinite(condition.maximumEnergy) || condition.maximumEnergy < 0 || condition.maximumEnergy > 1)) {
    diagnostics.push(performanceDiagnostic('Cinema performance maximumEnergy must be in the inclusive 0..1 range.', { ruleId: String(rule.id) }))
  }
  if (condition.minimumEnergy != null && condition.maximumEnergy != null && condition.minimumEnergy > condition.maximumEnergy) {
    diagnostics.push(performanceDiagnostic('Cinema performance minimumEnergy cannot exceed maximumEnergy.', { ruleId: String(rule.id) }))
  }
  if (condition.sectionTypes != null
    && (!Array.isArray(condition.sectionTypes) || condition.sectionTypes.some(sectionType => typeof sectionType !== 'string'))) {
    diagnostics.push(performanceDiagnostic('Cinema performance sectionTypes must be an array of strings.', { ruleId: String(rule.id) }))
  }
  if (condition.manualActionIds != null && !Array.isArray(condition.manualActionIds)) {
    diagnostics.push(performanceDiagnostic('Cinema manualActionIds must be an array of stable action IDs.', { ruleId: String(rule.id) }))
  } else {
    for (const actionId of condition.manualActionIds ?? []) diagnostics.push(...parseCinemaStableId(actionId, 'manual performance action').diagnostics)
  }
  if (condition.toggleActionId) diagnostics.push(...parseCinemaStableId(condition.toggleActionId, 'toggle performance action').diagnostics)
  if (condition.toggleState != null && typeof condition.toggleState !== 'boolean') {
    diagnostics.push(performanceDiagnostic('Cinema performance toggleState must be boolean.', { ruleId: String(rule.id) }))
  }
  if (condition.event != null && !BUILT_IN_PERFORMANCE_EVENTS.has(String(condition.event))) {
    diagnostics.push(...parseCinemaNamespacedId(condition.event, 'performance event').diagnostics)
  }
}

function resolveConditionEventIdentities(
  condition: Readonly<CinemaPerformanceCondition>,
  frame: Readonly<CinemaFrameContext>,
): string[] {
  const event = condition.event
  if (event == null) return []
  switch (event) {
    case 'beat': return eventIdentity(frame.impulses.beat, frame.impulses.eventIds.beat)
    case 'bar': return eventIdentity(frame.music.clocks.bar, frame.music.clocks.states.bar.eventId)
    case 'phrase': return eventIdentity(frame.music.clocks.phrase, frame.music.clocks.states.phrase.eventId)
    case 'sectionStart': return eventIdentity(frame.impulses.sectionStart, frame.impulses.eventIds.sectionStart)
    case 'dropStart': return eventIdentity(frame.impulses.dropStart, frame.impulses.eventIds.dropStart)
    case 'lyricCue': return eventIdentity(frame.impulses.lyricCue, frame.impulses.eventIds.lyricCue)
    case 'lyricWord': return eventIdentity(frame.impulses.lyricWord, frame.impulses.eventIds.lyricWord)
    case 'manual': {
      const allowed = new Set((condition.manualActionIds ?? []).map(String))
      return (frame.performance.events ?? frame.performance.actionIds.map((actionId, index) => ({
          actionId,
          sequence: frame.timing.frameIndex * 1000 + index,
        })))
        .filter(entry => allowed.size === 0 || allowed.has(String(entry.actionId)))
        .map(entry => `manual:${entry.sequence}:${entry.actionId}`)
    }
    default: {
      const expected = String(event)
      const matches = Object.values(frame.impulses.eventIds).some(eventId => eventId === expected)
      return matches ? [expected] : []
    }
  }
}

function matchesStaticCondition(
  condition: Readonly<CinemaPerformanceCondition>,
  frame: Readonly<CinemaFrameContext>,
): boolean {
  if (condition.sectionTypes && !condition.sectionTypes.includes(frame.music.sectionType ?? '')) return false
  if (condition.minimumEnergy != null && frame.audio.energy < condition.minimumEnergy) return false
  if (condition.maximumEnergy != null && frame.audio.energy > condition.maximumEnergy) return false
  if (condition.vocalsActive != null && frame.lyrics.vocalsActive !== condition.vocalsActive) return false
  if (condition.playing != null && frame.transport.playing !== condition.playing) return false
  const sectionType = (frame.music.sectionType ?? '').toLowerCase()
  if (condition.buildActive != null && sectionType.includes('build') !== condition.buildActive) return false
  if (condition.dropActive != null && sectionType.includes('drop') !== condition.dropActive) return false
  if (condition.toggleActionId != null) {
    const toggle = frame.performance.toggleStates[condition.toggleActionId] === true
    if (toggle !== (condition.toggleState ?? true)) return false
  }
  return true
}

function applyRankedAction(
  action: Readonly<CinemaPerformanceAction>,
  priority: number,
  ruleId: string,
  eventIdentity: string,
  parameterCandidates: Map<string, RankedValue<CinemaParameterValue>>,
  nodeEnabledCandidates: Map<CinemaNodeId, RankedValue<boolean>>,
  setCamera: (candidate: RankedValue<CinemaCameraId>) => void,
  paletteCandidates: Map<CinemaBrandRole, RankedValue<CinemaColor>>,
): void {
  const ranked = <Value>(value: Value): RankedValue<Value> => ({
    value,
    priority,
    ruleId,
    actionId: String(action.id),
    eventIdentity,
  })
  switch (action.type) {
    case 'set-parameter':
      parameterCandidates.set(action.destination, chooseRanked(parameterCandidates.get(action.destination) ?? null, ranked(action.value)))
      break
    case 'trigger-parameter':
      parameterCandidates.set(action.destination, chooseRanked(parameterCandidates.get(action.destination) ?? null, ranked(true)))
      break
    case 'set-node-enabled':
    case 'set-effect-enabled':
      nodeEnabledCandidates.set(action.nodeId, chooseRanked(nodeEnabledCandidates.get(action.nodeId) ?? null, ranked(action.enabled)))
      break
    case 'select-camera':
      setCamera(ranked(action.cameraId))
      break
    case 'set-palette':
      for (const [role, color] of Object.entries(action.colors)) {
        if (!color) continue
        const typedRole = role as CinemaBrandRole
        paletteCandidates.set(typedRole, chooseRanked(paletteCandidates.get(typedRole) ?? null, ranked(color)))
      }
      break
    default:
      break
  }
}

function createActiveTransient(
  action: Readonly<CinemaPerformanceAction>,
  rule: Readonly<CinemaPerformanceRuleDefinition>,
  eventIdentity: string,
  duration: Readonly<CinemaPerformanceDuration>,
  frame: Readonly<CinemaFrameContext>,
  beatPosition: number | null,
  diagnostics: CinemaDiagnostic[],
): ActiveTransient {
  const durationBeats = duration.unit === 'bars'
    ? duration.value * currentBarSpanBeats(frame)
    : duration.value
  let expiresAtBeat: number | null = null
  let expiresAtFrame: number | null = null
  if (beatPosition == null) {
    expiresAtFrame = frame.timing.frameIndex + 1
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_PERFORMANCE_DURATION_UNAVAILABLE',
      severity: 'warning',
      message: 'Cinema applied a beat/bar performance duration for one frame because no musical clock was available.',
      attribution: { stage: 'performance-runtime' },
      details: { ruleId: String(rule.id), actionId: String(action.id), unit: duration.unit },
    }))
  } else {
    expiresAtBeat = beatPosition + durationBeats
  }
  return {
    key: `${rule.id}:${action.id}:${eventIdentity}`,
    action,
    priority: rule.priority,
    ruleId: String(rule.id),
    eventIdentity,
    expiresAtBeat,
    expiresAtFrame,
  }
}

function createStateCommand(
  action: Extract<CinemaPerformanceAction, { type: CinemaPerformanceStateCommandType }>,
  rule: Readonly<CinemaPerformanceRuleDefinition>,
  eventIdentity: string,
  frame: Readonly<CinemaFrameContext>,
): CinemaPerformanceStateCommand {
  return {
    type: action.type,
    actionId: CINEMA_PERFORMANCE_STATE_ACTION_IDS[action.type],
    nodeId: action.nodeId,
    ruleId: String(rule.id),
    authoredActionId: action.id,
    eventIdentity,
    seed: stableHash32(`${frame.transport.trackId ?? 'no-track'}|${eventIdentity}|${action.id}`),
  }
}

function actionDuration(action: Readonly<CinemaPerformanceAction>): CinemaPerformanceDuration | undefined {
  return 'duration' in action ? action.duration : undefined
}

function isStateCommand(
  action: Readonly<CinemaPerformanceAction>,
): action is Extract<CinemaPerformanceAction, { type: CinemaPerformanceStateCommandType }> {
  return action.type === 'resetNodeState'
    || action.type === 'resetFeedback'
    || action.type === 'reseedSimulation'
    || action.type === 'clearTrailHistory'
}

function currentBeatPosition(frame: Readonly<CinemaFrameContext>): number | null {
  return frame.music.beatIndex == null ? null : frame.music.beatIndex + frame.music.beatPhase
}

function currentBarSpanBeats(frame: Readonly<CinemaFrameContext>): number {
  const spanBeats = frame.music.clocks.states.bar.spanBeats
  return Number.isFinite(spanBeats) && spanBeats > 0 ? spanBeats : 4
}

function eventIdentity(active: boolean, eventId: CinemaEventId | null): string[] {
  return active && eventId ? [String(eventId)] : []
}

function chooseRanked<Value>(
  current: RankedValue<Value> | null,
  candidate: RankedValue<Value>,
): RankedValue<Value> {
  if (!current) return candidate
  const comparison = candidate.priority - current.priority
    || compareStrings(current.ruleId, candidate.ruleId)
    || compareStrings(current.actionId, candidate.actionId)
    || compareStrings(current.eventIdentity, candidate.eventIdentity)
  return comparison > 0 ? candidate : current
}

function compareRules(left: Readonly<CinemaPerformanceRuleDefinition>, right: Readonly<CinemaPerformanceRuleDefinition>): number {
  return right.priority - left.priority || compareStrings(String(left.id), String(right.id))
}

function compareActions(left: Readonly<CinemaPerformanceAction>, right: Readonly<CinemaPerformanceAction>): number {
  return compareStrings(String(left.id), String(right.id))
}

function compareStateCommands(left: CinemaPerformanceStateCommand, right: CinemaPerformanceStateCommand): number {
  return compareStrings(left.ruleId, right.ruleId)
    || compareStrings(left.authoredActionId, right.authoredActionId)
    || compareStrings(left.eventIdentity, right.eventIdentity)
}

function performanceDiagnostic(
  message: string,
  details: Readonly<Record<string, string | number | boolean | null>>,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_PERFORMANCE_RULE_INVALID',
    severity: 'error',
    message,
    attribution: { stage: 'performance-runtime' },
    details,
  })
}

function isColor(value: unknown): value is CinemaColor {
  return Array.isArray(value)
    && value.length === 4
    && value.every(component => typeof component === 'number' && Number.isFinite(component) && component >= 0 && component <= 1)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function stableHash32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
