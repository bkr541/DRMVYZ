import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FILES = [
  '../PixGridMockup.tsx',
  '../PixGridRightRailMockup.tsx',
  '../usePixGridMockState.ts',
].map(relativePath => new URL(relativePath, import.meta.url))

const PRODUCTION_SURFACES = [
  '../../pixGrid/PixGridDesignPanel.tsx',
  '../../pixGrid/PixGridReactivityWorkspace.tsx',
].map(relativePath => new URL(relativePath, import.meta.url))

function staticControlLabels(source: string): string[] {
  return [...source.matchAll(/\blabel="([^"]+)"/g)].map(match => match[1])
}

const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
  ['React production store', /(?:from\s+['"][^'"]*reactStore['"]|useReactStore\s*\()/],
  ['media production store', /(?:from\s+['"][^'"]*mediaStore['"]|useMediaStore\s*\()/],
  ['shared audio runtime', /(?:useSharedAudio\s*\(|AudioFeatureBus\s*\()/],
  ['PixGrid editor overlay', /<PixGridEditorOverlay\b/],
  ['PixGrid renderer surface', /<(?:PixGridSurface|PixGridLiveCanvas)\b/],
  ['MediaRecorder construction', /new\s+MediaRecorder\s*\(/],
  ['object URL creation', /URL\.createObjectURL\s*\(/],
  ['animation frame loop', /requestAnimationFrame\s*\(/],
  ['worker construction', /new\s+Worker\s*\(/],
  ['IndexedDB access', /indexedDB\s*\./],
  ['local-storage persistence', /localStorage\s*\./],
]

describe('PixGrid Layout Lab import boundary', () => {
  it('does not import or initialize production stores and runtimes', () => {
    const source = FILES.map(file => readFileSync(file, 'utf8')).join('\n')
    for (const [label, pattern] of FORBIDDEN_PATTERNS) {
      expect(source, label).not.toMatch(pattern)
    }
  })

  it('retains the required production-facing control inventory', () => {
    const source = FILES.map(file => readFileSync(file, 'utf8')).join('\n')
    for (const required of [
      'PixGrid Image & SVG Media',
      'PixGrid accepts still images and SVGs, not video.',
      'Current Engine',
      'SCENES',
      'LAYERS',
      'BUILT-INS',
      'Editing Context',
      'Grid Presentation',
      'Scene Pixels',
      'ROUTING',
      'EVENTS',
      'CHOREOGRAPHY',
      'ANALYSIS',
      'PERFORMANCE PROGRAM',
      'SECTION PLAN CONTROLS',
      'Phrase Segment',
      'Auto Performance Only',
      'Active Layer',
      'Active Group',
      'AUDIO INPUT AND TRANSPORT',
      'RUNTIME DIAGNOSTICS',
      'RECORDING',
      'PRODUCTION',
    ]) expect(source).toContain(required)
  })

  it('tracks every static production DESIGN and REACT control label', () => {
    const mockSource = FILES.map(file => readFileSync(file, 'utf8')).join('\n')
    const productionLabels = new Set(
      PRODUCTION_SURFACES.flatMap(file => staticControlLabels(readFileSync(file, 'utf8'))),
    )

    expect(productionLabels.size).toBeGreaterThan(0)
    for (const label of productionLabels) {
      expect(mockSource, `Missing production control label: ${label}`).toContain(`label="${label}"`)
    }
  })
})
