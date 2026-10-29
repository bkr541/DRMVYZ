import { CINEMA2_SWITCH_IT_PRESET_MANIFEST } from './Cinema2SwitchItPreset'
import { CINEMA2_ELEVHATE_PRESET_MANIFEST } from './Cinema2ElevhatePreset'
import { CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_AFTERHOURS_PRESET_MANIFEST } from './Cinema2AfterhoursPreset'
import { CINEMA2_ATL_HOE_PRESET_MANIFEST } from './Cinema2AtlHoePreset'
import { CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST } from './Cinema2AtmosphereReferencePreset'
import { CINEMA2_CONDUIT_PRESET_MANIFEST } from './Cinema2ConduitPreset'
import { CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST } from './Cinema2ElectricStormPreset'
import { CINEMA2_GO_TO_PRESET_MANIFEST } from './Cinema2GoToPreset'
import { CINEMA2_HUMN_PRESET_MANIFEST } from './Cinema2HumNPreset'
import { defineCinema2FirstPartyPreset } from './Cinema2PresetAuthoring'
import { CINEMA2_REACTOR_PRESET_MANIFEST } from './Cinema2ReactorPreset'
import { CINEMA2_RELIQUARY_PRESET_MANIFEST } from './Cinema2ReliquaryPreset'
import { CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST } from './Cinema2ReferenceVisualPreset'
import { CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST } from './Cinema2SpatialReferencePreset'
import { CINEMA2_THREE_MODEL_REFERENCE_PRESET_MANIFEST } from './Cinema2ThreeModelReferencePreset'
import { CINEMA2_THRESHOLD_PRESET_MANIFEST } from './Cinema2ThresholdPreset'
import { CINEMA2_SAY_IT_PRESET_MANIFEST } from './Cinema2SayItPreset'
import { CINEMA2_DEPTH_PRESET_MANIFEST } from './Cinema2DepthPreset'
import { CINEMA2_BLOCKSHIFT_PRESET_MANIFEST } from './Cinema2BlockshiftPreset'
import { CINEMA2_BACKSTREET_PRESET_MANIFEST } from './Cinema2BackstreetPreset'
import { CINEMA2_MAINFRAME_PRESET_MANIFEST } from './Cinema2MainframePreset'
import { CINEMA2_ECHOFORM_PRESET_MANIFEST } from './Cinema2EchoformPreset'
import { CINEMA2_ECHOWAVE_PRESET_MANIFEST } from './Cinema2EchowavePreset'
import { CINEMA2_CATHEDRAL_PRESET_MANIFEST } from './Cinema2CathedralPreset'
import { CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST } from './Cinema2AncientMachinePreset'
import { CINEMA2_EVENT_HORIZON_PRESET_MANIFEST } from './Cinema2EventHorizonPreset'
import { CINEMA2_CONSTELLATION_PRESET_MANIFEST } from './Cinema2ConstellationPreset'
import { CINEMA2_SIXFOLD_PRESET_MANIFEST } from './Cinema2SixfoldPreset'
import { CINEMA2_HYPNOTIZE_PRESET_MANIFEST } from './Cinema2HypnotizePreset'
import { CINEMA2_STARTERS_PRESET_MANIFEST } from './Cinema2StartersPreset'
import { CINEMA2_BWC_PRESET_MANIFEST } from './Cinema2BwcPreset'
import { CINEMA2_CANOPY_PRESET_MANIFEST } from './Cinema2CanopyPreset'
import { CINEMA2_VACANCY_PRESET_MANIFEST } from './Cinema2VacancyPreset'
import { CINEMA2_MARQUEE_PRESET_MANIFEST } from './Cinema2MarqueePreset'
import { CINEMA2_NIGHTSHIFT_PRESET_MANIFEST } from './Cinema2NightshiftPreset'

/**
 * Single production registration seam for first-party native Cinema 2.0 presets.
 * Adding a keeper here must pass the shared authoring gate and native compiler;
 * the runtime and schema-driven Inspector remain preset-agnostic.
 */
export const CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS = Object.freeze([
  defineCinema2FirstPartyPreset({role:'keeper',manifest:CINEMA2_SWITCH_IT_PRESET_MANIFEST}),
  // Accepted NIGHTSHIFT native installation; stable identity preserves authored edits.
  defineCinema2FirstPartyPreset({ role: 'keeper', manifest: CINEMA2_NIGHTSHIFT_PRESET_MANIFEST }),
  // In-app review entry. Promote to keeper only after the remaining acceptance gates.
  defineCinema2FirstPartyPreset({ role: 'reference', manifest: CINEMA2_BLOCKSHIFT_PRESET_MANIFEST }),
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
    role: 'reference',
    manifest: CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_AFTERHOURS_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_HUMN_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_THRESHOLD_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_SAY_IT_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_DEPTH_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_GO_TO_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_RELIQUARY_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_CONDUIT_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_ATL_HOE_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_MAINFRAME_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_MARQUEE_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_BACKSTREET_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_ECHOFORM_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_ECHOWAVE_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_CATHEDRAL_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_EVENT_HORIZON_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_CONSTELLATION_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_SIXFOLD_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_HYPNOTIZE_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_STARTERS_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_BWC_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_CANOPY_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'keeper',
    manifest: CINEMA2_VACANCY_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({
    role: 'reference',
    manifest: CINEMA2_THREE_MODEL_REFERENCE_PRESET_MANIFEST,
  }),
  defineCinema2FirstPartyPreset({ role: 'keeper', manifest: CINEMA2_ELEVHATE_PRESET_MANIFEST }),
])
