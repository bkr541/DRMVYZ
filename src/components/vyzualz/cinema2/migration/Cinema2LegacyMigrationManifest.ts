import type {
  Cinema2JsonValue,
  Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_AFTERHOURS_PRESET_ID,
} from '../presets/Cinema2AfterhoursPreset'
import {
  CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID,
  CINEMA2_ANCIENT_MACHINE_LOOK_ID,
  CINEMA2_ANCIENT_MACHINE_PRESET_ID,
} from '../presets/Cinema2AncientMachinePreset'
import { CINEMA2_CATHEDRAL_PRESET_ID } from '../presets/Cinema2CathedralPreset'
import {
  CINEMA2_CONSTELLATION_AUTO_PERFORMANCE_ID,
  CINEMA2_CONSTELLATION_LOOK_ID,
  CINEMA2_CONSTELLATION_PRESET_ID,
} from '../presets/Cinema2ConstellationPreset'
import { CINEMA2_ELECTRIC_STORM_PRESET_ID } from '../presets/Cinema2ElectricStormPreset'
import {
  CINEMA2_EVENT_HORIZON_AUTO_PERFORMANCE_ID,
  CINEMA2_EVENT_HORIZON_LOOK_ID,
  CINEMA2_EVENT_HORIZON_PRESET_ID,
} from '../presets/Cinema2EventHorizonPreset'
import { CINEMA2_REACTOR_PRESET_ID } from '../presets/Cinema2ReactorPreset'
import { CINEMA2_SIXFOLD_PRESET_ID } from '../presets/Cinema2SixfoldPreset'

/**
 * Phase 1 inventory for the legacy Cinema removal. This module intentionally
 * depends only on Cinema 2.0. Legacy catalog parity is asserted from the legacy
 * test suite so this manifest can remain after `src/components/vyzualz/cinema`
 * is deleted.
 */
export const CINEMA2_LEGACY_ENGINE_IDS = Object.freeze([
  'cinema',
  'shaderPads',
  'cinematicPortal',
] as const)

export type Cinema2LegacyEngineId = typeof CINEMA2_LEGACY_ENGINE_IDS[number]
export type Cinema2LegacySourceEngineId = Extract<Cinema2LegacyEngineId, 'shaderPads' | 'cinematicPortal'>
export type Cinema2LegacySourceAvailability = 'cinema-catalog' | 'compatibility-only'

export interface Cinema2LegacyMigrationDestination {
  presetId: Cinema2PresetId
  parameterPatch?: Readonly<Record<string, Cinema2JsonValue>>
}

interface Cinema2LegacySourceMigrationBase {
  sourceEngineId: Cinema2LegacySourceEngineId
  sourceId: string
  availability: Cinema2LegacySourceAvailability
}

export interface Cinema2LegacyMappedSource extends Cinema2LegacySourceMigrationBase {
  disposition: 'migrate'
  destination: Readonly<Cinema2LegacyMigrationDestination>
}

export interface Cinema2LegacyRetiredSource extends Cinema2LegacySourceMigrationBase {
  disposition: 'retire'
  reason: string
  recovery: 'preserve-in-legacy-archive'
}

export type Cinema2LegacySourceMigration =
  | Cinema2LegacyMappedSource
  | Cinema2LegacyRetiredSource

export const CINEMA2_LEGACY_CUSTOM_CONTENT_POLICY = Object.freeze({
  policyVersion: 1,
  silentDeletionAllowed: false,
  compositions: 'preserve-until-translated-or-exported',
  instances: 'preserve-with-source-composition',
  collections: 'migrate-mapped-members-and-archive-the-original',
  packages: 'retain-a-versioned-reader-and-raw-export',
  editorMetadata: 'archive-with-the-source-document',
} as const)

const cinemaCatalog = 'cinema-catalog' as const
const compatibilityOnly = 'compatibility-only' as const

const eventHorizonLook = (
  look: 'singularityCrown' | 'quasarMaw' | 'binaryCollapse',
): Readonly<Record<string, Cinema2JsonValue>> => Object.freeze({
  [CINEMA2_EVENT_HORIZON_AUTO_PERFORMANCE_ID]: false,
  [CINEMA2_EVENT_HORIZON_LOOK_ID]: look,
})

const ancientMachineLook = (
  look: 'oracleLock' | 'gearSun' | 'epochEngine',
): Readonly<Record<string, Cinema2JsonValue>> => Object.freeze({
  [CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID]: false,
  [CINEMA2_ANCIENT_MACHINE_LOOK_ID]: look,
})

const constellationLook = (
  look:
    | 'crimsonCollapse'
    | 'cyanReverie'
    | 'monolithBreaker'
    | 'trapwire'
    | 'prismHouse'
    | 'industrialLattice'
    | 'auroraBloom'
    | 'minimalSkeleton'
    | 'crystalSynapse'
    | 'helixReliquary'
    | 'polyhedralSupernova'
    | 'orbitalPrismArray',
): Readonly<Record<string, Cinema2JsonValue>> => Object.freeze({
  [CINEMA2_CONSTELLATION_AUTO_PERFORMANCE_ID]: false,
  [CINEMA2_CONSTELLATION_LOOK_ID]: look,
})

function mapped(
  sourceEngineId: Cinema2LegacySourceEngineId,
  sourceId: string,
  availability: Cinema2LegacySourceAvailability,
  presetId: Cinema2PresetId,
  parameterPatch?: Readonly<Record<string, Cinema2JsonValue>>,
): Cinema2LegacyMappedSource {
  return Object.freeze({
    sourceEngineId,
    sourceId,
    availability,
    disposition: 'migrate',
    destination: Object.freeze({ presetId, ...(parameterPatch ? { parameterPatch } : {}) }),
  })
}

function retired(
  sourceEngineId: Cinema2LegacySourceEngineId,
  sourceId: string,
  availability: Cinema2LegacySourceAvailability,
  reason: string,
): Cinema2LegacyRetiredSource {
  return Object.freeze({
    sourceEngineId,
    sourceId,
    availability,
    disposition: 'retire',
    reason,
    recovery: 'preserve-in-legacy-archive',
  })
}

/**
 * Exhaustive disposition for the known Shader Pads and Cinematic Worlds source
 * identities that can be encountered through the legacy Cinema bridge.
 *
 * A `retire` entry is deliberate: it does not silently substitute a visually
 * different preset. Phase 2 must preserve the source document in the legacy
 * archive/export path before the live legacy runtime can be deleted.
 */
export const CINEMA2_LEGACY_SOURCE_MIGRATIONS: readonly Cinema2LegacySourceMigration[] = Object.freeze([
  // Shader Pads sources currently projected into the Cinema catalog.
  retired('shaderPads', 'shader-neon-tunnel', cinemaCatalog, 'Prism Tunnel was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('shaderPads', 'shader-liquid-metaballs', cinemaCatalog, 'Liquid Metaballs was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('shaderPads', 'shader-brand-echo-signal', cinemaCatalog, 'Signal DNA was not selected for the native Cinema 2.0 carry-forward set.'),
  mapped('shaderPads', 'shader-reactor', cinemaCatalog, CINEMA2_REACTOR_PRESET_ID),
  mapped('shaderPads', 'shader-bass-cathedral', cinemaCatalog, CINEMA2_CATHEDRAL_PRESET_ID),
  retired('shaderPads', 'shader-laser-lattice-overdrive', cinemaCatalog, 'Laser Lattice Overdrive was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('shaderPads', 'shader-wobble-glyph-forge', cinemaCatalog, 'Wobble Glyph Forge was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('shaderPads', 'shader-melodic-rift-bloom', cinemaCatalog, 'Melodic Rift Bloom was not selected for the native Cinema 2.0 carry-forward set.'),

  // Shader compatibility identities retained by the source registry audit.
  mapped('shaderPads', 'shader-semantic-drop-reactor', compatibilityOnly, CINEMA2_REACTOR_PRESET_ID),
  mapped('shaderPads', 'shader-trap-shrapnel-reactor', compatibilityOnly, CINEMA2_REACTOR_PRESET_ID),
  mapped('shaderPads', 'shader-brand-singularity', compatibilityOnly, CINEMA2_REACTOR_PRESET_ID),
  retired('shaderPads', 'shader-feedback-kaleidoscope', compatibilityOnly, 'The incomplete feedback preset remains archive-only migration/reference material.'),
  retired('shaderPads', 'shader-riddim-railgun-sequencer', compatibilityOnly, 'The incomplete railgun preset remains archive-only migration/reference material.'),

  // Event Horizon family.
  mapped('cinematicPortal', 'preset-singularity-crown', cinemaCatalog, CINEMA2_EVENT_HORIZON_PRESET_ID, eventHorizonLook('singularityCrown')),
  mapped('cinematicPortal', 'preset-quasar-maw', compatibilityOnly, CINEMA2_EVENT_HORIZON_PRESET_ID, eventHorizonLook('quasarMaw')),
  mapped('cinematicPortal', 'preset-binary-collapse', compatibilityOnly, CINEMA2_EVENT_HORIZON_PRESET_ID, eventHorizonLook('binaryCollapse')),

  // Cathedral and corridor family.
  mapped('cinematicPortal', 'preset-cathedral-run', compatibilityOnly, CINEMA2_CATHEDRAL_PRESET_ID),
  retired('cinematicPortal', 'preset-neon-transit', cinemaCatalog, 'Prism Transit was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('cinematicPortal', 'preset-obsidian-vault', compatibilityOnly, 'Obsidian Vault was not selected for the native Cinema 2.0 carry-forward set.'),

  // Fracture Rift family.
  retired('cinematicPortal', 'preset-glass-wound', cinemaCatalog, 'The Fracture Rift family was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('cinematicPortal', 'preset-wildspace-tear', compatibilityOnly, 'The Fracture Rift family was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('cinematicPortal', 'preset-prismatic-fault', compatibilityOnly, 'The Fracture Rift family was not selected for the native Cinema 2.0 carry-forward set.'),

  // Mirror Dimension family.
  mapped('cinematicPortal', 'preset-sixfold-chamber', cinemaCatalog, CINEMA2_SIXFOLD_PRESET_ID),
  retired('cinematicPortal', 'preset-crystal-mandala', compatibilityOnly, 'Crystal Mandala was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('cinematicPortal', 'preset-infinite-gallery', compatibilityOnly, 'Infinite Gallery was not selected for the native Cinema 2.0 carry-forward set.'),

  // Ancient Machine family.
  mapped('cinematicPortal', 'preset-oracle-lock', cinemaCatalog, CINEMA2_ANCIENT_MACHINE_PRESET_ID, ancientMachineLook('oracleLock')),
  mapped('cinematicPortal', 'preset-gear-sun', compatibilityOnly, CINEMA2_ANCIENT_MACHINE_PRESET_ID, ancientMachineLook('gearSun')),
  mapped('cinematicPortal', 'preset-epoch-engine', compatibilityOnly, CINEMA2_ANCIENT_MACHINE_PRESET_ID, ancientMachineLook('epochEngine')),

  // Storm family and independent ports.
  retired('cinematicPortal', 'preset-tempest-eye', cinemaCatalog, 'Tempest Eye was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('cinematicPortal', 'preset-electric-front', compatibilityOnly, 'Electric Front was not selected for the native Cinema 2.0 carry-forward set.'),
  retired('cinematicPortal', 'preset-ashen-cyclone', compatibilityOnly, 'Ashen Cyclone was not selected for the native Cinema 2.0 carry-forward set.'),
  mapped('cinematicPortal', 'preset-electric-storm', cinemaCatalog, CINEMA2_ELECTRIC_STORM_PRESET_ID),
  mapped('cinematicPortal', 'preset-afterhours', cinemaCatalog, CINEMA2_AFTERHOURS_PRESET_ID),

  // Reactive Constellation family.
  mapped('cinematicPortal', 'preset-crimson-collapse', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('crimsonCollapse')),
  mapped('cinematicPortal', 'preset-cyan-reverie', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('cyanReverie')),
  mapped('cinematicPortal', 'preset-monolith-breaker', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('monolithBreaker')),
  mapped('cinematicPortal', 'preset-trapwire', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('trapwire')),
  mapped('cinematicPortal', 'preset-prism-house', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('prismHouse')),
  mapped('cinematicPortal', 'preset-industrial-lattice', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('industrialLattice')),
  mapped('cinematicPortal', 'preset-aurora-bloom', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('auroraBloom')),
  mapped('cinematicPortal', 'preset-minimal-skeleton', cinemaCatalog, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('minimalSkeleton')),
  mapped('cinematicPortal', 'preset-crystal-synapse', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('crystalSynapse')),
  mapped('cinematicPortal', 'preset-helix-reliquary', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('helixReliquary')),
  mapped('cinematicPortal', 'preset-polyhedral-supernova', compatibilityOnly, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('polyhedralSupernova')),
  mapped('cinematicPortal', 'preset-orbital-prism-array', cinemaCatalog, CINEMA2_CONSTELLATION_PRESET_ID, constellationLook('orbitalPrismArray')),
])

const migrationsBySource = new Map<string, Cinema2LegacySourceMigration>()
for (const migration of CINEMA2_LEGACY_SOURCE_MIGRATIONS) {
  const key = cinema2LegacySourceKey(migration.sourceEngineId, migration.sourceId)
  if (migrationsBySource.has(key)) throw new Error(`Duplicate Cinema 2.0 legacy migration source "${key}".`)
  migrationsBySource.set(key, migration)
}

export function cinema2LegacySourceKey(
  sourceEngineId: Cinema2LegacySourceEngineId,
  sourceId: string,
): string {
  return `${sourceEngineId}:${sourceId}`
}

export function resolveCinema2LegacySourceMigration(
  sourceEngineId: Cinema2LegacySourceEngineId,
  sourceId: string,
): Cinema2LegacySourceMigration | null {
  return migrationsBySource.get(cinema2LegacySourceKey(sourceEngineId, sourceId)) ?? null
}
