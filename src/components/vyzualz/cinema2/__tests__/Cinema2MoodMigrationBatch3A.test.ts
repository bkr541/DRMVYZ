import { CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST } from '../presets/Cinema2AncientMachinePreset'
import { CINEMA2_CATHEDRAL_PRESET_MANIFEST } from '../presets/Cinema2CathedralPreset'
import { CINEMA2_CONSTELLATION_PRESET_MANIFEST } from '../presets/Cinema2ConstellationPreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

// All three default Auto Performance on and have Pattern Change and a Trigger; the music chooses both while it is on. (Event Horizon, the fourth
// Batch 3A preset, was migrated with its galaxy upgrade and is checked in Cinema2MoodMigrationEventHorizon.test.ts.)
const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'Ancient Machine', manifest: CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST, auto: 'ancient-machine-auto-performance', strength: 'ancient-machine-reactivity',
    pattern: { patternChange: 'ancient-machine-pattern-change', trigger: 'ancient-machine-trigger' },
    up: [['ancient-machine-mechanism', 'intensity'], ['ancient-machine-mechanism', 'rotationSpeed'], ['ancient-machine-mechanism', 'counterRotation'], ['ancient-machine-mechanism', 'mechanicalDepth'], ['ancient-machine-mechanism', 'aperture'], ['ancient-machine-bloom', 'intensity']],
    down: [['ancient-machine-mechanism', 'intensity'], ['ancient-machine-mechanism', 'rotationSpeed']],
    shock: [['ancient-machine-mechanism', 'intensity'], ['ancient-machine-mechanism', 'aperture'], ['ancient-machine-bloom', 'intensity']],
  },
  {
    name: 'Cathedral', manifest: CINEMA2_CATHEDRAL_PRESET_MANIFEST, auto: 'cathedral-auto-performance', strength: 'cathedral-reactivity',
    pattern: { patternChange: 'cathedral-pattern-change', trigger: 'cathedral-trigger' },
    up: [['cathedral-aisle', 'intensity'], ['cathedral-aisle', 'activeDensity'], ['cathedral-aisle', 'expansion'], ['cathedral-aisle', 'sparkDensity'], ['cathedral-atmosphere-effect', 'beamIntensity'], ['cathedral-bloom-effect', 'intensity']],
    down: [['cathedral-aisle', 'intensity'], ['cathedral-aisle', 'activeDensity'], ['cathedral-aisle', 'sparkDensity']],
    shock: [['cathedral-aisle', 'intensity'], ['cathedral-aisle', 'expansion'], ['cathedral-atmosphere-effect', 'beamIntensity'], ['cathedral-bloom-effect', 'intensity']],
  },
  {
    name: 'Constellation', manifest: CINEMA2_CONSTELLATION_PRESET_MANIFEST, auto: 'constellation-auto-performance', strength: 'constellation-reactivity',
    pattern: { patternChange: 'constellation-pattern-change', trigger: 'constellation-trigger' },
    up: [['constellation-system', 'intensity'], ['constellation-system', 'spread'], ['constellation-system', 'burst'], ['constellation-system', 'drift'], ['constellation-system', 'spin'], ['constellation-system', 'edgeGlow'], ['constellation-bloom', 'intensity']],
    down: [['constellation-system', 'intensity'], ['constellation-system', 'spin'], ['constellation-system', 'nodeDensity']],
    shock: [['constellation-system', 'intensity'], ['constellation-system', 'burst'], ['constellation-system', 'edgeGlow'], ['constellation-bloom', 'intensity']],
  },
]
describeMoodMigration('Batch 3A', CASES)
