import {
  isCinema2StableId,
  type Cinema2ChoreographyActionManifest,
  type Cinema2ChoreographyRuleManifest,
  type Cinema2LightGroupManifest,
  type Cinema2LightGroupStaggerOrder,
  type Cinema2LightGroupTargetRef,
  type Cinema2NativePresetManifest,
} from '../contracts/Cinema2NativePresetManifest'

export interface Cinema2LightGroupDiagnostic {
  code: string
  message: string
  path: string
}

export interface Cinema2LightGroupExpansionResult {
  manifest: Cinema2NativePresetManifest
  diagnostics: readonly Cinema2LightGroupDiagnostic[]
}

const STAGGER_ORDERS = new Set<Cinema2LightGroupStaggerOrder>(['forward', 'reverse', 'center-out', 'edges-in'])

/**
 * Stagger rank of each member: 0 fires first. `center-out` starts at the middle member(s) and works
 * outward, `edges-in` is its reverse. Ties (symmetric members) keep authored order.
 */
export function cinema2LightGroupStaggerRanks(count: number, order: Cinema2LightGroupStaggerOrder = 'forward'): readonly number[] {
  const indices = Array.from({ length: count }, (_, index) => index)
  if (order === 'forward') return Object.freeze(indices)
  if (order === 'reverse') return Object.freeze(indices.map(index => count - 1 - index))
  const centre = (count - 1) / 2
  const byDistance = [...indices].sort((left, right) => Math.abs(left - centre) - Math.abs(right - centre) || left - right)
  if (order === 'edges-in') byDistance.reverse()
  const ranks = new Array<number>(count)
  byDistance.forEach((memberIndex, rank) => { ranks[memberIndex] = rank })
  return Object.freeze(ranks)
}

/**
 * Expands `lighting.groups` addressed by `light-group` choreography targets into one ordinary `light`
 * action per member (ids `<action>-<light>`), applying any stagger as `delayBeats`. Pure: the authored
 * manifest is never mutated, and a manifest that uses no groups is returned as-is.
 */
export function expandCinema2LightGroupChoreography(manifest: Cinema2NativePresetManifest): Cinema2LightGroupExpansionResult {
  const diagnostics: Cinema2LightGroupDiagnostic[] = []
  const groups = new Map<string, Readonly<Cinema2LightGroupManifest>>()
  const lightIds = new Set((manifest.lighting?.lights ?? []).map(light => light.id as string))

  const authoredGroups = manifest.lighting?.groups
  if (authoredGroups != null && !Array.isArray(authoredGroups)) {
    diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_INVALID', message: '$.lighting.groups must be an array when present.', path: '$.lighting.groups' })
  }
  for (const [index, group] of (Array.isArray(authoredGroups) ? authoredGroups : []).entries()) {
    const path = `$.lighting.groups[${index}]`
    if (group == null || typeof group !== 'object' || !isCinema2StableId((group as { id?: unknown }).id)) {
      diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_INVALID', message: 'Light group requires a stable id.', path: `${path}.id` })
      continue
    }
    if (groups.has(group.id)) {
      diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_DUPLICATE', message: `Light group "${group.id}" is declared more than once.`, path: `${path}.id` })
      continue
    }
    const members = Array.isArray(group.lights) ? group.lights : []
    if (members.length === 0) {
      diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_EMPTY', message: `Light group "${group.id}" must contain at least one light.`, path: `${path}.lights` })
    }
    const seen = new Set<string>()
    for (const [memberIndex, member] of members.entries()) {
      const id = member?.$ref as string | undefined
      if (typeof id !== 'string' || !lightIds.has(id)) {
        diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_MEMBER_UNKNOWN', message: `Light group "${group.id}" references unknown light "${String(id)}".`, path: `${path}.lights[${memberIndex}]` })
      } else if (seen.has(id)) {
        diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_DUPLICATE_MEMBER', message: `Light group "${group.id}" lists light "${id}" more than once.`, path: `${path}.lights[${memberIndex}]` })
      }
      if (typeof id === 'string') seen.add(id)
    }
    groups.set(group.id, group)
  }

  const rules = manifest.choreography?.rules
  if (!Array.isArray(rules) || !rules.some(rule => Array.isArray(rule?.actions) && rule.actions.some(isGroupAction))) {
    return { manifest, diagnostics: Object.freeze(diagnostics) }
  }

  const usedActionIds = new Set<string>()
  for (const rule of rules) for (const action of Array.isArray(rule?.actions) ? rule.actions : []) usedActionIds.add(action.id)

  const expandedRules: Cinema2ChoreographyRuleManifest[] = rules.map((rule, ruleIndex) => {
    if (!Array.isArray(rule?.actions) || !rule.actions.some(isGroupAction)) return rule
    const actions: Cinema2ChoreographyActionManifest[] = []
    for (const [actionIndex, action] of rule.actions.entries()) {
      if (!isGroupAction(action)) {
        actions.push(action)
        continue
      }
      const path = `$.choreography.rules[${ruleIndex}].actions[${actionIndex}].target`
      const target = action.target as Cinema2LightGroupTargetRef
      const group = groups.get(target.ref?.$ref)
      if (!group) {
        diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_UNKNOWN', message: `Choreography action "${action.id}" targets unknown light group "${String(target.ref?.$ref)}".`, path: `${path}.ref` })
        continue
      }
      const stagger = target.stagger
      if (stagger != null && (!Number.isFinite(stagger.beats) || stagger.beats <= 0 || (stagger.order != null && !STAGGER_ORDERS.has(stagger.order)))) {
        diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_STAGGER_INVALID', message: 'Light group stagger requires beats > 0 and a supported order.', path: `${path}.stagger` })
        continue
      }
      const ranks = cinema2LightGroupStaggerRanks(group.lights.length, stagger?.order)
      for (const [memberIndex, member] of group.lights.entries()) {
        const expandedId = `${action.id}-${member.$ref}`
        if (usedActionIds.has(expandedId)) {
          diagnostics.push({ code: 'CINEMA2_PRESET_LIGHT_GROUP_ACTION_ID_COLLISION', message: `Expanded action id "${expandedId}" collides with another action.`, path })
          continue
        }
        usedActionIds.add(expandedId)
        const { target: _groupTarget, ...rest } = action
        const delayBeats = (action.delayBeats ?? 0) + (stagger ? stagger.beats * ranks[memberIndex] : 0)
        actions.push({
          ...rest,
          id: expandedId as Cinema2ChoreographyActionManifest['id'],
          target: { kind: 'light', ref: member, property: target.property },
          ...(delayBeats > 0 ? { delayBeats } : {}),
        })
      }
    }
    return { ...rule, actions }
  })

  return {
    manifest: { ...manifest, choreography: { ...manifest.choreography!, rules: expandedRules } },
    diagnostics: Object.freeze(diagnostics),
  }
}

function isGroupAction(action: Readonly<Cinema2ChoreographyActionManifest>): boolean {
  return (action?.target as { kind?: unknown } | undefined)?.kind === 'light-group'
}
