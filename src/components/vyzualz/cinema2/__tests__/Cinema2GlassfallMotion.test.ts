import { describe, it, expect } from 'vitest'
import { GlassfallTimeline, GLASSFALL_DEFAULT_CONTROLS as defaults, GLASSFALL_PATTERNS, glassfallIllumination, glassfallModulo } from '../modules/glassfall/Cinema2GlassfallMotion'
import { glassfallCells } from '../modules/glassfall/Cinema2GlassfallGeometry'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
const frame = (bpm: number) => ({ transport: { sourcePresent: true, bpm } }) as unknown as Cinema2ModuleFrameReadContext

describe('GLASSFALL manual motion', () => {
  it('locks to shared BPM and has a deliberate independent seconds rate when OFF', () => {
    const sync = new GlassfallTimeline(), free = new GlassfallTimeline()
    const a = sync.update(frame(60), 2, defaults, true)
    const b = free.update(frame(60), 2, { ...defaults, sync: false }, true)
    expect(b.travel).toBeCloseTo(a.travel * 2); expect(b.score).toBeCloseTo(a.score * 2)
  })
  it('preserves the current pose on timing edits, stops at zero and reconstructs after seek', () => {
    const timeline = new GlassfallTimeline()
    const before = timeline.update(frame(90), 2, defaults, true)
    const edit = { ...defaults, sync: false, speed: 0, sequenceSpeed: 0 }
    expect(timeline.update(frame(90), 2, edit, false)).toEqual(before)
    expect(timeline.update(frame(90), 8, edit, false)).toEqual(before)
    expect(timeline.update(frame(90), 1, defaults, true)).toEqual(new GlassfallTimeline().update(frame(90), 1, defaults, true))
  })
  it('keeps six complete triangle bands through the recycling span', () => {
    const cells = glassfallCells(16 / 9, true)
    const bands = [...new Set(cells.filter(cell => !cell.inverted).map(cell => cell.y))]
    expect(bands).toHaveLength(6)
    expect(glassfallModulo(-3.3 - .0001 + 3.3, 6.6) - 3.3).toBeCloseTo(3.3 - .0001)
  })
  it('provides six distinct native lighting programs on unchanged cell coordinates', () => {
    const samples = GLASSFALL_PATTERNS.map(pattern => [0, 1, 2, 3].map(i => glassfallIllumination(pattern, i * 1.04, i * 1.1, i % 2 === 0, 1.7)))
    for (let i = 0; i < samples.length; i++) for (let j = 0; j < i; j++) expect(samples[i]).not.toEqual(samples[j])
  })
})
