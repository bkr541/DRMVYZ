import { describe, expect, it } from 'vitest'
import { GlassfallPatternSelection, sampleGlassfallAudio } from '../modules/glassfall/Cinema2GlassfallAudio'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
function frame(id: string | null, time = .1, paused = false): Cinema2ModuleFrameReadContext {
  return { transport: { sourcePresent: true, playing: !paused, paused, timeSec: time, trackId: 'track' }, audio: {
    upstream: { trackId: 'track', timeSec: time },
    rhythm: { beat: id ? { id, timeSec: time, strength: 1 } : null, beatIndex: { value: 8 }, fixedClocks: {} },
    bands: { bass: { available: true, value: .8 }, high: { available: false, value: 1 } },
    features: { overallEnergy: { available: true, value: .7 }, vocalPresence: { available: true, value: .4 }, buildProgress: { available: false, value: 1 } },
    structure: { semanticMoments: { available: true, value: [] } },
  } } as unknown as Cinema2ModuleFrameReadContext
}
describe('GLASSFALL shared audio and pattern authority', () => {
  it('takes available shared facts only and rejects another track', () => {
    const f = frame(null)
    expect(sampleGlassfallAudio(f)).toMatchObject({ energy: .7, bass: .8, high: 0, build: 0 })
    expect(sampleGlassfallAudio({ ...f, transport: { ...f.transport!, trackId: 'other' } }).energy).toBe(0)
  })
  it('advances once, preserves manual same-value edits, and resumes only on fresh events', () => {
    const c = new GlassfallPatternSelection()
    const update = (id: string | null, edit: number, reset = false, paused = false) => c.update(frame(id, .1, paused), 'glassfall', edit, true, 'beat', 0, reset)
    expect(update(null, 0, true)).toBe('glassfall')
    expect(update('one', 0)).toBe('cascade')
    expect(update('one', 0)).toBe('cascade')
    expect(update('one', 1)).toBe('glassfall')
    expect(update('one', 1)).toBe('glassfall')
    expect(update('two', 1)).toBe('cascade')
    expect(update('paused-hit', 2, false, true)).toBe('glassfall')
    expect(update('paused-hit', 2)).toBe('glassfall')
    expect(update('three', 2)).toBe('cascade')
  })
  it('does not advance while OFF or on initial activation with a held event', () => {
    const c = new GlassfallPatternSelection()
    expect(c.update(frame('held'), 'prismTrace', 0, true, 'beat', 0, true)).toBe('prismTrace')
    expect(c.update(frame('new'), 'prismTrace', 0, false, 'beat', 0, false)).toBe('prismTrace')
    expect(c.update(frame('new'), 'prismTrace', 0, true, 'beat', 0, false)).toBe('prismTrace')
  })
})
