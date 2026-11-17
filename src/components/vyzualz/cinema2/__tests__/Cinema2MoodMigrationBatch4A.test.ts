import { CINEMA2_INERTIA_PRESET_MANIFEST } from '../presets/Cinema2InertiaPreset'
import { CINEMA2_NEON_FOREST_PRESET_MANIFEST } from '../presets/Cinema2NeonForestPreset'
import { CINEMA2_NIGHTSHIFT_PRESET_MANIFEST } from '../presets/Cinema2NightshiftPreset'
import { CINEMA2_PSYLO_PRESET_MANIFEST } from '../presets/Cinema2PsyloPreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

// Every Batch 4A preset has Pattern Change and a Trigger, so the music chooses both while Auto Performance is on.
const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'Inertia', manifest: CINEMA2_INERTIA_PRESET_MANIFEST, auto: 'inertia-auto-performance', strength: 'inertia-audio-response',
    pattern: { patternChange: 'inertia-pattern-change', trigger: 'inertia-trigger' },
    up: [['inertia-sculpture', 'intensity'], ['inertia-sculpture', 'motionSpeed'], ['inertia-sculpture', 'motionAmount'], ['inertia-sculpture', 'deformation'], ['inertia-sculpture', 'pointSize'], ['inertia-sculpture', 'coreSize']],
    down: [['inertia-sculpture', 'intensity'], ['inertia-sculpture', 'motionSpeed'], ['inertia-sculpture', 'motionAmount']],
    shock: [['inertia-sculpture', 'intensity'], ['inertia-sculpture', 'deformation'], ['inertia-sculpture', 'pointSize'], ['inertia-sculpture', 'coreSize']],
  },
  {
    name: 'Nightshift', manifest: CINEMA2_NIGHTSHIFT_PRESET_MANIFEST, auto: 'nightshift-auto-performance', strength: 'nightshift-music-response',
    pattern: { patternChange: 'nightshift-pattern-change', trigger: 'nightshift-trigger' },
    up: [['nightshift-static-core', 'master'], ['nightshift-static-core', 'motion'], ['nightshift-static-core', 'floor'], ['nightshift-static-core', 'ball'], ['nightshift-static-core', 'ceiling'], ['nightshift-bloom-effect', 'mix']],
    down: [['nightshift-static-core', 'master'], ['nightshift-static-core', 'motion'], ['nightshift-static-core', 'floor']],
    shock: [['nightshift-static-core', 'master'], ['nightshift-static-core', 'ball'], ['nightshift-static-core', 'ceiling'], ['nightshift-bloom-effect', 'mix']],
  },
  {
    name: 'PSYLO', manifest: CINEMA2_PSYLO_PRESET_MANIFEST, auto: 'psylo-auto-performance', strength: 'psylo-music-response',
    pattern: { patternChange: 'psylo-pattern-change', trigger: 'psylo-trigger' },
    up: [['psylo-forest', 'master'], ['psylo-forest', 'amount'], ['psylo-forest', 'speed'], ['psylo-forest', 'emission'], ['psylo-forest', 'spores'], ['psylo-atmosphere-effect', 'beamIntensity'], ['psylo-bloom-effect', 'mix']],
    down: [['psylo-forest', 'master'], ['psylo-forest', 'amount'], ['psylo-forest', 'speed'], ['psylo-forest', 'emission']],
    shock: [['psylo-forest', 'master'], ['psylo-forest', 'emission'], ['psylo-atmosphere-effect', 'beamIntensity'], ['psylo-bloom-effect', 'mix']],
  },
  {
    name: 'Neon Forest', manifest: CINEMA2_NEON_FOREST_PRESET_MANIFEST, auto: 'neon-forest-auto-performance', strength: 'neon-forest-music-response',
    pattern: { patternChange: 'neon-forest-pattern-change', trigger: 'neon-forest-trigger' },
    up: [['neon-forest-forest', 'master'], ['neon-forest-forest', 'amount'], ['neon-forest-forest', 'speed'], ['neon-forest-forest', 'emission'], ['neon-forest-forest', 'particles'], ['neon-forest-atmosphere-effect', 'beamIntensity'], ['neon-forest-bloom-effect', 'mix']],
    down: [['neon-forest-forest', 'master'], ['neon-forest-forest', 'amount'], ['neon-forest-forest', 'speed'], ['neon-forest-forest', 'emission']],
    shock: [['neon-forest-forest', 'master'], ['neon-forest-forest', 'emission'], ['neon-forest-forest', 'portalSize'], ['neon-forest-atmosphere-effect', 'beamIntensity'], ['neon-forest-bloom-effect', 'mix']],
  },
]
describeMoodMigration('Batch 4A', CASES)
