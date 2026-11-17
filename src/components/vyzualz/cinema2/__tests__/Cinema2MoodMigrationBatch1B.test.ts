import { CINEMA2_HUMN_PRESET_MANIFEST } from '../presets/Cinema2HumNPreset'
import { CINEMA2_STARTERS_PRESET_MANIFEST } from '../presets/Cinema2StartersPreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

// Both default Auto Performance on; the harness sets the toggle explicitly for each side of the comparison.
const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'HUM:N', manifest: CINEMA2_HUMN_PRESET_MANIFEST, auto: 'hum-n-auto-performance', strength: 'hum-n-master-intensity',
    up: [['hum-n-emergence', 'facetFill']],
    // Nothing in HUM:N falls below its authored value with the music: its authority model leaves calm passages to the preset's own rules.
    down: [],
    shock: [['hum-n-emergence', 'facetFill'], ['hum-n-bloom', 'mix']],
    minLive: 2,
  },
  {
    name: 'Starters', manifest: CINEMA2_STARTERS_PRESET_MANIFEST, auto: 'starters-auto-performance', strength: 'starters-reactivity',
    up: [['starters-scene', 'centerLight'], ['starters-scene', 'ballWiggle'], ['starters-scene', 'glow'], ['starters-scene', 'ambientMotion']],
    down: [['starters-scene', 'centerLight'], ['starters-scene', 'intensity'], ['starters-scene', 'ambientMotion']],
    shock: [['starters-scene', 'glow'], ['starters-scene', 'centerLight'], ['starters-scene', 'ballWiggle']],
  },
]
describeMoodMigration('Batch 1B', CASES)
