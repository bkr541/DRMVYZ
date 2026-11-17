import { CINEMA2_GLASSFALL_PRESET_MANIFEST } from '../presets/Cinema2GlassfallPreset'
import { CINEMA2_MARQUEE_PRESET_MANIFEST } from '../presets/Cinema2MarqueePreset'
import { CINEMA2_VACANCY_PRESET_MANIFEST } from '../presets/Cinema2VacancyPreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

// Every Batch 4B preset has Pattern Change and a Trigger, so the music chooses both while Auto Performance is on.
const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'Glassfall', manifest: CINEMA2_GLASSFALL_PRESET_MANIFEST, auto: 'glassfall-auto-performance', strength: 'glassfall-response',
    pattern: { patternChange: 'glassfall-pattern-change', trigger: 'glassfall-trigger' },
    up: [['glassfall-field', 'speed'], ['glassfall-field', 'sequenceSpeed'], ['glassfall-field', 'relief']],
    // Master Intensity is already at its maximum by default, so it only comes down.
    down: [['glassfall-field', 'speed'], ['glassfall-field', 'sequenceSpeed'], ['glassfall-field', 'intensity']],
    shock: [['glassfall-field', 'relief']],
    minLive: 3,
  },
  {
    name: 'Vacancy', manifest: CINEMA2_VACANCY_PRESET_MANIFEST, auto: 'vacancy-auto-performance', strength: 'vacancy-music-response',
    pattern: { patternChange: 'vacancy-pattern-change', trigger: 'vacancy-trigger' },
    up: [['vacancy-core', 'master'], ['vacancy-core', 'bassRattle'], ['vacancy-core', 'roomVisibility'], ['vacancy-bloom-effect', 'mix']],
    down: [['vacancy-core', 'master'], ['vacancy-core', 'screensLit']],
    shock: [['vacancy-core', 'master'], ['vacancy-core', 'bassRattle'], ['vacancy-core', 'roomVisibility'], ['vacancy-bloom-effect', 'mix']],
  },
  {
    name: 'Marquee', manifest: CINEMA2_MARQUEE_PRESET_MANIFEST, auto: 'marquee-auto-performance', strength: 'marquee-master-intensity',
    pattern: { patternChange: 'marquee-pattern-change', trigger: 'marquee-trigger' },
    up: [['marquee-theater', 'sideIntensity'], ['marquee-theater', 'canopyIntensity'], ['marquee-theater', 'towerIntensity'], ['marquee-theater', 'entranceIntensity'], ['marquee-theater', 'neonIntensity'], ['marquee-bloom', 'intensity']],
    down: [['marquee-theater', 'masterIntensity'], ['marquee-theater', 'frontIntensity']],
    shock: [['marquee-theater', 'canopyIntensity'], ['marquee-theater', 'towerIntensity'], ['marquee-theater', 'entranceIntensity'], ['marquee-bloom', 'intensity']],
  },
]
describeMoodMigration('Batch 4B', CASES)
