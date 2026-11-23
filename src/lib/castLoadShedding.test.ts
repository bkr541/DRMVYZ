import { describe, expect, it } from 'vitest'
import { CAST_FULL_FPS, CAST_SHED_FPS, CastLoadShedder, bindCadenceToPressure } from './castLoadShedding'
import { FrameCadence } from './frameCadence'
import { resetPerformancePressureForTests, setPerformancePressure } from './performancePressure'

const live = (fps: number | null) => ({ fps, connected: true, visible: true })

describe('cast load shedding', () => {
  it('stays at level 0 while the stream keeps up', () => {
    const shedder = new CastLoadShedder()
    for (const fps of [60, 59, 58, 60, 57, 60]) expect(shedder.observe(live(fps))).toMatchObject({ level: 0, targetFps: CAST_FULL_FPS, changed: false })
  })

  it('needs two poor samples in a row before it steps up, and one good sample resets the count', () => {
    const shedder = new CastLoadShedder()
    expect(shedder.observe(live(40)).level).toBe(0)
    expect(shedder.observe(live(60)).level).toBe(0)
    expect(shedder.observe(live(40)).level).toBe(0)
    expect(shedder.observe(live(40))).toMatchObject({ level: 1, changed: true, targetFps: CAST_FULL_FPS })
  })

  it('goes straight to severe when the stream collapses, as it did to 2 fps before the GPU process died', () => {
    const shedder = new CastLoadShedder()
    expect(shedder.observe(live(49)).level).toBe(0)
    expect(shedder.observe(live(32)).level).toBe(0)
    // A poor sample followed by a collapse is already two bad samples in a row: step up to 1 at once, then to 2 once the collapse repeats.
    expect(shedder.observe(live(2))).toMatchObject({ level: 1, changed: true })
    expect(shedder.observe(live(2)).level).toBe(1)
    expect(shedder.observe(live(2))).toMatchObject({ level: 2, changed: true, targetFps: CAST_SHED_FPS })
  })

  it('judges the stream against the rate it is now asked for, so a healthy 30 fps at level 2 does not escalate', () => {
    const shedder = new CastLoadShedder()
    shedder.observe(live(5)); shedder.observe(live(5))
    expect(shedder.targetFps).toBe(CAST_SHED_FPS)
    for (let i = 0; i < 3; i++) expect(shedder.observe(live(30)).level).toBe(2)
    expect(shedder.observe(live(30)).level).toBe(1)
  })

  it('comes down one step at a time, only after four healthy samples', () => {
    const shedder = new CastLoadShedder()
    shedder.observe(live(5)); shedder.observe(live(5))
    for (let i = 0; i < 3; i++) shedder.observe(live(30))
    expect(shedder.observe(live(30)).level).toBe(1)
    for (let i = 0; i < 3; i++) expect(shedder.observe(live(60)).level).toBe(1)
    expect(shedder.observe(live(60))).toMatchObject({ level: 0, changed: true })
  })

  it('ignores a hidden window and unknown readings, and clears everything when the cast ends', () => {
    const shedder = new CastLoadShedder()
    shedder.observe(live(5)); shedder.observe(live(5))
    expect(shedder.observe({ fps: 1, connected: true, visible: false })).toMatchObject({ level: 2, changed: false })
    expect(shedder.observe(live(null))).toMatchObject({ level: 2, changed: false })
    expect(shedder.observe(live(0))).toMatchObject({ level: 2, changed: false })
    expect(shedder.observe({ fps: 60, connected: false, visible: true })).toMatchObject({ level: 0, changed: true, targetFps: CAST_FULL_FPS })
  })

  it('halves a relay\'s frame cadence live at severe pressure from any source, and restores it afterwards', () => {
    resetPerformancePressureForTests()
    const cadence = new FrameCadence(CAST_FULL_FPS)
    const stop = bindCadenceToPressure(cadence, CAST_FULL_FPS)
    const framesInOneSecond = (from: number) => { let count = 0; for (let t = from; t < from + 1000; t += 1000 / 240) if (cadence.due(t)) count++; return count }
    try {
      expect(framesInOneSecond(0)).toBeGreaterThan(55)
      setPerformancePressure('gpu', 1)   // elevated: render quality sheds, the relay keeps its rate
      expect(framesInOneSecond(1000)).toBeGreaterThan(55)
      setPerformancePressure('gpu', 2)
      const shed = framesInOneSecond(2000)
      expect(shed).toBeGreaterThanOrEqual(28); expect(shed).toBeLessThanOrEqual(31)
      setPerformancePressure('gpu', 0)
      expect(framesInOneSecond(3000)).toBeGreaterThan(55)
    } finally { stop(); resetPerformancePressureForTests() }
  })
})
