import type { ReactEngineDestination, ReactPerformancePad, ReactPresetAutomationCue, ReactTrackSection } from '../../react/ReactTypes'
import type { Cinema2JsonValue, Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import {
  activateCinema2Workspace,
  migrateLegacyCinemaWorkspace,
  type Cinema2WorkspaceDocument,
} from '../runtime/Cinema2WorkspacePersistence'
import {
  CINEMA2_LEGACY_SOURCE_MIGRATIONS,
  resolveCinema2LegacySourceMigration,
  type Cinema2LegacySourceEngineId,
} from './Cinema2LegacyMigrationManifest'

export const REACT_ENGINE_DESTINATION_SCHEMA_VERSION = 1 as const

export interface Cinema2LegacySourceIdentity {
  sourceEngineId: Cinema2LegacySourceEngineId
  sourceId: string
}

export interface Cinema2LegacySelectionMigration {
  legacyEngineId: Cinema2LegacySourceEngineId
  legacySourceId: string | null
}

export function isCinema2LegacySourceEngineId(value: unknown): value is Cinema2LegacySourceEngineId {
  return value === 'shaderPads' || value === 'cinematicPortal'
}

export function normalizeCinema2LegacySelectionMigration(
  engineId: unknown,
  sourceId: unknown,
): Cinema2LegacySelectionMigration | null {
  if (!isCinema2LegacySourceEngineId(engineId)) return null
  const requested = typeof sourceId === 'string' && sourceId ? sourceId : null
  if (requested && resolveCinema2LegacySourceMigration(engineId, requested)) {
    return { legacyEngineId: engineId, legacySourceId: requested }
  }
  if (engineId === 'shaderPads' && requested == null) {
    return { legacyEngineId: engineId, legacySourceId: null }
  }
  const fallback = CINEMA2_LEGACY_SOURCE_MIGRATIONS.find(candidate => (
    candidate.sourceEngineId === engineId && candidate.availability === 'cinema-catalog'
  ))
  return { legacyEngineId: engineId, legacySourceId: fallback?.sourceId ?? null }
}

/** Resolves deterministic composition IDs emitted by the retired Cinema catalog. */
export function resolveCinema2LegacySourceForComposition(
  compositionId: string,
): Cinema2LegacySourceIdentity | null {
  const migration = CINEMA2_LEGACY_SOURCE_MIGRATIONS.find(candidate => {
    const kind = candidate.sourceEngineId === 'shaderPads' ? 'shader' : 'cinematic'
    return `legacy-${kind}-${stableLegacySegment(candidate.sourceId)}` === compositionId
  })
  return migration
    ? { sourceEngineId: migration.sourceEngineId, sourceId: migration.sourceId }
    : null
}

export type Cinema2LegacyCompositionSourceResolver = (
  compositionId: string,
) => Cinema2LegacySourceIdentity | null

export function resolveCinema2LegacyDestination(
  sourceEngineId: Cinema2LegacySourceEngineId,
  sourceId: string,
): ReactEngineDestination | null {
  const migration = resolveCinema2LegacySourceMigration(sourceEngineId, sourceId)
  if (!migration || migration.disposition !== 'migrate') return null
  return {
    schemaVersion: REACT_ENGINE_DESTINATION_SCHEMA_VERSION,
    engineId: 'cinema2',
    presetId: migration.destination.presetId,
    ...(migration.destination.parameterPatch
      ? { parameterPatch: { ...migration.destination.parameterPatch } }
      : {}),
  }
}

export function activateCinema2LegacyDestination(
  workspace: Readonly<Cinema2WorkspaceDocument>,
  destination: ReactEngineDestination | null,
): Readonly<Cinema2WorkspaceDocument> {
  if (!destination || destination.engineId !== 'cinema2') return workspace
  const result = activateCinema2Workspace(workspace, {
    presetId: destination.presetId as Cinema2PresetId,
    ...(destination.variantId ? { look: { id: destination.variantId } } : {}),
    ...(destination.parameterPatch ? { parameterPatch: destination.parameterPatch as Record<string, Cinema2JsonValue> } : {}),
  })
  return result.ok ? result.document : workspace
}

export function migrateLegacyPerformancePadsToCinema2(
  pads: readonly ReactPerformancePad[],
  resolveCompositionSource?: Cinema2LegacyCompositionSourceResolver,
): ReactPerformancePad[] {
  return pads.map(pad => {
    const raw = pad as ReactPerformancePad & { cinemaCompositionId?: unknown }
    const source = legacySourceFromRecord(raw, resolveCompositionSource)
    if (!source) {
      const { cinemaCompositionId: _legacy, ...withoutLegacy } = raw
      return withoutLegacy
    }
    const destination = resolveCinema2LegacyDestination(source.sourceEngineId, source.sourceId)
    const { cinemaCompositionId: _legacy, ...withoutLegacy } = raw
    return destination
      ? { ...withoutLegacy, presetId: null, destination }
      : { ...withoutLegacy, presetId: null, destination: null, label: 'Empty', color: '#3a4650' }
  })
}

export function migrateLegacyPresetAutomationCuesToCinema2(
  cuesByTrackId: Readonly<Record<string, readonly ReactPresetAutomationCue[]>>,
  resolveCompositionSource?: Cinema2LegacyCompositionSourceResolver,
): Record<string, ReactPresetAutomationCue[]> {
  return Object.fromEntries(Object.entries(cuesByTrackId).map(([trackId, cues]) => [
    trackId,
    cues.map(cue => {
      const raw = cue as ReactPresetAutomationCue & { cinemaCompositionId?: unknown }
      const source = legacySourceFromRecord(raw, resolveCompositionSource)
      const { cinemaCompositionId: _legacy, ...withoutLegacy } = raw
      if (!source) return withoutLegacy
      const destination = resolveCinema2LegacyDestination(source.sourceEngineId, source.sourceId)
      return { ...withoutLegacy, presetId: null, destination }
    }),
  ]))
}

export function migrateLegacyTrackSectionsToCinema2(
  sections: readonly ReactTrackSection[],
  resolveCompositionSource?: Cinema2LegacyCompositionSourceResolver,
): ReactTrackSection[] {
  return sections.map(section => {
    const raw = section as ReactTrackSection & {
      presetId?: unknown
      legacySourceId?: unknown
      cinemaCompositionId?: unknown
    }
    if (raw.engineId !== 'cinema' && raw.engineId !== 'shaderPads' && raw.engineId !== 'cinematicPortal') {
      return section
    }
    const source = legacySourceFromRecord(raw, resolveCompositionSource)
    const destination = source
      ? resolveCinema2LegacyDestination(source.sourceEngineId, source.sourceId)
      : null
    const {
      cinemaCompositionId: _compositionId,
      legacySourceId: _legacySourceId,
      presetId: _presetId,
      ...withoutLegacy
    } = raw
    return {
      ...withoutLegacy,
      engineId: 'cinema2',
      ...(destination ? { destination } : { destination: null }),
    }
  })
}

export function migrateLegacyReactSelectionToCinema2(input: {
  workspace: Readonly<Cinema2WorkspaceDocument>
  engineId: unknown
  presetId: unknown
  pendingSelection?: unknown
}): { workspace: Readonly<Cinema2WorkspaceDocument>; selectedLegacyEngine: boolean } {
  const pending = isRecord(input.pendingSelection) ? input.pendingSelection : null
  const pendingEngine = pending?.legacyEngineId
  const pendingSource = pending?.legacySourceId
  const engineId = isLegacySourceEngineId(pendingEngine)
    ? pendingEngine
    : isLegacySourceEngineId(input.engineId)
      ? input.engineId
      : null
  const sourceId = typeof pendingSource === 'string' && pendingSource
    ? pendingSource
    : typeof input.presetId === 'string' && input.presetId
      ? input.presetId
      : null
  const selectedLegacyEngine = input.engineId === 'cinema' || isLegacySourceEngineId(input.engineId) || engineId != null
  const destination = engineId && sourceId
    ? resolveCinema2LegacyDestination(engineId, sourceId)
    : null
  return {
    workspace: activateCinema2LegacyDestination(input.workspace, destination),
    selectedLegacyEngine,
  }
}

export function migrateLegacyCinemaStoreToCinema2(input: {
  workspace: Readonly<Cinema2WorkspaceDocument>
  legacyDocument: unknown
  activeSource: Cinema2LegacySourceIdentity | null
  archivedAt?: string
}): Readonly<Cinema2WorkspaceDocument> {
  const destination = input.activeSource
    ? resolveCinema2LegacyDestination(input.activeSource.sourceEngineId, input.activeSource.sourceId)
    : null
  return migrateLegacyCinemaWorkspace(input.workspace, {
    legacyDocument: input.legacyDocument,
    ...(destination ? {
      activation: {
        presetId: destination.presetId as Cinema2PresetId,
        ...(destination.variantId ? { look: { id: destination.variantId } } : {}),
        ...(destination.parameterPatch
          ? { parameterPatch: destination.parameterPatch as Record<string, Cinema2JsonValue> }
          : {}),
      },
    } : {}),
    ...(input.archivedAt ? { archivedAt: input.archivedAt } : {}),
  }).document
}

function legacySourceFromRecord(
  value: {
    presetId?: unknown
    legacySourceId?: unknown
    engineId?: unknown
    cinemaCompositionId?: unknown
  },
  resolveCompositionSource?: Cinema2LegacyCompositionSourceResolver,
): Cinema2LegacySourceIdentity | null {
  const presetId = typeof value.presetId === 'string' && value.presetId ? value.presetId : null
  if (presetId && resolveCinema2LegacySourceMigration('cinematicPortal', presetId)) {
    return { sourceEngineId: 'cinematicPortal', sourceId: presetId }
  }
  const legacySourceId = typeof value.legacySourceId === 'string' && value.legacySourceId
    ? value.legacySourceId
    : null
  if (legacySourceId && isLegacySourceEngineId(value.engineId)) {
    return { sourceEngineId: value.engineId, sourceId: legacySourceId }
  }
  const compositionId = typeof value.cinemaCompositionId === 'string' && value.cinemaCompositionId
    ? value.cinemaCompositionId
    : null
  return compositionId && resolveCompositionSource ? resolveCompositionSource(compositionId) : null
}

function isLegacySourceEngineId(value: unknown): value is Cinema2LegacySourceEngineId {
  return isCinema2LegacySourceEngineId(value)
}

function stableLegacySegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'legacy'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
