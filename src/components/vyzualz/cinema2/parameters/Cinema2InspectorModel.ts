import type { Cinema2JsonValue, Cinema2ParameterConditionManifest } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import type { Cinema2CompiledParameterDefinition } from './Cinema2ParameterSchema'
import type { Cinema2ParameterStateSnapshot } from './Cinema2ParameterState'

export type Cinema2InspectorSurface = 'design' | 'react'

export interface Cinema2InspectorControlModel {
  definition: Readonly<Cinema2CompiledParameterDefinition>
  value: Cinema2JsonValue | undefined
  enabled: boolean
  disabledReason: string | null
}

export interface Cinema2InspectorGroupModel {
  label: string | null
  controls: readonly Readonly<Cinema2InspectorControlModel>[]
}

export interface Cinema2InspectorSectionModel {
  label: string
  groups: readonly Readonly<Cinema2InspectorGroupModel>[]
}

/**
 * Pure schema-to-Inspector projection. It deliberately carries no preset-name
 * knowledge and reads values only from the canonical runtime state snapshot.
 */
export function createCinema2InspectorModel(
  plan: Readonly<Cinema2CompiledPresetPlan>,
  state: Readonly<Cinema2ParameterStateSnapshot>,
  surface: Cinema2InspectorSurface,
): readonly Readonly<Cinema2InspectorSectionModel>[] {
  const availableCapabilities = new Set(plan.capabilities.available)
  const values = { ...state.persistentValues, ...state.runtimeOnlyValues }
  const ordered = plan.parameters.definitions
    .map((definition, authoredIndex) => ({ definition, authoredIndex }))
    .sort((left, right) => (
      (left.definition.order ?? Number.MAX_SAFE_INTEGER) - (right.definition.order ?? Number.MAX_SAFE_INTEGER)
      || left.authoredIndex - right.authoredIndex
    ))

  const sectionMap = new Map<string, { label: string; groups: Map<string, { label: string | null; controls: Cinema2InspectorControlModel[] }> }>()

  for (const { definition } of ordered) {
    if (definition.exposure === 'hidden') continue
    if (resolveSurface(definition) !== surface) continue
    if (!conditionsPass(definition.visibleWhen, values, availableCapabilities)) continue

    const capabilityEnabled = definition.capabilities == null
      || definition.capabilities.every(requirement => availableCapabilities.has(requirement.id))
    const conditionEnabled = conditionsPass(definition.enabledWhen, values, availableCapabilities)
    const enabled = !definition.readOnly && capabilityEnabled && conditionEnabled
    const unavailableCapabilities = definition.capabilities
      ?.filter(requirement => !availableCapabilities.has(requirement.id))
      .map(requirement => requirement.id) ?? []
    const disabledReason = definition.readOnly
      ? 'Read-only runtime value.'
      : unavailableCapabilities.length > 0
        ? `Unavailable capability: ${unavailableCapabilities.join(', ')}`
        : !conditionEnabled
          ? 'Unavailable for the current parameter state.'
          : null

    const sectionLabel = resolveSectionLabel(definition, surface)
    let section = sectionMap.get(sectionLabel)
    if (!section) {
      section = { label: sectionLabel, groups: new Map() }
      sectionMap.set(sectionLabel, section)
    }

    const groupLabel = definition.group?.trim() || null
    const groupKey = groupLabel ?? '__ungrouped__'
    let group = section.groups.get(groupKey)
    if (!group) {
      group = { label: groupLabel, controls: [] }
      section.groups.set(groupKey, group)
    }
    group.controls.push({
      definition,
      value: Object.prototype.hasOwnProperty.call(values, definition.id) ? cloneJson(values[definition.id]) : undefined,
      enabled,
      disabledReason,
    })
  }

  return deepFreeze([...sectionMap.values()].map(section => ({
    label: section.label,
    groups: [...section.groups.values()].map(group => ({ label: group.label, controls: group.controls })),
  })))
}

function resolveSurface(definition: Readonly<Cinema2CompiledParameterDefinition>): Cinema2InspectorSurface {
  return definition.section?.trim().toLowerCase() === 'react' ? 'react' : 'design'
}

function resolveSectionLabel(
  definition: Readonly<Cinema2CompiledParameterDefinition>,
  surface: Cinema2InspectorSurface,
): string {
  const authored = definition.section?.trim()
  if (authored) return authored
  return surface === 'react' ? 'React' : 'Parameters'
}

function conditionsPass(
  conditions: readonly Cinema2ParameterConditionManifest[] | undefined,
  values: Readonly<Record<string, Cinema2JsonValue>>,
  availableCapabilities: ReadonlySet<string>,
): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(condition => {
    switch (condition.kind) {
      case 'capability-available':
        return availableCapabilities.has(condition.capability)
      case 'parameter-equals':
        return jsonEqual(values[condition.parameterId], condition.value)
      case 'parameter-not-equals':
        return !jsonEqual(values[condition.parameterId], condition.value)
    }
  })
}

function jsonEqual(left: Cinema2JsonValue | undefined, right: Cinema2JsonValue | undefined): boolean {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => jsonEqual(value, right[index]))
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) return false
    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) return false
    return leftKeys.every(key => jsonEqual(left[key], right[key]))
  }
  return false
}

function isPlainObject(value: unknown): value is Record<string, Cinema2JsonValue> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}
