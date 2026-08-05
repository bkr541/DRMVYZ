import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FILES = [
  '../LaserDmxMockup.tsx',
  '../LaserDmxRightRailMockup.tsx',
  '../useLaserDmxMockState.ts',
].map(relativePath => new URL(relativePath, import.meta.url))

const PRODUCTION_SURFACES = [
  '../../LaserDmxBeamMatrixPanel.tsx',
  '../../LaserDmxReactionGroupInspector.tsx',
  '../../LaserDmxBeamInspector.tsx',
  '../../LaserDmxBeamMotionControls.tsx',
  '../../LaserDmxLaunchControls.tsx',
  '../../LaserDmxGroupSequencerControls.tsx',
  '../../LaserDmxShowDirectorControls.tsx',
  '../../LaserDmxShowDirectorInspector.tsx',
  '../../LaserDmxShowDirectorPalette.tsx',
  '../../output/ProductionOutputPanel.tsx',
].map(relativePath => new URL(relativePath, import.meta.url))

function staticControlLabels(source: string): string[] {
  return [...source.matchAll(/\blabel="([^"]+)"/g)].map(match => match[1])
}

const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
  ['React production store', /(?:from\s+['"][^'"]*reactStore['"]|useReactStore\s*\()/],
  ['media production store', /(?:from\s+['"][^'"]*mediaStore['"]|useMediaStore\s*\()/],
  ['shared audio runtime', /(?:useSharedAudio\s*\(|AudioFeatureBus\s*\()/],
  ['production output controller', /(?:ProductionOutputController|useProductionOutput|outputAdapterController)/],
  ['Show Director performance runtime', /(?:useLaserDmxShowDirectorPerformance|LaserDmxShowDirectorPerformanceRuntime)/],
  ['LaserDMX renderer', /<(?:LaserDmxCanvas|LaserDmxRenderer|LaserDmxShowDirectorStage)\b/],
  ['MediaRecorder construction', /new\s+MediaRecorder\s*\(/],
  ['canvas capture stream', /captureStream\s*\(/],
  ['object URL creation', /URL\.createObjectURL\s*\(/],
  ['animation frame loop', /requestAnimationFrame\s*\(/],
  ['worker construction', /new\s+Worker\s*\(/],
  ['network socket', /new\s+WebSocket\s*\(/],
  ['WebUSB access', /navigator\.usb\b/],
  ['WebSerial access', /navigator\.serial\b/],
  ['IndexedDB access', /indexedDB\s*\./],
  ['local-storage persistence', /localStorage\s*\./],
]

describe('LaserDMX Layout Lab import boundary', () => {
  it('does not import or initialize production stores, renderers, audio, recording, or output runtimes', () => {
    const source = FILES.map(file => readFileSync(file, 'utf8')).join('\n')
    for (const [label, pattern] of FORBIDDEN_PATTERNS) {
      expect(source, label).not.toMatch(pattern)
    }
  })

  it('retains the required mode, surface, fixture, route, and safety inventory', () => {
    const source = FILES.map(file => readFileSync(file, 'utf8')).join('\n')
    for (const required of [
      'MATRIX',
      'SHOW DIRECTOR',
      'Program',
      'Beam Matrix Design',
      'Reaction Groups',
      'Cue List',
      'Lighting Components',
      'Presentation & Renderer',
      'Beam Matrix Presets',
      'Show Director Performance Shows',
      'Show Director Rig Layouts',
      'React Master',
      'Performance Program',
      'Fixture Tools',
      'Show Director fixture inspector',
      'Show Director bulk fixture inspector',
      'Ordered scanner path points',
      'Routes for',
      'Global Matrix Routes',
      'Group Routes',
      'Beam Routes',
      'AUDIO INPUT AND TRANSPORT',
      'RECORDING',
      'PRODUCTION',
      'Production Output',
      'Emergency Blackout',
      'Clear Latch',
      'Laser',
      'Moving Head',
      'LED Bar',
      'LED Tube',
      'Strobe',
      'Blinder',
      'PAR Wash',
      'Video Wall',
      'Haze',
      'CO₂ Jet',
    ]) expect(source).toContain(required)
  })

  it('tracks every static production control label in the reachable LaserDMX surfaces', () => {
    const mockSource = FILES.map(file => readFileSync(file, 'utf8')).join('\n')
    const productionLabels = new Set(
      PRODUCTION_SURFACES.flatMap(file => staticControlLabels(readFileSync(file, 'utf8'))),
    )

    expect(productionLabels.size).toBeGreaterThan(150)
    for (const label of productionLabels) {
      expect(mockSource, `Missing production control label: ${label}`).toContain(`label="${label}"`)
    }
  })
})
