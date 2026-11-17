import { CINEMA2_EVENT_HORIZON_PRESET_MANIFEST } from '../presets/Cinema2EventHorizonPreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

// Event Horizon defaults Auto Performance on; the harness sets the toggle explicitly for each side of the comparison.
const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'Event Horizon', manifest: CINEMA2_EVENT_HORIZON_PRESET_MANIFEST, auto: 'event-horizon-auto-performance', strength: 'event-horizon-reactivity',
    pattern: { patternChange: 'event-horizon-pattern-change', trigger: 'event-horizon-trigger' },
    up: [['event-horizon-system', 'intensity'], ['event-horizon-system', 'rotationSpeed'], ['event-horizon-system', 'starDensity'], ['event-horizon-system', 'diskThickness'], ['event-horizon-bloom', 'intensity']],
    down: [['event-horizon-system', 'intensity'], ['event-horizon-system', 'lensing'], ['event-horizon-system', 'rotationSpeed']],
    shock: [['event-horizon-system', 'intensity'], ['event-horizon-system', 'lensing'], ['event-horizon-bloom', 'intensity']],
  },
]
describeMoodMigration('Event Horizon', CASES)
