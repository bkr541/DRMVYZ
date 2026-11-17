import { CINEMA2_BACKSTREET_PRESET_MANIFEST } from '../presets/Cinema2BackstreetPreset'
import { CINEMA2_ECHOFORM_PRESET_MANIFEST } from '../presets/Cinema2EchoformPreset'
import { CINEMA2_ECHOWAVE_PRESET_MANIFEST } from '../presets/Cinema2EchowavePreset'
import { CINEMA2_CANOPY_PRESET_MANIFEST } from '../presets/Cinema2CanopyPreset'
import { CINEMA2_SWITCH_IT_PRESET_MANIFEST } from '../presets/Cinema2SwitchItPreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

// Every Batch 2 preset has Pattern Change and a Trigger, so the music chooses both while Auto Performance is on.
const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'Backstreet', manifest: CINEMA2_BACKSTREET_PRESET_MANIFEST, auto: 'backstreet-auto-performance', strength: 'backstreet-master-intensity',
    pattern: { patternChange: 'backstreet-pattern-change', trigger: 'backstreet-trigger' },
    up: [['backstreet-scene', 'idleGlow'], ['backstreet-scene', 'scale']],
    down: [['backstreet-scene', 'idleGlow'], ['backstreet-scene', 'masterIntensity']],
    shock: [['backstreet-scene', 'scale']],
    // Master Intensity is already at its maximum by default, so it only comes down (in a calm passage).
    minLive: 2,
  },
  ...(['echoform', 'echowave'] as const).map(name => ({
    name: name === 'echoform' ? 'Echoform' : 'Echowave', manifest: name === 'echoform' ? CINEMA2_ECHOFORM_PRESET_MANIFEST : CINEMA2_ECHOWAVE_PRESET_MANIFEST,
    auto: `${name}-auto-performance`, strength: `${name}-master-intensity`,
    pattern: { patternChange: `${name}-pattern-change`, trigger: `${name}-trigger` },
    up: [[`${name}-figure`, 'masterIntensity'], [`${name}-figure`, 'shellSeparation'], [`${name}-figure`, 'rotationAmount'], [`${name}-figure`, 'pointSize'], [`${name}-figure`, 'idleGlow'], [`${name}-bloom`, 'mix']] as MoodMigrationCase['up'],
    down: [[`${name}-figure`, 'masterIntensity'], [`${name}-figure`, 'idleGlow'], [`${name}-figure`, 'rotationAmount']] as MoodMigrationCase['down'],
    shock: [[`${name}-figure`, 'masterIntensity'], [`${name}-figure`, 'fragmentation'], [`${name}-bloom`, 'mix']] as MoodMigrationCase['shock'],
  })),
  {
    name: 'Canopy', manifest: CINEMA2_CANOPY_PRESET_MANIFEST, auto: 'canopy-auto-performance', strength: 'canopy-master-intensity',
    pattern: { patternChange: 'canopy-pattern-change', trigger: 'canopy-trigger' },
    up: [['canopy-array', 'masterIntensity'], ['canopy-array', 'motionAmount'], ['canopy-array', 'motionSpeed'], ['canopy-array', 'heightRange'], ['canopy-array', 'accentStrength'], ['canopy-bloom', 'intensity']],
    down: [['canopy-array', 'masterIntensity'], ['canopy-array', 'motionAmount'], ['canopy-array', 'idleGlow']],
    shock: [['canopy-array', 'masterIntensity'], ['canopy-array', 'accentStrength'], ['canopy-array', 'heightRange'], ['canopy-bloom', 'intensity']],
  },
  {
    name: 'Switch It', manifest: CINEMA2_SWITCH_IT_PRESET_MANIFEST, auto: 'switch-it-autoperformance', strength: 'switch-it-response',
    pattern: { patternChange: 'switch-it-patternchange', trigger: 'switch-it-trigger' },
    up: [['switch-it-world', 'master'], ['switch-it-world', 'speed'], ['switch-it-world', 'reach'], ['switch-it-world', 'eyeIntensity'], ['switch-it-world', 'columnIntensity'], ['switch-it-bloom', 'intensity'], ['switch-it-world', 'flecks']],
    down: [['switch-it-world', 'master'], ['switch-it-world', 'speed'], ['switch-it-world', 'eyeIntensity'], ['switch-it-world', 'fragmentAmount']],
    shock: [['switch-it-world', 'master'], ['switch-it-world', 'reach'], ['switch-it-world', 'eyeIntensity'], ['switch-it-world', 'columnIntensity'], ['switch-it-bloom', 'intensity']],
  },
]
describeMoodMigration('Batch 2', CASES)
