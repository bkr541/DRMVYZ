import { CINEMA2_BLOCKSHIFT_PRESET_MANIFEST } from '../presets/Cinema2BlockshiftPreset'
import { CINEMA2_SAY_IT_PRESET_MANIFEST } from '../presets/Cinema2SayItPreset'
import { CINEMA2_SIXFOLD_PRESET_MANIFEST } from '../presets/Cinema2SixfoldPreset'
import { CINEMA2_TRIPPY_BRO_PRESET_MANIFEST } from '../presets/Cinema2TrippyBroPreset'
import { describeMoodMigration, type MoodMigrationCase } from './support/describeMoodMigration'

// Every Batch 3B preset has Pattern Change and a Trigger, so the music chooses both while Auto Performance is on.
const CASES: readonly MoodMigrationCase[] = [
  {
    name: 'Say It', manifest: CINEMA2_SAY_IT_PRESET_MANIFEST, auto: 'say-it-auto-performance', strength: 'say-it-motion',
    pattern: { patternChange: 'say-it-pattern-change', trigger: 'say-it-trigger' },
    up: [['say-it-glyphs', 'spread'], ['say-it-glyphs', 'environmentIntensity'], ['say-it-glyphs', 'highlightSweep'], ['say-it-glyphs', 'glyphDelay'], ['say-it-bloom-effect', 'intensity']],
    // Nothing falls below its authored value in a calm passage: Cycle Length goes the other way (it gets longer), which a "below" check does not cover.
    down: [],
    shock: [['say-it-glyphs', 'spread'], ['say-it-glyphs', 'environmentIntensity'], ['say-it-glyphs', 'highlightSweep'], ['say-it-bloom-effect', 'intensity']],
  },
  {
    name: 'Sixfold', manifest: CINEMA2_SIXFOLD_PRESET_MANIFEST, auto: 'sixfold-auto-performance', strength: 'sixfold-reactivity',
    pattern: { patternChange: 'sixfold-pattern-change', trigger: 'sixfold-trigger' },
    up: [['sixfold-system', 'intensity'], ['sixfold-system', 'spread'], ['sixfold-system', 'burst'], ['sixfold-system', 'drift'], ['sixfold-system', 'spin'], ['sixfold-system', 'edgeGlow'], ['sixfold-bloom', 'intensity']],
    down: [['sixfold-system', 'intensity'], ['sixfold-system', 'spin'], ['sixfold-system', 'nodeDensity']],
    shock: [['sixfold-system', 'intensity'], ['sixfold-system', 'burst'], ['sixfold-system', 'edgeGlow'], ['sixfold-bloom', 'intensity']],
  },
  {
    name: 'Blockshift', manifest: CINEMA2_BLOCKSHIFT_PRESET_MANIFEST, auto: 'blockshift-auto-performance', strength: 'blockshift-audio-reactivity',
    pattern: { patternChange: 'blockshift-pattern-change', trigger: 'blockshift-trigger' },
    up: [['blockshift-sculpture', 'masterIntensity'], ['blockshift-sculpture', 'motionAmount'], ['blockshift-sculpture', 'motionRate'], ['blockshift-bloom', 'intensity']],
    down: [['blockshift-sculpture', 'masterIntensity'], ['blockshift-sculpture', 'motionAmount'], ['blockshift-sculpture', 'motionRate']],
    shock: [['blockshift-sculpture', 'masterIntensity'], ['blockshift-bloom', 'intensity']],
  },
  {
    name: 'Trippy, Bro', manifest: CINEMA2_TRIPPY_BRO_PRESET_MANIFEST, auto: 'trippy-bro-auto-performance', strength: 'trippy-bro-reactivity',
    pattern: { patternChange: 'trippy-bro-pattern-change', trigger: 'trippy-bro-trigger' },
    up: [['trippy-bro-system', 'speed'], ['trippy-bro-system', 'amount'], ['trippy-bro-system', 'detail'], ['trippy-bro-system', 'echo'], ['trippy-bro-bloom', 'mix']],
    down: [['trippy-bro-system', 'intensity'], ['trippy-bro-system', 'speed'], ['trippy-bro-system', 'amount']],
    shock: [['trippy-bro-system', 'width'], ['trippy-bro-system', 'split'], ['trippy-bro-system', 'echo'], ['trippy-bro-bloom', 'mix']],
  },
]
describeMoodMigration('Batch 3B', CASES)
