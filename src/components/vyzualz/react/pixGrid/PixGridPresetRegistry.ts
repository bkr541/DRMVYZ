import type { ReactPreset } from '../ReactTypes'
import type { PresetDiscoveryFields } from '../presetDiscovery'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from './PixGridArtwork'
import { createPixGridDeckGeneratedPreset } from './PixGridDeckPreset'
import { PIX_GRID_PERFORMANCE_PROGRAM_BY_ID, PIX_GRID_PERFORMANCE_PROGRAMS } from './PixGridPerformancePrograms'
import { PIX_GRID_PRESETS } from './PixGridPresets'
import {
  PIX_GRID_MOTION_PROFILE_BY_ID,
  PIX_GRID_MOTION_PROFILES,
  PIX_GRID_MOTION_AUDIO_TARGETS,
  type PixGridMotionProfile,
} from './PixGridMotionProfiles'
import { PIX_GRID_AUDIO_INTELLIGENCE_SOURCE_BY_ID } from './PixGridAudioIntelligenceRegistry'
import { PIX_GRID_ASSIGNMENT_TARGET_BY_ID } from './PixGridAssignmentCompiler'
import { MAX_PIX_GRID_SEQUENCE_OCCURRENCES } from './PixGridLimits'
import {
  createPixGridSequenceSourceResolver,
  materializePixGridSequenceDeck,
  type PixGridSequenceDefinition,
} from './PixGridSequenceDefinition'
import type { PixGridDeckDefinition, PixGridDeckTransitionMode } from './PixGridDeckDomain'
import type { PixGridPerformanceProgram } from './PixGridPerformanceTypes'

export const PIX_GRID_PRESET_DEFINITION_SCHEMA_VERSION = 1 as const

export interface PixGridPresetDefinition extends PresetDiscoveryFields {
  schemaVersion: typeof PIX_GRID_PRESET_DEFINITION_SCHEMA_VERSION
  id: string
  version: number
  name: string
  description: string
  category: 'authored' | 'imageSequence' | 'mediaDeckProducer'
  preset?: ReactPreset
  sequence?: PixGridSequenceDefinition
  motionProfileIds: readonly string[]
  defaultMotionProfileId?: string
  performanceProgramId?: string
  requiredCapabilities: readonly string[]
  visibility?: 'catalog' | 'reference' | 'internal'
}

export interface PixGridPresetRegistryIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  presetId?: string
  path?: string
}

export interface CompiledPixGridPresetDefinition extends PixGridPresetDefinition {
  runtimeRevision: string
  sequenceDeck: PixGridDeckDefinition | null
  motionProfiles: readonly PixGridMotionProfile[]
  performanceProgram: PixGridPerformanceProgram | null
}

export interface PixGridPresetConformanceReport {
  presetId: string
  compatible: boolean
  errors: readonly PixGridPresetRegistryIssue[]
  warnings: readonly PixGridPresetRegistryIssue[]
  runtimeRevision: string | null
}

const VALID_TRANSITION_MODES = new Set<PixGridDeckTransitionMode>([
  'auto', 'pixelTransport', 'pixelDissolve', 'crossfade', 'rowWipe', 'columnWipe', 'checkerWipe', 'radialReveal', 'hardCut',
])

const symbolSvg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><g fill="#5de4ff">${body}</g></svg>`

export const PIX_GRID_REFERENCE_SEQUENCE: PixGridSequenceDefinition = {
  schemaVersion: 1,
  id: 'reference-symbol-morph', revision: 1, name: 'Reference Symbol Morph',
  sources: [
    { id: 'heart', kind: 'generatedSvg', width: 32, height: 32, svg: symbolSvg('<path d="M16 27 4 15C-2 7 8 1 16 9 24 1 34 7 28 15Z"/>') },
    { id: 'skull', kind: 'generatedSvg', width: 32, height: 32, svg: symbolSvg('<path d="M7 5h18l4 6v10l-5 5h-3v4h-3v-5h-4v5h-3v-4H8l-5-5V11Zm3 8v6h6v-6Zm12 0h-6v6h6Z"/>') },
    { id: 'lightning', kind: 'generatedSvg', width: 32, height: 32, svg: symbolSvg('<path d="M18 1 5 18h9l-2 13 15-19h-9Z"/>') },
    { id: 'star', kind: 'generatedSvg', width: 32, height: 32, svg: symbolSvg('<path d="m16 1 4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1Z"/>') },
  ],
  items: [
    { id: 'heart-occurrence', sourceId: 'heart', seed: 11 },
    { id: 'skull-occurrence', sourceId: 'skull', seed: 23 },
    { id: 'lightning-occurrence', sourceId: 'lightning', seed: 37 },
    { id: 'star-occurrence', sourceId: 'star', seed: 41 },
  ],
  loop: true, playbackOrder: 'forward', defaultItemDurationBeats: 4, motionProfileId: 'flow',
  sceneMotionProfileIds: { 'reference-symbol-morph-drop': 'explosive-reconstruction' },
  sectionItemAssignments: { intro: ['heart-occurrence'], build: ['lightning-occurrence'], drop: ['star-occurrence'] },
  transitionPolicy: {
    mode: 'pixelTransport', durationFraction: 0.5, anchorMode: 'arrival', arrivalAnchor: 'bar',
    pairOverrides: [
      { sourceItemId: 'heart-occurrence', targetItemId: 'skull-occurrence', mode: 'pixelTransport', motionProfileId: 'flow' },
      { sourceItemId: 'skull-occurrence', targetItemId: 'lightning-occurrence', mode: 'pixelTransport', motionProfileId: 'explosive-reconstruction' },
      { sourceItemId: 'lightning-occurrence', targetItemId: 'star-occurrence', mode: 'pixelTransport', motionProfileId: 'clustered-morph' },
      { sourceItemId: 'star-occurrence', targetItemId: 'heart-occurrence', mode: 'pixelTransport', motionProfileId: 'directional-assembly' },
    ],
  },
  animationSeed: 2025,
}

const referenceDeck = materializePixGridSequenceDeck(PIX_GRID_REFERENCE_SEQUENCE, 'pix-grid-reference-symbol-morph')
const referencePreset = createPixGridDeckGeneratedPreset(referenceDeck)

function authoredDefinition(preset: ReactPreset): PixGridPresetDefinition {
  return {
    schemaVersion: PIX_GRID_PRESET_DEFINITION_SCHEMA_VERSION,
    id: preset.id, version: preset.pixGridSettings?.authoredConfigurationVersion ?? 1,
    name: preset.name, description: preset.description ?? '', category: 'authored', preset,
    motionProfileIds: ['balanced'], defaultMotionProfileId: 'balanced',
    performanceProgramId: preset.pixGridSettings?.performanceProgramId ?? undefined,
    requiredCapabilities: ['layers', 'groups', 'sharedAudioIntelligence'], visibility: 'catalog',
  }
}

export const PIX_GRID_PRESET_DEFINITIONS: readonly PixGridPresetDefinition[] = Object.freeze([
  ...PIX_GRID_PRESETS.map(authoredDefinition),
  {
    schemaVersion: PIX_GRID_PRESET_DEFINITION_SCHEMA_VERSION,
    id: 'pix-grid-media-deck-producer', version: 1, name: 'Media Deck Producer',
    description: 'Dynamic user-media producer for the universal PixGrid sequence runtime.',
    category: 'mediaDeckProducer', motionProfileIds: PIX_GRID_MOTION_PROFILES.map(profile => profile.id),
    defaultMotionProfileId: 'balanced', performanceProgramId: 'pix-grid-media-deck-performance',
    requiredCapabilities: ['sequence', 'media', 'compiler', 'sharedAudioIntelligence'], visibility: 'internal',
  },
  {
    schemaVersion: PIX_GRID_PRESET_DEFINITION_SCHEMA_VERSION,
    id: referencePreset.id, version: 1, name: referencePreset.name, description: referencePreset.description ?? '',
    category: 'imageSequence', preset: referencePreset, sequence: PIX_GRID_REFERENCE_SEQUENCE,
    motionProfileIds: ['flow', 'explosive-reconstruction', 'clustered-morph', 'directional-assembly'],
    defaultMotionProfileId: 'flow', performanceProgramId: 'pix-grid-media-deck-performance',
    requiredCapabilities: ['sequence', 'generatedSvg', 'compiler', 'sharedAudioIntelligence'], visibility: 'reference',
  },
])

function stableRevision(definition: PixGridPresetDefinition): string {
  const source = `${definition.id}:${definition.version}:${definition.sequence?.revision ?? 0}:${definition.motionProfileIds.join(',')}`
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 0x01000193) }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function validatePixGridPresetDefinitions(definitions: readonly PixGridPresetDefinition[]): PixGridPresetRegistryIssue[] {
  const issues: PixGridPresetRegistryIssue[] = []
  const programIds = new Set<string>()
  for (const program of PIX_GRID_PERFORMANCE_PROGRAMS) {
    if (programIds.has(program.id)) issues.push({ severity: 'error', code: 'duplicate-performance-program-id', message: `Performance program ID "${program.id}" is registered more than once.`, path: 'performancePrograms' })
    programIds.add(program.id)
  }
  const ids = new Set<string>()
  for (const definition of definitions) {
    const fail = (code: string, message: string, path?: string) => issues.push({ severity: 'error', code, message, presetId: definition.id, path })
    if (!definition.id || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(definition.id)) fail('invalid-preset-id', 'Preset ID is missing or invalid.', 'id')
    if (ids.has(definition.id)) fail('duplicate-preset-id', `Preset ID "${definition.id}" is registered more than once.`, 'id')
    ids.add(definition.id)
    if (definition.schemaVersion !== PIX_GRID_PRESET_DEFINITION_SCHEMA_VERSION) fail('unsupported-preset-schema', `Unsupported preset-definition schema ${definition.schemaVersion}.`, 'schemaVersion')
    if (definition.preset && definition.preset.id !== definition.id) fail('preset-id-mismatch', `Runtime preset ID "${definition.preset.id}" does not match its definition.`, 'preset.id')
    if (definition.performanceProgramId && !PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.has(definition.performanceProgramId as never)) fail('missing-performance-program', `Performance program "${definition.performanceProgramId}" is not registered.`, 'performanceProgramId')
    for (const profileId of definition.motionProfileIds) if (!PIX_GRID_MOTION_PROFILE_BY_ID.has(profileId)) fail('missing-motion-profile', `Motion profile "${profileId}" is not registered.`, 'motionProfileIds')
    if (definition.defaultMotionProfileId && !definition.motionProfileIds.includes(definition.defaultMotionProfileId)) fail('invalid-default-motion-profile', `Default motion profile "${definition.defaultMotionProfileId}" is not declared by this preset.`, 'defaultMotionProfileId')
    for (const profileId of definition.motionProfileIds) {
      const motionProfile = PIX_GRID_MOTION_PROFILE_BY_ID.get(profileId)
      for (const route of motionProfile?.audioRoutes ?? []) {
        if (!PIX_GRID_AUDIO_INTELLIGENCE_SOURCE_BY_ID.has(route.source)) fail('invalid-motion-audio-source', `Motion profile "${profileId}" references unknown Audio Intelligence source "${route.source}".`, `motionProfiles.${profileId}.audioRoutes.${route.id}.source`)
        if (!PIX_GRID_MOTION_AUDIO_TARGETS.has(route.target)) fail('invalid-motion-audio-target', `Motion profile "${profileId}" references unknown destination "${route.target}".`, `motionProfiles.${profileId}.audioRoutes.${route.id}.target`)
      }
    }
    const sequence = definition.sequence
    if (definition.category === 'imageSequence' && !sequence) fail('missing-sequence', 'Image-sequence preset does not declare a sequence.', 'sequence')
    if (sequence) {
      if (sequence.items.length < 2 || sequence.items.length > MAX_PIX_GRID_SEQUENCE_OCCURRENCES) fail('invalid-sequence-capacity', `Sequence requires 2–${MAX_PIX_GRID_SEQUENCE_OCCURRENCES} occurrences; received ${sequence.items.length}.`, 'sequence.items')
      const sourceIds = new Set<string>()
      for (const source of sequence.sources) {
        if (sourceIds.has(source.id)) fail('duplicate-sequence-source', `Sequence source "${source.id}" is duplicated.`, 'sequence.sources')
        sourceIds.add(source.id)
        if (source.kind === 'asset' && !PIX_GRID_BUILT_IN_ASSET_BY_ID.has(source.assetId)) fail('missing-asset', `Built-in asset "${source.assetId}" does not exist.`, 'sequence.sources')
      }
      const itemIds = new Set<string>()
      for (const item of sequence.items) {
        if (itemIds.has(item.id)) fail('duplicate-sequence-item', `Sequence occurrence "${item.id}" is duplicated.`, 'sequence.items')
        itemIds.add(item.id)
        if (!sourceIds.has(item.sourceId)) fail('missing-sequence-source', `Sequence occurrence "${item.id}" references unknown source "${item.sourceId}".`, 'sequence.items')
      }
      const policy = sequence.transitionPolicy
      if (policy?.mode && !VALID_TRANSITION_MODES.has(policy.mode)) fail('unknown-transition-strategy', `Transition strategy "${policy.mode}" is not supported.`, 'sequence.transitionPolicy.mode')
      for (const override of policy?.pairOverrides ?? []) {
        if (!itemIds.has(override.sourceItemId) || !itemIds.has(override.targetItemId)) fail('invalid-pair-override', `Pair override ${override.sourceItemId} → ${override.targetItemId} references a missing occurrence.`, 'sequence.transitionPolicy.pairOverrides')
        if (!VALID_TRANSITION_MODES.has(override.mode)) fail('unknown-transition-strategy', `Transition strategy "${override.mode}" is not supported.`, 'sequence.transitionPolicy.pairOverrides')
        if (override.motionProfileId && !PIX_GRID_MOTION_PROFILE_BY_ID.has(override.motionProfileId)) fail('missing-motion-profile', `Pair override references unknown motion profile "${override.motionProfileId}".`, 'sequence.transitionPolicy.pairOverrides')
      }
    }
    for (const layer of definition.preset?.pixGridSettings?.layers ?? []) if (!PIX_GRID_BUILT_IN_ASSET_BY_ID.has(layer.assetId)) fail('missing-asset', `Layer "${layer.id}" references missing asset "${layer.assetId}".`, 'preset.pixGridSettings.layers')
    const sceneIds = new Set(definition.preset?.scenes.map(scene => scene.id) ?? [])
    for (const mapping of definition.preset?.sectionMappings ?? []) if (!sceneIds.has(mapping.sceneId)) fail('missing-scene', `Section "${mapping.sectionType}" references missing scene "${mapping.sceneId}".`, 'preset.sectionMappings')
    const assignments = [
      ...(definition.preset?.pixGridSettings?.audioAssignments ?? []),
      ...(definition.preset?.pixGridSettings?.groups?.flatMap(group => group.reactions) ?? []),
    ]
    for (const assignment of assignments) {
      if (!PIX_GRID_AUDIO_INTELLIGENCE_SOURCE_BY_ID.has(assignment.source)) fail('invalid-audio-source', `Audio assignment "${assignment.id}" references unknown source "${assignment.source}".`, `preset.audioAssignments.${assignment.id}.source`)
      if (!PIX_GRID_ASSIGNMENT_TARGET_BY_ID.has(assignment.target)) fail('invalid-audio-destination', `Audio assignment "${assignment.id}" references unknown destination "${assignment.target}".`, `preset.audioAssignments.${assignment.id}.target`)
    }
  }
  return issues
}

export class PixGridPresetRegistry {
  private readonly definitions = new Map<string, CompiledPixGridPresetDefinition>()
  readonly issues: readonly PixGridPresetRegistryIssue[]

  constructor(definitions: readonly PixGridPresetDefinition[]) {
    this.issues = Object.freeze(validatePixGridPresetDefinitions(definitions))
    const invalidIds = new Set(this.issues.filter(issue => issue.severity === 'error').map(issue => issue.presetId))
    for (const definition of definitions) {
      if (invalidIds.has(definition.id) || this.definitions.has(definition.id)) continue
      const motionProfiles = definition.motionProfileIds.map(id => PIX_GRID_MOTION_PROFILE_BY_ID.get(id)!).filter(Boolean)
      this.definitions.set(definition.id, Object.freeze({
        ...definition, runtimeRevision: stableRevision(definition),
        sequenceDeck: definition.sequence ? materializePixGridSequenceDeck(definition.sequence, definition.id) : null,
        motionProfiles: Object.freeze(motionProfiles),
        performanceProgram: definition.performanceProgramId
          ? PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(definition.performanceProgramId as never) ?? null
          : null,
      }))
    }
  }

  get(id: string): CompiledPixGridPresetDefinition | null { return this.definitions.get(id) ?? null }
  list(): readonly CompiledPixGridPresetDefinition[] { return Object.freeze([...this.definitions.values()]) }
  presetIds(): readonly string[] { return Object.freeze([...this.definitions.keys()]) }
  sequenceDecks(): readonly PixGridDeckDefinition[] { return Object.freeze(this.list().flatMap(definition => definition.sequenceDeck ? [definition.sequenceDeck] : [])) }
}

export const pixGridPresetRegistry = new PixGridPresetRegistry(PIX_GRID_PRESET_DEFINITIONS)
export const PIX_GRID_REGISTERED_PRESET_IDS = pixGridPresetRegistry.presetIds()
export const PIX_GRID_REGISTERED_PERFORMANCE_PROGRAM_IDS = Object.freeze(PIX_GRID_PERFORMANCE_PROGRAMS.map(program => program.id))
export const PIX_GRID_REGISTERED_SEQUENCE_DECKS = pixGridPresetRegistry.sequenceDecks()
export const PIX_GRID_REGISTERED_SEQUENCE_PRESETS = Object.freeze(pixGridPresetRegistry.list().flatMap(definition => definition.category === 'imageSequence' && definition.preset ? [definition.preset] : []))
/** UI discovery is registry-derived; reference/internal definitions stay opt-in. */
export const PIX_GRID_CATALOG_PRESETS = Object.freeze(pixGridPresetRegistry.list().flatMap(definition => definition.visibility === 'catalog' && definition.preset ? [definition.preset] : []))

const resolveRegisteredSource = createPixGridSequenceSourceResolver(PIX_GRID_PRESET_DEFINITIONS.flatMap(definition => definition.sequence ? [definition.sequence] : []))
export function resolvePixGridRegisteredSequenceSource(mediaId: string): Blob | null { return resolveRegisteredSource(mediaId) }
export function getPixGridRegisteredSequenceDeckByPresetId(presetId: string): PixGridDeckDefinition | null {
  return pixGridPresetRegistry.get(presetId)?.sequenceDeck ?? null
}

export function validatePixGridPresetConformance(
  definition: PixGridPresetDefinition,
  allDefinitions: readonly PixGridPresetDefinition[] = [definition],
): PixGridPresetConformanceReport {
  const issues = validatePixGridPresetDefinitions(allDefinitions).filter(issue => issue.presetId === definition.id)
  const errors = issues.filter(issue => issue.severity === 'error')
  const warnings = issues.filter(issue => issue.severity === 'warning')
  return {
    presetId: definition.id,
    compatible: errors.length === 0,
    errors,
    warnings,
    runtimeRevision: errors.length === 0 ? stableRevision(definition) : null,
  }
}

export const PIX_GRID_PRESET_CONFORMANCE_REPORTS: readonly PixGridPresetConformanceReport[] = Object.freeze(
  PIX_GRID_PRESET_DEFINITIONS.map(definition => validatePixGridPresetConformance(definition, PIX_GRID_PRESET_DEFINITIONS)),
)
