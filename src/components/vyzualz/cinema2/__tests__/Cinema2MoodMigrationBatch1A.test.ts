import { CINEMA2_GO_TO_PRESET_MANIFEST } from '../presets/Cinema2GoToPreset'
import { CINEMA2_REACTOR_PRESET_MANIFEST } from '../presets/Cinema2ReactorPreset'
import { CINEMA2_RELIQUARY_PRESET_MANIFEST } from '../presets/Cinema2ReliquaryPreset'
import { CINEMA2_THRESHOLD_PRESET_MANIFEST } from '../presets/Cinema2ThresholdPreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'Reactor', manifest: CINEMA2_REACTOR_PRESET_MANIFEST, auto: 'reactor-auto-performance', strength: 'reactor-reactivity',
    up: [['reactor-generator', 'coreIntensity'], ['reactor-generator', 'rayDensity'], ['reactor-composite', 'refraction'], ['reactor-composite', 'shockwaveIntensity'], ['reactor-bloom', 'intensity']],
    down: [['reactor-generator', 'coreIntensity'], ['reactor-bloom', 'intensity']],
    shock: [['reactor-composite', 'shockwaveIntensity'], ['reactor-bloom', 'intensity'], ['reactor-generator', 'coreIntensity']],
  },
  {
    name: 'Threshold', manifest: CINEMA2_THRESHOLD_PRESET_MANIFEST, auto: 'threshold-auto-performance', strength: 'threshold-master-reactivity',
    up: [['threshold-monoliths', 'panelBrightness'], ['threshold-atmosphere', 'shafts'], ['threshold-bloom', 'intensity']],
    down: [['threshold-monoliths', 'panelBrightness'], ['threshold-monoliths', 'intensity'], ['threshold-bloom', 'intensity']],
    shock: [['threshold-bloom', 'intensity'], ['threshold-floor', 'reflectivity'], ['threshold-atmosphere', 'shafts']],
  },
  {
    name: 'GO-TO', manifest: CINEMA2_GO_TO_PRESET_MANIFEST, auto: 'go-to-auto-performance', strength: 'go-to-master-intensity',
    up: [['go-to-volumetric', 'beamIntensity'], ['go-to-volumetric', 'mistAmount'], ['go-to-bloom', 'intensity']],
    down: [['go-to-volumetric', 'mistAmount'], ['go-to-bloom', 'intensity']],
    shock: [['go-to-volumetric', 'beamIntensity'], ['go-to-bloom', 'intensity'], ['go-to-floor', 'reflectivity']],
  },
  {
    name: 'Reliquary', manifest: CINEMA2_RELIQUARY_PRESET_MANIFEST, auto: 'reliquary-auto-performance', strength: 'reliquary-master-intensity',
    up: [['reliquary-scene', 'glowStrength'], ['reliquary-scene', 'crystal.dispersion'], ['reliquary-haze', 'beamIntensity'], ['reliquary-bloom-effect', 'intensity']],
    down: [['reliquary-scene', 'glowStrength'], ['reliquary-scene', 'crystal.dispersion'], ['reliquary-bloom-effect', 'intensity']],
    shock: [['reliquary-scene', 'glowStrength'], ['reliquary-haze', 'beamIntensity'], ['reliquary-bloom-effect', 'intensity']],
  },
]
describeMoodMigration('Batch 1A', CASES)
