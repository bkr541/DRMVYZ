import type {
  PixGridCanonicalSignatures,
  PixGridGroup,
  PixGridLayer,
  PixGridPresetSettings,
  PixGridReactionAssignment,
} from './PixGridTypes'

function stableSerialize(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(',')}}`
  }
  return String(value)
}

function compactSignature(value: unknown): string {
  const input = stableSerialize(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function pixGridGroupSignature(group: PixGridGroup): string {
  const { reactions: _reactions, ...definition } = group
  return compactSignature(definition)
}

export function pixGridAssignmentSignature(assignment: PixGridReactionAssignment): string {
  return compactSignature(assignment)
}

export function pixGridLegacyPerceptualAssignmentSignature(assignment: PixGridReactionAssignment): string {
  const { perceptualGain: _gain, minimumEffectiveStrength: _floor, maskSizeCompensation: _mask, ...legacy } = assignment
  return compactSignature(legacy)
}

export function pixGridLayerAnimationSignature(layer: PixGridLayer): string {
  return compactSignature({
    animations: layer.animations,
    audioReactivity: layer.audioReactivity ?? null,
    densityRank: layer.densityRank,
    seed: layer.seed,
  })
}

export function pixGridGlobalAssignmentSignatureKey(assignmentId: string): string {
  return `audio:${assignmentId}`
}

export function pixGridGroupAssignmentSignatureKey(groupId: string, assignmentId: string): string {
  return `group:${groupId}:${assignmentId}`
}

export function createEmptyPixGridCanonicalSignatures(): PixGridCanonicalSignatures {
  return {
    groups: {},
    assignments: {},
    layerAnimations: {},
  }
}

export function createPixGridCanonicalSignatures(
  settings: Pick<PixGridPresetSettings, 'layers' | 'groups' | 'audioAssignments'> | null | undefined,
): PixGridCanonicalSignatures {
  const signatures = createEmptyPixGridCanonicalSignatures()
  for (const layer of settings?.layers ?? []) {
    signatures.layerAnimations[layer.id] = pixGridLayerAnimationSignature(layer)
  }
  for (const group of settings?.groups ?? []) {
    signatures.groups[group.id] = pixGridGroupSignature(group)
    for (const assignment of group.reactions) {
      signatures.assignments[pixGridGroupAssignmentSignatureKey(group.id, assignment.id)] =
        pixGridAssignmentSignature(assignment)
    }
  }
  for (const assignment of settings?.audioAssignments ?? []) {
    signatures.assignments[pixGridGlobalAssignmentSignatureKey(assignment.id)] =
      pixGridAssignmentSignature(assignment)
  }
  return signatures
}
