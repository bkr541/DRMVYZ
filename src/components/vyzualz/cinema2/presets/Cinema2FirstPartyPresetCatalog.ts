import { CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST } from './Cinema2ElectricStormPreset'
import { defineCinema2FirstPartyPreset } from './Cinema2PresetAuthoring'
import { CINEMA2_REACTOR_PRESET_MANIFEST } from './Cinema2ReactorPreset'
import { CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST } from './Cinema2ReferenceVisualPreset'
import { CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST } from './Cinema2SpatialReferencePreset'

/**
 * Single production registration seam for first-party native Cinema 2.0 presets.
 * Adding a keeper here must pass the shared authoring gate and native compiler;
 * the runtime and schema-driven Inspector remain preset-agnostic.
 */
export const CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS = Object.freeze([
  defineCinema2FirstPartyPreset({
    role: 'foundation',
    manifest: CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'reference',
    manifest: CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_REACTOR_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'reference',
    manifest: CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST,
  }),
])
