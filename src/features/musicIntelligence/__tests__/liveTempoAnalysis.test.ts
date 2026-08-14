import { describe, expect, it } from 'vitest'
import { LIVE_TEMPO_TUNING, LiveTempoAnalyzer, type LiveTempoState } from '../liveTempoAnalysis'

const FRAME_SEC = 0.02

interface RunOptions {
  startSec?: number
  durationSec: number
  bpm: number
  onsetEvery?: number
  skip?: (beatIndex: number) => boolean
}

function runRhythm(
  analyzer: LiveTempoAnalyzer,
  options: RunOptions,
): { state: LiveTempoState; beatEvents: LiveTempoState[] } {
  const startSec = options.startSec ?? 0
  const periodSec = 60 / options.bpm
  const onsetEvery = Math.max(1, options.onsetEvery ?? 1)
  const firstOnset = startSec + 0.2
  const endSec = startSec + options.durationSec
  let nextOnset = firstOnset
  let beatIndex = 0
  let state: LiveTempoState = {
    bpm: 0,
    bpmConfidence: 0,
    beatAvailable: false,
    beatPhase: 0,
    beatHit: false,
    beatIndex: 0,
    beatEventId: null,
    beatEventTimeSec: null,
  }
  const beatEvents: LiveTempoState[] = []

  for (let time = startSec; time <= endSec + 1e-9; time += FRAME_SEC) {
    let onsetHit = false
    while (time + FRAME_SEC * 0.5 >= nextOnset && nextOnset <= endSec + 1e-9) {
      if (beatIndex % onsetEvery === 0 && !options.skip?.(beatIndex)) onsetHit = true
      beatIndex++
      nextOnset = firstOnset + beatIndex * periodSec
    }
    state = analyzer.update({ audioTime: time, onsetHit, onsetStrength: onsetHit ? 1 : 0, isPlaying: true })
    if (state.beatHit) beatEvents.push({ ...state })
  }

  return { state, beatEvents }
}

function advanceSilence(analyzer: LiveTempoAnalyzer, startSec: number, durationSec: number): LiveTempoState {
  let state = analyzer.update({ audioTime: startSec, onsetHit: false, onsetStrength: 0, isPlaying: true })
  for (let time = startSec + FRAME_SEC; time <= startSec + durationSec + 1e-9; time += FRAME_SEC) {
    state = analyzer.update({ audioTime: time, onsetHit: false, onsetStrength: 0, isPlaying: true })
  }
  return state
}

describe('LiveTempoAnalyzer', () => {
  for (const bpm of [80, 100, 120, 128, 140, 150]) {
    it(`converges on a controlled ${bpm} BPM onset stream`, () => {
      const analyzer = new LiveTempoAnalyzer()
      const period = 60 / bpm
      const result = runRhythm(analyzer, { bpm, durationSec: period * 12 + 0.25 })

      expect(result.state.bpm).toBeCloseTo(bpm, 0)
      expect(result.state.bpmConfidence).toBeGreaterThan(0.55)
      expect(result.state.beatAvailable).toBe(true)
    })
  }

  it('normalizes dense subdivisions and missing beats without half/double-time oscillation', () => {
    const dense = new LiveTempoAnalyzer()
    const denseResult = runRhythm(dense, { bpm: 120, onsetEvery: 1, durationSec: 7 })
    expect(denseResult.state.bpm).toBeCloseTo(120, 0)

    const subdivisions = new LiveTempoAnalyzer()
    const subdivisionResult = runRhythm(subdivisions, { bpm: 240, durationSec: 7 })
    expect(subdivisionResult.state.bpm).toBeCloseTo(120, 0)

    const missing = new LiveTempoAnalyzer()
    const missingResult = runRhythm(missing, {
      bpm: 120,
      durationSec: 9,
      skip: beatIndex => beatIndex > 0 && beatIndex % 4 === 0,
    })
    expect(missingResult.state.bpm).toBeCloseTo(120, 0)
    expect(missingResult.state.bpmConfidence).toBeGreaterThan(0.4)
  })

  it('re-locks after octave tempo steps in both directions instead of remaining stale', () => {
    const up = new LiveTempoAnalyzer()
    const firstUp = runRhythm(up, { bpm: 70, durationSec: 8 })
    expect(firstUp.state.bpm).toBeCloseTo(70, 0)
    const secondUp = runRhythm(up, { bpm: 140, startSec: 8 + FRAME_SEC, durationSec: 8 })
    expect(secondUp.state.bpm).toBeCloseTo(140, 0)

    const down = new LiveTempoAnalyzer()
    const firstDown = runRhythm(down, { bpm: 140, durationSec: 8 })
    expect(firstDown.state.bpm).toBeCloseTo(140, 0)
    const secondDown = runRhythm(down, { bpm: 70, startSec: 8 + FRAME_SEC, durationSec: 10 })
    expect(secondDown.state.bpm).toBeCloseTo(70, 0)
  })

  it('degrades confidence to unavailable after sustained silence instead of fabricating a fallback BPM', () => {
    const analyzer = new LiveTempoAnalyzer()
    const locked = runRhythm(analyzer, { bpm: 128, durationSec: 7 })
    expect(locked.state.bpm).toBeCloseTo(128, 0)
    expect(locked.state.beatAvailable).toBe(true)

    const silent = advanceSilence(analyzer, 7 + FRAME_SEC, 5)
    expect(silent.bpm).toBe(0)
    expect(silent.bpmConfidence).toBe(0)
    expect(silent.beatAvailable).toBe(false)
  })

  it('emits monotonic, deduplicatable beat identities with boundary timestamps', () => {
    const analyzer = new LiveTempoAnalyzer()
    const { beatEvents } = runRhythm(analyzer, { bpm: 128, durationSec: 9 })

    expect(beatEvents.length).toBeGreaterThan(6)
    for (let index = 1; index < beatEvents.length; index++) {
      expect(beatEvents[index].beatEventId).toBeGreaterThan(beatEvents[index - 1].beatEventId ?? -1)
      expect(beatEvents[index].beatEventTimeSec).toBeGreaterThan(beatEvents[index - 1].beatEventTimeSec ?? -1)
    }
    expect(new Set(beatEvents.map(event => event.beatEventId)).size).toBe(beatEvents.length)
  })

  it('keeps runtime onset history bounded during long-running input and clears it on reset', () => {
    const analyzer = new LiveTempoAnalyzer()
    runRhythm(analyzer, { bpm: 150, durationSec: 60 })

    expect(analyzer.diagnostics.onsetHistoryLength).toBeLessThanOrEqual(LIVE_TEMPO_TUNING.onsetHistorySize)
    analyzer.reset()
    expect(analyzer.diagnostics).toMatchObject({
      onsetHistoryLength: 0,
      acceptedBpm: 0,
      acceptedConfidence: 0,
      alternateConfirmationCount: 0,
    })
  })
})
