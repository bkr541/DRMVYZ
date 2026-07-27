import {
  getPixGridAudioIntelligenceSource,
  isPixGridContinuousSourceDefinition,
  type PixGridAudioIntelligenceSourceDefinition,
} from './PixGridAudioIntelligenceRegistry'
import type {
  PixGridAudioFrame,
  PixGridAudioSourceKind,
  PixGridReactionAssignment,
  PixGridReactionConditions,
  PixGridReactionCurve,
  PixGridReactionSource,
  PixGridReactionTarget,
  PixGridReactionTargetScope,
} from './PixGridTypes'

export interface PixGridAssignmentEvaluationContext {
  activeLayerIds?: ReadonlySet<string>
  activeGroupIds?: ReadonlySet<string>
  currentGroupId?: string | null
  currentLayerId?: string | null
}

export interface PixGridAssignmentTargetDefinition {
  id: PixGridReactionTarget
  label: string
  scopes: readonly PixGridReactionTargetScope[]
  supportedSourceKinds: readonly PixGridAudioSourceKind[]
  boundedRange: readonly [number, number]
  runtimeHandler: 'pixel' | 'transform' | 'animation' | 'state' | 'postProcess' | 'transition'
}

const MODULATION_KINDS: readonly PixGridAudioSourceKind[] = Object.freeze(['continuousNormalized', 'continuousSigned', 'progress', 'discreteEvent', 'musicalBoundary', 'sectionEvent', 'semanticEvent'])
const PIXEL_SCOPES: readonly PixGridReactionTargetScope[] = Object.freeze(['group', 'pixels', 'output', 'layer'])
const TRANSFORM_SCOPES: readonly PixGridReactionTargetScope[] = Object.freeze(['group', 'pixels', 'layer', 'animation'])

function target(
  id: PixGridReactionTarget,
  label: string,
  scopes: readonly PixGridReactionTargetScope[],
  runtimeHandler: PixGridAssignmentTargetDefinition['runtimeHandler'],
  boundedRange: readonly [number, number] = [-4, 4],
  supportedSourceKinds: readonly PixGridAudioSourceKind[] = MODULATION_KINDS,
): PixGridAssignmentTargetDefinition {
  return Object.freeze({ id, label, scopes, runtimeHandler, boundedRange, supportedSourceKinds })
}

export const PIX_GRID_ASSIGNMENT_TARGETS: readonly PixGridAssignmentTargetDefinition[] = Object.freeze([
  target('brightness', 'Brightness', PIXEL_SCOPES, 'pixel'),
  target('opacity', 'Opacity', PIXEL_SCOPES, 'pixel', [-1, 1]),
  target('globalIntensity', 'Global intensity', ['output'], 'state', [-1, 2]),
  target('glow', 'Glow', ['output', 'scene'], 'state', [-1, 2]),
  target('contrast', 'Contrast', ['output', 'group', 'pixels'], 'postProcess', [-1, 2]),
  target('saturation', 'Saturation', ['output', 'group', 'pixels'], 'postProcess', [-1, 2]),
  target('threshold', 'Threshold', ['output', 'group', 'pixels'], 'postProcess', [0, 1]),
  target('paletteRole', 'Palette role', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('paletteIndex', 'Palette index', ['palette', 'layer', 'scene'], 'state', [-4, 4]),
  target('paletteCycle', 'Palette cycle', ['palette', 'layer', 'scene'], 'state', [-4, 4]),
  target('hueOffset', 'Hue offset', ['output', 'group', 'pixels', 'palette'], 'postProcess', [-1, 1]),
  target('invert', 'Invert', PIXEL_SCOPES, 'postProcess', [0, 1]),
  target('posterize', 'Posterize', PIXEL_SCOPES, 'postProcess', [0, 1]),
  target('highlightColor', 'Highlight color', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('backgroundColor', 'Background color', ['background'], 'state', [0, 1]),
  target('backgroundIntensity', 'Background intensity', ['background', 'output'], 'state', [-1, 2]),
  target('color', 'Color', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('positionX', 'Position X', TRANSFORM_SCOPES, 'transform', [-1, 1]),
  target('positionY', 'Position Y', TRANSFORM_SCOPES, 'transform', [-1, 1]),
  target('scale', 'Scale', TRANSFORM_SCOPES, 'transform', [-0.95, 4]),
  target('discreteRotation', 'Discrete rotation', TRANSFORM_SCOPES, 'transform', [-4, 4]),
  target('direction', 'Direction', ['animation', 'layer', 'group'], 'animation', [-1, 1]),
  target('animationSpeed', 'Animation speed', ['animation', 'layer', 'group'], 'animation', [-4, 8]),
  target('frameIndex', 'Frame index', ['animation', 'layer'], 'animation', [0, 1]),
  target('frameAdvance', 'Frame advance', ['animation', 'layer', 'group'], 'animation', [-16, 16]),
  target('bounceAmount', 'Bounce amount', ['animation', 'layer'], 'animation', [-2, 4]),
  target('scrollRate', 'Scroll rate', ['animation', 'layer'], 'animation', [-8, 8]),
  target('pixelDisplacement', 'Displacement amount', PIXEL_SCOPES, 'transform', [-4, 4]),
  target('reveal', 'Reveal', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('hide', 'Hide', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('blink', 'Blink', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('dissolveThreshold', 'Dissolve threshold', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('sparkle', 'Sparkle', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('sparkleDensity', 'Sparkle density', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('outlineFlash', 'Outline flash', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('outlineIntensity', 'Outline intensity', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('checkerAlternation', 'Checker alternation', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('rowRecruitment', 'Row recruitment', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('columnRecruitment', 'Column recruitment', PIXEL_SCOPES, 'pixel', [0, 1]),
  target('pixelScatter', 'Pixel scatter', PIXEL_SCOPES, 'transform', [-4, 4]),
  target('maskExpansion', 'Mask expansion', ['group', 'pixels'], 'transform', [0, 1]),
  target('maskContraction', 'Mask contraction', ['group', 'pixels'], 'transform', [0, 1]),
  target('layerRecruitment', 'Layer recruitment', ['layer', 'scene', 'output'], 'state', [0, 1]),
  target('groupRecruitment', 'Group recruitment', ['group', 'scene', 'output'], 'state', [0, 1]),
  target('density', 'Density', ['scene', 'output'], 'state', [0, 1]),
  target('freeze', 'Freeze', ['animation', 'layer', 'scene', 'output'], 'state', [0, 1]),
  target('reverse', 'Reverse', ['animation', 'layer', 'scene', 'output'], 'state', [0, 1]),
  target('directionReverse', 'Direction reverse', ['animation', 'layer', 'group'], 'animation', [0, 1]),
  target('sceneEmphasis', 'Scene emphasis', ['scene', 'output'], 'state', [-1, 2]),
  target('transitionStrength', 'Transition strength', ['transition'], 'transition', [-1, 2]),
])

export const PIX_GRID_ASSIGNMENT_TARGET_BY_ID = new Map(PIX_GRID_ASSIGNMENT_TARGETS.map(definition => [definition.id, definition]))

export interface PixGridCompiledConditions {
  includeSectionTypes: ReadonlySet<string> | null
  excludeSectionTypes: ReadonlySet<string> | null
  sectionPhases: ReadonlySet<string> | null
  sectionOccurrences: ReadonlySet<number> | null
  dropOccurrences: ReadonlySet<number> | null
  phraseSegments: ReadonlySet<string> | null
  minimumEnergy: number | null
  maximumEnergy: number | null
  autoPerformanceOnly: boolean
  activeLayerId: string | null
  activeGroupId: string | null
}

export interface PixGridCompiledAssignment {
  id: string
  name: string
  enabled: boolean
  source: PixGridAudioIntelligenceSourceDefinition
  target: PixGridAssignmentTargetDefinition
  targetScope: PixGridReactionTargetScope
  targetId: string | null
  amount: number
  polarity: 'positive' | 'negative' | 'bipolar'
  inputRange: readonly [number, number]
  outputRange: readonly [number, number]
  threshold: number
  hysteresis: number
  curve: PixGridReactionCurve
  attack: number
  hold: number
  release: number
  cooldown: number
  bassReactivityEnabled: boolean
  decayCurve: NonNullable<PixGridReactionAssignment['decayCurve']>
  smoothing: number
  quantization: PixGridReactionAssignment['quantization']
  retrigger: PixGridReactionAssignment['retrigger']
  maximumStacking: number
  minimumConfidence: number
  capabilityFallback: PixGridReactionAssignment['capabilityFallback']
  clamp: readonly [number, number]
  blend: PixGridReactionAssignment['blend']
  paletteRole: PixGridReactionAssignment['paletteRole']
  color: string | undefined
  seedOffset: number
  priority: number
  eventPriority: number
  conditions: PixGridCompiledConditions
  compatible: boolean
  capabilityAvailableAtCompile: boolean
  warnings: readonly string[]
  signature: string
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, finite(value, fallback)))
}
function tuple(value: readonly number[] | undefined, fallback: readonly [number, number], min: number, max: number): readonly [number, number] {
  const first = clamp(value?.[0], min, max, fallback[0])
  const second = clamp(value?.[1], min, max, fallback[1])
  return first <= second ? [first, second] : [second, first]
}
function sortedNumbers(value: readonly number[] | undefined): number[] {
  return value ? [...new Set(value.map(item => Math.max(0, Math.round(finite(item, 0))))).values()].sort((a, b) => a - b) : []
}
function sortedStrings(value: readonly string[] | undefined): string[] {
  return value ? [...new Set(value.filter(Boolean))].sort() : []
}
function conditionSignature(conditions: PixGridReactionConditions | undefined): string {
  if (!conditions) return ''
  return [
    sortedStrings(conditions.includeSectionTypes).join(','),
    sortedStrings(conditions.excludeSectionTypes).join(','),
    sortedStrings(conditions.sectionPhases).join(','),
    sortedNumbers(conditions.sectionOccurrences).join(','),
    sortedNumbers(conditions.dropOccurrences).join(','),
    sortedStrings(conditions.phraseSegments).join(','),
    finite(conditions.minimumEnergy, -1),
    finite(conditions.maximumEnergy, -1),
    conditions.autoPerformanceOnly === true ? 1 : 0,
    conditions.activeLayerId ?? '',
    conditions.activeGroupId ?? '',
  ].join('|')
}

function signature(assignment: PixGridReactionAssignment, defaultScope: PixGridReactionTargetScope, capabilityAvailable: boolean): string {
  return [
    assignment.id, assignment.enabled ? 1 : 0, assignment.source, assignment.target, assignment.targetScope ?? defaultScope,
    assignment.targetId ?? '', assignment.amount, assignment.polarity ?? (assignment.invert ? 'negative' : 'positive'),
    assignment.inputRange?.join(','), assignment.outputRange?.join(','), assignment.threshold, assignment.hysteresis,
    assignment.curve ?? 'linear', assignment.attack, assignment.hold, assignment.release, assignment.cooldown, assignment.bassReactivityEnabled, assignment.decayCurve,
    assignment.smoothing, assignment.quantization, assignment.retrigger, assignment.maximumStacking,
    assignment.minimumConfidence, assignment.capabilityFallback, assignment.clamp.join(','), assignment.blend,
    assignment.paletteRole, assignment.color, assignment.seedOffset, assignment.priority, assignment.eventPriority,
    conditionSignature(assignment.conditions), capabilityAvailable ? 1 : 0,
  ].join('~')
}

function compileConditions(conditions: PixGridReactionConditions | undefined): PixGridCompiledConditions {
  const include = sortedStrings(conditions?.includeSectionTypes)
  const exclude = sortedStrings(conditions?.excludeSectionTypes)
  const phases = sortedStrings(conditions?.sectionPhases)
  const sectionOccurrences = sortedNumbers(conditions?.sectionOccurrences)
  const dropOccurrences = sortedNumbers(conditions?.dropOccurrences)
  const phraseSegments = sortedStrings(conditions?.phraseSegments)
  return Object.freeze({
    includeSectionTypes: include.length ? new Set(include) : null,
    excludeSectionTypes: exclude.length ? new Set(exclude) : null,
    sectionPhases: phases.length ? new Set(phases) : null,
    sectionOccurrences: sectionOccurrences.length ? new Set(sectionOccurrences) : null,
    dropOccurrences: dropOccurrences.length ? new Set(dropOccurrences) : null,
    phraseSegments: phraseSegments.length ? new Set(phraseSegments) : null,
    minimumEnergy: conditions?.minimumEnergy == null ? null : clamp(conditions.minimumEnergy, 0, 1, 0),
    maximumEnergy: conditions?.maximumEnergy == null ? null : clamp(conditions.maximumEnergy, 0, 1, 1),
    autoPerformanceOnly: conditions?.autoPerformanceOnly === true,
    activeLayerId: conditions?.activeLayerId?.trim() || null,
    activeGroupId: conditions?.activeGroupId?.trim() || null,
  })
}

export function evaluatePixGridReactionCurve(curve: PixGridReactionCurve, value: number): number {
  const x = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  switch (curve) {
    case 'easeIn': return x * x
    case 'easeOut': return 1 - (1 - x) * (1 - x)
    case 'easeInOut': return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
    case 'exponential': return x === 0 ? 0 : Math.pow(2, 10 * x - 10)
    case 'logarithmic': return Math.log1p(9 * x) / Math.log(10)
    case 'smoothstep': return x * x * (3 - 2 * x)
    case 'stepped': return Math.min(1, Math.floor(x * 8) / 8)
    case 'gate': return x >= 0.5 ? 1 : 0
    case 'inverse': return 1 - x
    default: return x
  }
}

export function evaluatePixGridCompiledConditions(
  compiled: PixGridCompiledAssignment,
  frame: PixGridAudioFrame,
  context: PixGridAssignmentEvaluationContext = {},
): boolean {
  const conditions = compiled.conditions
  const sectionType = frame.sectionType ?? 'unknown'
  if (conditions.includeSectionTypes && !conditions.includeSectionTypes.has(sectionType)) return false
  if (conditions.excludeSectionTypes?.has(sectionType)) return false
  if (conditions.sectionPhases && !conditions.sectionPhases.has(frame.sectionPhase ?? 'none')) return false
  if (conditions.sectionOccurrences && !conditions.sectionOccurrences.has(frame.sectionOccurrence ?? 0)) return false
  if (conditions.dropOccurrences && !conditions.dropOccurrences.has(frame.dropOccurrence ?? 0)) return false
  if (conditions.phraseSegments && !conditions.phraseSegments.has(frame.phraseSegment ?? 'middle')) return false
  const energy = frame.energy ?? frame.volume
  if (conditions.minimumEnergy != null && energy < conditions.minimumEnergy) return false
  if (conditions.maximumEnergy != null && energy > conditions.maximumEnergy) return false
  if (conditions.autoPerformanceOnly && frame.autoPerformanceEnabled !== true) return false
  if (conditions.activeLayerId && !context.activeLayerIds?.has(conditions.activeLayerId)) return false
  if (conditions.activeGroupId && !context.activeGroupIds?.has(conditions.activeGroupId)) return false
  return true
}

export class PixGridAssignmentCompiler {
  private readonly cache = new Map<string, PixGridCompiledAssignment>()
  private compileCountValue = 0

  get compilationCount(): number { return this.compileCountValue }
  get cachedAssignmentCount(): number { return this.cache.size }

  clear(): void {
    this.cache.clear()
  }

  compile(
    assignment: PixGridReactionAssignment,
    capabilities: Partial<Record<PixGridReactionSource, boolean>> = {},
    defaultScope: PixGridReactionTargetScope = 'group',
    routeId: string = assignment.id,
  ): PixGridCompiledAssignment {
    const sourceDefinition = getPixGridAudioIntelligenceSource(assignment.source)
    const targetDefinition = PIX_GRID_ASSIGNMENT_TARGET_BY_ID.get(assignment.target)
    const capabilityAvailable = capabilities[assignment.source] !== false
    const nextSignature = signature(assignment, defaultScope, capabilityAvailable)
    const cacheKey = `${defaultScope}:${routeId}`
    const existing = this.cache.get(cacheKey)
    if (existing?.signature === nextSignature) return existing

    const warnings: string[] = []
    const targetScope = assignment.targetScope ?? defaultScope
    const compatibleScope = targetDefinition?.scopes.includes(targetScope) === true
    const compatibleSource = targetDefinition?.supportedSourceKinds.includes(sourceDefinition.kind) === true
    if (!targetDefinition) warnings.push(`Unsupported target ${assignment.target}`)
    else {
      if (!compatibleScope) warnings.push(`${assignment.target} is not supported for ${targetScope} scope`)
      if (!compatibleSource) warnings.push(`${assignment.source} cannot safely drive ${assignment.target}`)
    }
    if (!capabilityAvailable && assignment.capabilityFallback === 'disable') warnings.push(`${assignment.source} is unavailable and the route is disabled`)
    const inputRange = tuple(assignment.inputRange, sourceDefinition.valueRange, -4, 4)
    const outputRange = tuple(assignment.outputRange, [0, 1], -8, 8)
    const clampRange = tuple(assignment.clamp, targetDefinition?.boundedRange ?? [-4, 4], -16, 16)
    const polarity = assignment.polarity ?? (assignment.invert ? 'negative' : 'positive')
    const compiled: PixGridCompiledAssignment = Object.freeze({
      id: routeId,
      name: assignment.name,
      enabled: assignment.enabled && Boolean(targetDefinition) && compatibleScope && compatibleSource,
      source: sourceDefinition,
      target: targetDefinition ?? target('brightness', 'Brightness', PIXEL_SCOPES, 'pixel'),
      targetScope,
      targetId: assignment.targetId?.trim() || null,
      amount: clamp(assignment.amount, -4, 4, 0.75),
      polarity,
      inputRange,
      outputRange,
      threshold: clamp(assignment.threshold, 0, 1, 0),
      hysteresis: clamp(assignment.hysteresis, 0, 0.5, 0),
      curve: assignment.curve ?? sourceDefinition.recommendedCurve,
      attack: clamp(assignment.attack, 0, 10, sourceDefinition.recommendedSmoothing.attack),
      hold: clamp(assignment.hold, 0, 10, sourceDefinition.recommendedSmoothing.hold),
      release: clamp(assignment.release, 0, 20, sourceDefinition.recommendedSmoothing.release),
      cooldown: clamp(assignment.cooldown, 0, 30, 0),
      bassReactivityEnabled: assignment.bassReactivityEnabled !== false,
      decayCurve: assignment.decayCurve ?? 'easeOut',
      smoothing: clamp(assignment.smoothing, 0, 10, sourceDefinition.recommendedSmoothing.smoothing),
      quantization: assignment.quantization,
      retrigger: assignment.retrigger,
      maximumStacking: Math.max(1, Math.min(8, Math.round(finite(assignment.maximumStacking, 1)))),
      minimumConfidence: clamp(assignment.minimumConfidence, 0, 1, 0),
      capabilityFallback: assignment.capabilityFallback,
      clamp: clampRange,
      blend: assignment.blend,
      paletteRole: assignment.paletteRole,
      color: assignment.color,
      seedOffset: Math.round(finite(assignment.seedOffset, 0)),
      priority: Math.round(finite(assignment.priority, 0)),
      eventPriority: Math.round(finite(assignment.eventPriority, 0)),
      conditions: compileConditions(assignment.conditions),
      compatible: Boolean(targetDefinition) && compatibleScope && compatibleSource,
      capabilityAvailableAtCompile: capabilityAvailable,
      warnings: Object.freeze(warnings),
      signature: nextSignature,
    })
    this.cache.set(cacheKey, compiled)
    this.compileCountValue += 1
    return compiled
  }
}

export function isPixGridCompiledContinuousAssignment(compiled: PixGridCompiledAssignment): boolean {
  return isPixGridContinuousSourceDefinition(compiled.source)
}

export function pixGridTargetDefaultScope(targetId: PixGridReactionTarget): PixGridReactionTargetScope {
  const definition = PIX_GRID_ASSIGNMENT_TARGET_BY_ID.get(targetId)
  return definition?.scopes[0] ?? 'group'
}
