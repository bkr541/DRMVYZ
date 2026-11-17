import { CINEMA2_AFTERHOURS_PRESET_MANIFEST } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_ATL_HOE_PRESET_MANIFEST } from '../presets/Cinema2AtlHoePreset'
import { CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST } from '../presets/Cinema2AtmosphereReferencePreset'
import { CINEMA2_CONDUIT_PRESET_MANIFEST } from '../presets/Cinema2ConduitPreset'
import { CINEMA2_ELEVHATE_PRESET_MANIFEST } from '../presets/Cinema2ElevhatePreset'
import { CINEMA2_HYPNOTIZE_PRESET_MANIFEST } from '../presets/Cinema2HypnotizePreset'
import { CINEMA2_ORBITAL_PRESET_MANIFEST } from '../presets/Cinema2OrbitalPreset'
import { CINEMA2_SUBMERGE_PRESET_MANIFEST } from '../presets/Cinema2SubmergePreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

// Afterhours, Conduit and ATL HOE tag only their Auto Performance toggle: their own programs already choose the pattern from the music (see each preset's
// comment). The other five also let the music choose Pattern Change and the Trigger.
const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'Afterhours', manifest: CINEMA2_AFTERHOURS_PRESET_MANIFEST, auto: 'afterhours-auto-performance', strength: 'afterhours-master-intensity',
    up: [['afterhours-laser-field', 'masterIntensity'], ['afterhours-laser-field', 'motionAmount'], ['afterhours-laser-field', 'spread'], ['afterhours-laser-field', 'pulseAmount']],
    down: [['afterhours-laser-field', 'masterIntensity'], ['afterhours-laser-field', 'motionAmount']],
    shock: [['afterhours-laser-field', 'masterIntensity'], ['afterhours-laser-field', 'spread']],
  },
  {
    name: 'Hypnotize', manifest: CINEMA2_HYPNOTIZE_PRESET_MANIFEST, auto: 'hypnotize-auto-performance', strength: 'hypnotize-reactivity',
    pattern: { patternChange: 'hypnotize-pattern-change', trigger: 'hypnotize-trigger' },
    up: [['hypnotize-system', 'intensity'], ['hypnotize-system', 'spread'], ['hypnotize-system', 'depthSpread'], ['hypnotize-system', 'burst'], ['hypnotize-system', 'drift'], ['hypnotize-system', 'spin'], ['hypnotize-system', 'edgeGlow'], ['hypnotize-bloom', 'intensity']],
    down: [['hypnotize-system', 'intensity'], ['hypnotize-system', 'spin'], ['hypnotize-system', 'nodeDensity']],
    // No drop-time drives on purpose: the preset limits flashing (Flash Accents, Drop / Impact LED Gating).
    shock: [],
  },
  {
    name: 'Orbital', manifest: CINEMA2_ORBITAL_PRESET_MANIFEST, auto: 'orbital-auto-performance', strength: 'orbital-motion',
    pattern: { patternChange: 'orbital-pattern-change', trigger: 'orbital-trigger' },
    up: [['orbital-glyphs', 'ring-travel'], ['orbital-glyphs', 'debris'], ['orbital-glyphs', 'letter-depth'], ['orbital-glyphs', 'environmentIntensity'], ['orbital-glyphs', 'highlightSweep'], ['orbital-bloom-effect', 'intensity']],
    down: [['orbital-glyphs', 'debris']],
    shock: [['orbital-glyphs', 'ring-travel'], ['orbital-glyphs', 'environmentIntensity'], ['orbital-glyphs', 'highlightSweep'], ['orbital-bloom-effect', 'intensity']],
  },
  {
    name: 'Submerge', manifest: CINEMA2_SUBMERGE_PRESET_MANIFEST, auto: 'submerge-auto-performance', strength: 'submerge-motion',
    pattern: { patternChange: 'submerge-pattern-change', trigger: 'submerge-trigger' },
    up: [['submerge-glyphs', 'spread'], ['submerge-glyphs', 'waves'], ['submerge-glyphs', 'sunlight'], ['submerge-glyphs', 'caustics'], ['submerge-glyphs', 'particles'], ['submerge-glyphs', 'bubbles'], ['submerge-bloom-effect', 'intensity']],
    down: [['submerge-glyphs', 'sunlight']],
    shock: [['submerge-glyphs', 'spread'], ['submerge-glyphs', 'waves'], ['submerge-glyphs', 'sunlight'], ['submerge-glyphs', 'bubbles'], ['submerge-bloom-effect', 'intensity']],
  },
  {
    name: 'Conduit', manifest: CINEMA2_CONDUIT_PRESET_MANIFEST, auto: 'conduit-auto-performance', strength: 'conduit-master-intensity',
    up: [['conduit-scene', 'segmentRouteDensity'], ['conduit-scene', 'segmentPulseWidth']],
    down: [['conduit-scene', 'segmentRouteDensity'], ['conduit-scene', 'segmentPulseWidth']],
    shock: [],
    minLive: 2,
  },
  {
    name: 'Elevhate', manifest: CINEMA2_ELEVHATE_PRESET_MANIFEST, auto: 'elevhate-autoperformance', strength: 'elevhate-response',
    pattern: { patternChange: 'elevhate-patternchange', trigger: 'elevhate-trigger' },
    up: [['elevhate-world', 'master'], ['elevhate-world', 'speed'], ['elevhate-world', 'opening'], ['elevhate-world', 'width'], ['elevhate-bloom', 'intensity']],
    down: [['elevhate-world', 'master'], ['elevhate-world', 'speed']],
    shock: [['elevhate-world', 'master'], ['elevhate-world', 'opening'], ['elevhate-world', 'width'], ['elevhate-bloom', 'intensity']],
  },
  {
    name: 'Atmosphere Reference', manifest: CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, auto: 'crystalized-auto-performance', strength: 'atmosphere-reference-reactivity',
    pattern: { patternChange: 'crystalized-pattern-change', trigger: 'crystalized-trigger' },
    up: [['atmosphere-reference-object3d', 'motion'], ['atmosphere-reference-object3d', 'monolithHeight'], ['atmosphere-reference-object3d', 'crystal.dispersion'], ['atmosphere-reference-volumetric', 'beamIntensity'], ['atmosphere-reference-bloom', 'intensity']],
    down: [['atmosphere-reference-object3d', 'master'], ['atmosphere-reference-object3d', 'motion']],
    shock: [['atmosphere-reference-object3d', 'monolithHeight'], ['atmosphere-reference-volumetric', 'beamIntensity'], ['atmosphere-reference-bloom', 'intensity']],
  },
  {
    name: 'ATL HOE', manifest: CINEMA2_ATL_HOE_PRESET_MANIFEST, auto: 'atl-hoe-auto-performance', strength: 'atl-hoe-music-reactivity',
    up: [['atl-hoe-scene', 'atlHoeMasterIntensity'], ['atl-hoe-scene', 'atlHoeKickReaction'], ['atl-hoe-scene', 'atlHoeTransientReaction']],
    down: [['atl-hoe-scene', 'atlHoeMasterIntensity']],
    shock: [['atl-hoe-scene', 'atlHoeMasterIntensity']],
    minLive: 2,
  },
]
describeMoodMigration('Batch 5', CASES)
