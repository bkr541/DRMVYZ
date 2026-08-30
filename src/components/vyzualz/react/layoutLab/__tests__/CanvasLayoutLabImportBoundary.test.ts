import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'

const FILES = [
  '../CanvasMockup.tsx',
  '../CanvasRightRailMockup.tsx',
  '../useCanvasMockState.ts',
].map(relativePath => new URL(relativePath, import.meta.url))

const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
  ['React production store', /(?:from\s+['"][^'"]*reactStore['"]|useReactStore\s*\()/],
  ['media production store', /(?:from\s+['"][^'"]*mediaStore['"]|useMediaStore\s*\()/],
  ['shared audio runtime', /(?:useSharedAudio\s*\(|AudioFeatureBus\s*\(|MusicIntelligence)/],
  ['Canvas renderer', /(?:CanvasRenderer|CanvasEngineRuntime|CanvasPerformanceRuntime|CanvasFracturesRenderer)/],
  ['production recorder', /(?:new\s+MediaRecorder\s*\(|captureStream\s*\()/],
  ['object URL creation', /URL\.createObjectURL\s*\(/],
  ['animation frame loop', /requestAnimationFrame\s*\(/],
  ['worker construction', /new\s+Worker\s*\(/],
  ['production output controller', /(?:ProductionOutputController|useProductionOutput|outputAdapterController)/],
  ['persistence', /(?:localStorage\s*\.|indexedDB\s*\.|persist\s*\()/],
  ['network access', /(?:fetch\s*\(|new\s+WebSocket\s*\()/],
]

const REQUIRED_LABELS = [
  'Media Library',
  'Performance Pool',
  'CANVAS Source Link',
  'Auto Select',
  'Fit Mode',
  'Scale',
  'Position X',
  'Position Y',
  'Rotation',
  'Canvas Output Opacity',
  'Performance Orchestration',
  'Auto Performance',
  'Performance Show',
  'Auto Role',
  'Composition',
  'Layer Complexity',
  'Transition Density',
  'Effect Intensity',
  'Motion Intensity',
  'Cut Density',
  'Media Lock',
  'CANVAS React Controls',
  'Dry Source Mix',
  'Visual Intensity',
  'Bass Reactivity',
  'Beat Pulse',
  'Glow Amount',
  'Trail Amount',
  'RGB Split',
  'Glitch Amount',
  'Stutter Rate',
  'Luma Threshold',
  'Motion Amount',
  'Turbulence',
  'Particle Density',
  'Particle Size',
  'Particle Color Mode',
  'Particle Quality',
  'Fractures Controls',
  'Fracture Intensity',
  'Fracture Mode',
  'Anchor Mode',
  'Focus Protection',
  'Focus X',
  'Focus Y',
  'Placement Mode',
  'Topology Change',
  'Layout Change',
  'Variation Seed',
  'Quality',
  'Transition Speed',
  'Stagger',
  'Zoom',
  'Refracture',
  'Shuffle Layout',
  'Freeze Layout',
  'Return to Anchor',
  'Effects Intensity',
  'Color Treatment',
  'Color Source',
  'Manual Primary Color',
  'Manual Supporting Color',
  'Audio Response',
  'Bass Motion',
  'Transient Glitch',
  'Structural Response',
  'Video Timing',
  'Trigger On',
  'Clip Start Time',
  'Clip End Time',
  'Loop Clip Range',
  'Loop Full Video',
  'Restart on Drop',
  'Restart on Section Change',
  'Restart on Manual Preset Change',
  'Section Trigger Mapping',
  'Restart Clip',
  'Audio Routing',
  'Fractures recording is unavailable',
  'Recording unavailable',
]

describe('Canvas Layout Lab import boundary', () => {
  it('does not import or initialize production stores, media, renderers, audio, recording, output, or persistence', () => {
    const source = FILES.map(file => readFileSync(file, 'utf8')).join('\n')
    for (const [label, pattern] of FORBIDDEN_PATTERNS) {
      expect(source, label).not.toMatch(pattern)
    }
  })

  it('retains the required production-visible Canvas control and capability inventory', () => {
    const source = FILES.map(file => readFileSync(file, 'utf8')).join('\n')
    for (const label of REQUIRED_LABELS) expect(source, `Missing Canvas label: ${label}`).toContain(label)
    expect(CANVAS_VISIBLE_PRESETS.map(preset => preset.name)).toEqual([
      'Clean Playback',
      'Particle Aura',
      'Fractures',
      'Laser Image FX',
    ])
  })
})
