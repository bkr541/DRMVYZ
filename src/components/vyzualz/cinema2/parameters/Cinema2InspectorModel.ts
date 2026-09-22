import {
  CINEMA2_DESIGN_PARENT_GROUP_IDS,
  type Cinema2DesignParentGroup,
  type Cinema2JsonValue,
  type Cinema2ParameterConditionManifest,
  type Cinema2ParameterId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import type { Cinema2CompiledParameterDefinition } from './Cinema2ParameterSchema'
import type { Cinema2ParameterStateSnapshot } from './Cinema2ParameterState'

export type Cinema2InspectorSurface = 'design' | 'react'
export type Cinema2InspectorSectionId =
  | 'scene'
  | 'design'
  | 'motion'
  | 'react'
  | 'camera'
  | 'media'
  | 'effects'
  | 'environment'
  | 'advanced'

export type Cinema2InspectorInstanceKind = 'effect' | 'media' | 'camera' | 'environment' | 'light'

export interface Cinema2InspectorControlModel {
  definition: Readonly<Cinema2CompiledParameterDefinition>
  value: Cinema2JsonValue | undefined
  enabled: boolean
  disabledReason: string | null
}

export interface Cinema2InspectorGroupModel {
  kind: 'group'
  label: string | null
  controls: readonly Readonly<Cinema2InspectorControlModel>[]
  advanced: boolean
  order: number
}

export interface Cinema2InspectorInstanceModel {
  kind: 'instance'
  instanceKind: Cinema2InspectorInstanceKind
  instanceId: string
  label: string
  controls: readonly Readonly<Cinema2InspectorControlModel>[]
  groups: readonly Readonly<Cinema2InspectorGroupModel>[]
  advanced: boolean
  order: number
}

export type Cinema2InspectorEntryModel = Cinema2InspectorGroupModel | Cinema2InspectorInstanceModel

export interface Cinema2InspectorSectionModel {
  id: Cinema2InspectorSectionId
  label: string
  groups: readonly Readonly<Cinema2InspectorEntryModel>[]
}

export interface Cinema2DesignParentGroupModel {
  id: Cinema2DesignParentGroup
  label: string
  controls: readonly Readonly<Cinema2InspectorControlModel>[]
  groups: readonly Readonly<Cinema2InspectorGroupModel>[]
}

interface InspectorSectionDefinition {
  id: Cinema2InspectorSectionId
  label: string
  surface: Cinema2InspectorSurface
  order: number
}

interface InspectorInstanceDescriptor {
  key: string
  kind: Cinema2InspectorInstanceKind
  id: string
  label: string
  sectionId: Cinema2InspectorSectionId
  order: number
}

interface ProjectedControl {
  control: Cinema2InspectorControlModel
  sectionId: Cinema2InspectorSectionId
  groupLabel: string | null
  order: number
  authoredIndex: number
  advanced: boolean
  instance: InspectorInstanceDescriptor | null
}

interface MutableGroup {
  kind: 'group'
  label: string | null
  controls: ProjectedControl[]
  advanced: boolean
  order: number
}

interface MutableInstance {
  kind: 'instance'
  descriptor: InspectorInstanceDescriptor
  controls: ProjectedControl[]
  subgroupMap: Map<string, MutableGroup>
  advanced: boolean
}

interface MutableDesignParentGroup {
  controls: ProjectedControl[]
  groups: Map<string, MutableGroup>
}

const SECTION_DEFINITIONS: readonly InspectorSectionDefinition[] = Object.freeze([
  Object.freeze({ id: 'scene', label: 'Scene', surface: 'design', order: 0 }),
  Object.freeze({ id: 'design', label: 'Design', surface: 'design', order: 10 }),
  Object.freeze({ id: 'motion', label: 'Motion', surface: 'design', order: 20 }),
  Object.freeze({ id: 'react', label: 'React', surface: 'react', order: 30 }),
  Object.freeze({ id: 'camera', label: 'Camera', surface: 'design', order: 40 }),
  Object.freeze({ id: 'media', label: 'Media', surface: 'design', order: 50 }),
  Object.freeze({ id: 'effects', label: 'Effects', surface: 'design', order: 60 }),
  Object.freeze({ id: 'environment', label: 'Environment', surface: 'design', order: 70 }),
  Object.freeze({ id: 'advanced', label: 'Advanced', surface: 'design', order: 80 }),
])

const SECTION_BY_ID = new Map(SECTION_DEFINITIONS.map(section => [section.id, section]))
const DESIGN_PARENT_LABELS: Readonly<Record<Cinema2DesignParentGroup, string>> = Object.freeze({
  'master-controls': 'Master Controls',
  design: 'Design',
  effects: 'Effects',
  palette: 'Palette',
})
const DESIGN_PARENT_DEFINITIONS: readonly Readonly<{ id: Cinema2DesignParentGroup; label: string }>[] = Object.freeze(
  CINEMA2_DESIGN_PARENT_GROUP_IDS.map(id => Object.freeze({ id, label: DESIGN_PARENT_LABELS[id] })),
)
const SECTION_ALIASES = new Map<string, Cinema2InspectorSectionId>([
  ['scene', 'scene'],
  ['object', 'scene'],
  ['objects', 'scene'],
  ['design', 'design'],
  ['appearance', 'design'],
  ['parameters', 'design'],
  ['output', 'design'],
  ['motion', 'motion'],
  ['animation', 'motion'],
  ['react', 'react'],
  ['camera', 'camera'],
  ['media', 'media'],
  ['effect', 'effects'],
  ['effects', 'effects'],
  ['post', 'effects'],
  ['environment', 'environment'],
  ['lighting', 'environment'],
  ['advanced', 'advanced'],
])

/**
 * Pure schema-to-Inspector projection. It deliberately carries no preset-name
 * knowledge and reads values only from the canonical runtime state snapshot.
 * Instance ownership comes from the native manifest's existing bindings, so
 * the Inspector never becomes a second source of truth for parameter state.
 */
export function createCinema2InspectorModel(
  plan: Readonly<Cinema2CompiledPresetPlan>,
  state: Readonly<Cinema2ParameterStateSnapshot>,
  surface: Cinema2InspectorSurface,
): readonly Readonly<Cinema2InspectorSectionModel>[] {
  const availableCapabilities = new Set(plan.capabilities.available)
  const values = { ...state.persistentValues, ...state.runtimeOnlyValues }
  const instanceOwners = collectInspectorInstanceOwners(plan)
  const inactiveCameraParameters = collectInactiveCameraParameterIds(plan)
  const projected: ProjectedControl[] = []

  for (const [authoredIndex, definition] of plan.parameters.definitions.entries()) {
    // Diagnostic values remain available to runtime/dev tooling but are not
    // normal Advanced controls. Read-only values can opt in by explicitly
    // authoring a non-diagnostic exposure.
    if (definition.exposure === 'hidden' || definition.exposure === 'diagnostic') continue

    if (inactiveCameraParameters.has(definition.id) && !instanceOwners.has(definition.id)) continue
    const instance = instanceOwners.get(definition.id) ?? null
    const sectionId = instance?.sectionId ?? resolveSectionId(definition.section)
    const section = SECTION_BY_ID.get(sectionId)
    if (!section || section.surface !== surface) continue
    if (surface === 'design' && definition.designParentGroup != null) continue
    if (!conditionsPass(definition.visibleWhen, values, availableCapabilities)) continue

    projected.push({
      control: createControlModel(definition, values, availableCapabilities),
      sectionId,
      groupLabel: definition.group?.trim() || null,
      order: definition.order ?? authoredIndex,
      authoredIndex,
      advanced: definition.exposure === 'advanced',
      instance,
    })
  }

  const sections = new Map<Cinema2InspectorSectionId, {
    definition: InspectorSectionDefinition
    plainGroups: Map<string, MutableGroup>
    instances: Map<string, MutableInstance>
  }>()
  for (const item of projected) {
    let section = sections.get(item.sectionId)
    if (!section) {
      const definition = SECTION_BY_ID.get(item.sectionId)
      if (!definition) continue
      section = { definition, plainGroups: new Map(), instances: new Map() }
      sections.set(item.sectionId, section)
    }

    if (item.instance) {
      let instance = section.instances.get(item.instance.key)
      if (!instance) {
        instance = {
          kind: 'instance',
          descriptor: item.instance,
          controls: [],
          subgroupMap: new Map(),
          advanced: true,
        }
        section.instances.set(item.instance.key, instance)
      }
      instance.controls.push(item)
      if (!item.advanced) instance.advanced = false
      addToMutableGroup(instance.subgroupMap, item)
      continue
    }

    addToMutableGroup(section.plainGroups, item)
  }

  const result = [...sections.values()]
    .sort((left, right) => left.definition.order - right.definition.order)
    .map(section => {
      const groups: Cinema2InspectorEntryModel[] = [
        ...[...section.plainGroups.values()].map(finalizeGroup),
        ...[...section.instances.values()].map(finalizeInstance),
      ]
      groups.sort(compareEntries)
      return {
        id: section.definition.id,
        label: section.definition.label,
        groups,
      }
    })
    .filter(section => section.groups.length > 0)

  return deepFreeze(result)
}

/**
 * Projects explicitly classified Design controls into the four canonical
 * parent containers. Runtime instance ownership still determines whether a
 * parameter belongs to the Design surface, but never overrides authored
 * parent placement. Unclassified presets remain on the legacy section path.
 */
export function createCinema2DesignParentGroupModel(
  plan: Readonly<Cinema2CompiledPresetPlan>,
  state: Readonly<Cinema2ParameterStateSnapshot>,
): readonly Readonly<Cinema2DesignParentGroupModel>[] {
  const availableCapabilities = new Set(plan.capabilities.available)
  const values = { ...state.persistentValues, ...state.runtimeOnlyValues }
  const instanceOwners = collectInspectorInstanceOwners(plan)
  const inactiveCameraParameters = collectInactiveCameraParameterIds(plan)
  const parents = new Map<Cinema2DesignParentGroup, MutableDesignParentGroup>()

  for (const [authoredIndex, definition] of plan.parameters.definitions.entries()) {
    const parentId = definition.designParentGroup
    if (parentId == null) continue
    if (definition.exposure === 'hidden' || definition.exposure === 'diagnostic') continue
    if (inactiveCameraParameters.has(definition.id) && !instanceOwners.has(definition.id)) continue

    const instance = instanceOwners.get(definition.id) ?? null
    const sectionId = instance?.sectionId ?? resolveSectionId(definition.section)
    if (SECTION_BY_ID.get(sectionId)?.surface !== 'design') continue
    if (!conditionsPass(definition.visibleWhen, values, availableCapabilities)) continue

    let parent = parents.get(parentId)
    if (!parent) {
      parent = { controls: [], groups: new Map() }
      parents.set(parentId, parent)
    }

    const item: ProjectedControl = {
      control: createControlModel(definition, values, availableCapabilities),
      sectionId,
      // Secondary grouping is intentionally preserved only inside Design.
      // Master Controls, Effects, and Palette stay flat, matching the current
      // Reactor presentation without any preset/label special-casing.
      groupLabel: parentId === 'design' ? definition.group?.trim() || null : null,
      order: definition.order ?? authoredIndex,
      authoredIndex,
      advanced: definition.exposure === 'advanced',
      instance: null,
    }

    if (parentId === 'design' && item.groupLabel != null) addToMutableGroup(parent.groups, item)
    else parent.controls.push(item)
  }

  return deepFreeze(DESIGN_PARENT_DEFINITIONS.map(definition => {
    const parent = parents.get(definition.id)
    const groups = parent == null ? [] : [...parent.groups.values()].map(finalizeGroup).sort(compareGroups)
    return {
      ...definition,
      controls: parent == null ? [] : sortControls(parent.controls).map(item => item.control),
      groups,
    }
  }))
}

function createControlModel(
  definition: Readonly<Cinema2CompiledParameterDefinition>,
  values: Readonly<Record<string, Cinema2JsonValue>>,
  availableCapabilities: ReadonlySet<string>,
): Cinema2InspectorControlModel {
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

  return {
    definition,
    value: Object.prototype.hasOwnProperty.call(values, definition.id) ? cloneJson(values[definition.id]) : undefined,
    enabled,
    disabledReason,
  }
}

function collectInspectorInstanceOwners(
  plan: Readonly<Cinema2CompiledPresetPlan>,
): ReadonlyMap<Cinema2ParameterId, InspectorInstanceDescriptor | null> {
  const owners = new Map<Cinema2ParameterId, InspectorInstanceDescriptor | null>()
  const manifest = plan.manifest

  for (const [index, effect] of (manifest.effects ?? []).entries()) {
    const descriptor: InspectorInstanceDescriptor = {
      key: `effect:${effect.id}`,
      kind: 'effect',
      id: String(effect.id),
      label: titleFromStableId(String(effect.typeId)),
      sectionId: 'effects',
      order: effect.order ?? index,
    }
    for (const ref of Object.values(effect.parameterBindings ?? {})) assignOwner(owners, ref.$ref, descriptor)
    for (const ref of Object.values(effect.actionBindings ?? {})) assignOwner(owners, ref.$ref, descriptor)
  }

  for (const [index, slot] of (manifest.mediaSlots ?? []).entries()) {
    const descriptor: InspectorInstanceDescriptor = {
      key: `media:${slot.id}`,
      kind: 'media',
      id: String(slot.id),
      label: slot.label,
      sectionId: 'media',
      order: index,
    }
    for (const definition of plan.parameters.definitions) {
      if (definition.mediaSlot?.$ref === slot.id) assignOwner(owners, definition.id, descriptor)
    }
  }

  const cameras = manifest.cameras ?? []
  const requestedCamera = manifest.defaults?.camera?.$ref
  const activeCamera = cameras.find(camera => camera.id === requestedCamera) ?? cameras[0] ?? null
  if (activeCamera) {
    const descriptor: InspectorInstanceDescriptor = {
      key: `camera:${activeCamera.id}`,
      kind: 'camera',
      id: String(activeCamera.id),
      label: activeCamera.label,
      sectionId: 'camera',
      order: Math.max(0, cameras.indexOf(activeCamera)),
    }
    for (const ref of Object.values(activeCamera.controls ?? {})) if (ref) assignOwner(owners, ref.$ref, descriptor)
  }

  const environment = manifest.environment
  if (environment?.controls) {
    const descriptor: InspectorInstanceDescriptor = {
      key: 'environment:environment',
      kind: 'environment',
      id: 'environment',
      label: 'Environment',
      sectionId: 'environment',
      order: Number.MAX_SAFE_INTEGER - 1,
    }
    for (const ref of Object.values(environment.controls)) if (ref) assignOwner(owners, ref.$ref, descriptor)
  }

  for (const [index, light] of (manifest.lighting?.lights ?? []).entries()) {
    if (!light.controls) continue
    const descriptor: InspectorInstanceDescriptor = {
      key: `light:${light.id}`,
      kind: 'light',
      id: String(light.id),
      label: `${titleFromStableId(light.type)} Light`,
      sectionId: 'environment',
      order: index,
    }
    for (const ref of Object.values(light.controls)) if (ref) assignOwner(owners, ref.$ref, descriptor)
  }

  return owners
}

function collectInactiveCameraParameterIds(plan: Readonly<Cinema2CompiledPresetPlan>): ReadonlySet<Cinema2ParameterId> {
  const cameras = plan.manifest.cameras ?? []
  const requestedCamera = plan.manifest.defaults?.camera?.$ref
  const activeCamera = cameras.find(camera => camera.id === requestedCamera) ?? cameras[0] ?? null
  const inactive = new Set<Cinema2ParameterId>()
  for (const camera of cameras) {
    if (camera.id === activeCamera?.id) continue
    for (const ref of Object.values(camera.controls ?? {})) if (ref) inactive.add(ref.$ref)
  }
  return inactive
}

function assignOwner(
  owners: Map<Cinema2ParameterId, InspectorInstanceDescriptor | null>,
  parameterId: Cinema2ParameterId,
  descriptor: InspectorInstanceDescriptor,
): void {
  if (!owners.has(parameterId)) {
    owners.set(parameterId, descriptor)
    return
  }
  const existing = owners.get(parameterId)
  if (existing?.key === descriptor.key) return
  // A shared parameter that controls multiple instances remains a normal
  // authored group so the Inspector presents one canonical editable control.
  owners.set(parameterId, null)
}

function addToMutableGroup(
  groups: Map<string, MutableGroup>,
  item: ProjectedControl,
): void {
  const key = item.groupLabel ?? '__ungrouped__'
  let group = groups.get(key)
  if (!group) {
    group = {
      kind: 'group',
      label: item.groupLabel,
      controls: [],
      advanced: true,
      order: item.order,
    }
    groups.set(key, group)
  }
  group.controls.push(item)
  group.order = Math.min(group.order, item.order)
  if (!item.advanced) group.advanced = false
}

function finalizeGroup(group: MutableGroup): Cinema2InspectorGroupModel {
  const controls = sortControls(group.controls).map(item => item.control)
  return {
    kind: 'group',
    label: group.label,
    controls,
    advanced: group.advanced,
    order: group.order,
  }
}

function finalizeInstance(instance: MutableInstance): Cinema2InspectorInstanceModel {
  const subgroups = [...instance.subgroupMap.values()].map(finalizeGroup)
  subgroups.sort(compareGroups)
  const controls = sortControls(instance.controls).map(item => item.control)
  const commonGroupLabel = commonNonEmptyGroupLabel(instance.controls)
  const label = instance.descriptor.kind === 'effect' || instance.descriptor.kind === 'light'
    ? commonGroupLabel ?? instance.descriptor.label
    : instance.descriptor.label
  return {
    kind: 'instance',
    instanceKind: instance.descriptor.kind,
    instanceId: instance.descriptor.id,
    label,
    controls,
    groups: subgroups,
    advanced: instance.advanced,
    order: instance.descriptor.order,
  }
}

function sortControls(items: readonly ProjectedControl[]): ProjectedControl[] {
  return [...items].sort((left, right) => (
    Number(left.advanced) - Number(right.advanced)
    || left.order - right.order
    || left.authoredIndex - right.authoredIndex
  ))
}

function compareEntries(left: Cinema2InspectorEntryModel, right: Cinema2InspectorEntryModel): number {
  return entryRank(left) - entryRank(right)
    || left.order - right.order
}

function entryRank(entry: Cinema2InspectorEntryModel): number {
  if (entry.advanced) return 3
  if (entry.kind === 'instance') return 2
  if (entry.label == null) return 0
  return 1
}

function compareGroups(left: Cinema2InspectorGroupModel, right: Cinema2InspectorGroupModel): number {
  if (left.advanced !== right.advanced) return Number(left.advanced) - Number(right.advanced)
  if ((left.label == null) !== (right.label == null)) return left.label == null ? -1 : 1
  return left.order - right.order
}

function commonNonEmptyGroupLabel(items: readonly ProjectedControl[]): string | null {
  const labels = new Set(items.map(item => item.groupLabel).filter((label): label is string => Boolean(label)))
  return labels.size === 1 ? [...labels][0] : null
}

function resolveSectionId(authored: string | undefined): Cinema2InspectorSectionId {
  const normalized = authored?.trim().toLowerCase() ?? ''
  return SECTION_ALIASES.get(normalized) ?? 'design'
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

function titleFromStableId(value: string): string {
  return value
    .split(/[._-]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
