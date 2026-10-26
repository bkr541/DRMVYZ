import type { LyricCue, LyricWord } from '../../../../types/lyrics'
import { LAB_WAVEFORM } from './layoutLabWaveformFixture'
import { TM_BEAT_GRID, TM_DURATION_SEC, TM_PLAYHEAD_SEC } from './layoutLabTrackMapFixture'

// Placeholder data for Layout Lab's Lyric Manager Track Timeline: the same 119 s track as the Track Map beside it (same
// beat grid, same sections, same waveform), plus lyric cues chosen so every state the lyric lanes can draw is present:
// a playing cue, a selected cue, a low-confidence cue, an empty cue, an unmarked overlap and a word that runs past its cue
// (warnings), every review status, cues with word timings (and one without), intentional ad-lib overlaps that stack a
// third lane and push one block past the visible lanes, and plain cues. A cue is faded only by the cue list's filter.

export const LT_DURATION_MS = Math.round(TM_DURATION_SEC * 1000)
export const LT_PLAYHEAD_MS = Math.round(TM_PLAYHEAD_SEC * 1000)
export const LT_SELECTED_CUE_ID = 'lt-cue-06'

/** The track's peaks, folded from the dock waveform's 4096 bins into the single 0–1 series the lyric lanes draw. */
export const LT_WAVEFORM_PEAKS: number[] = Array.from(LAB_WAVEFORM.positivePeaks, (positive, index) =>
  Math.max(positive, -(LAB_WAVEFORM.negativePeaks[index] ?? 0)),
)

export const LT_BEAT_GRID = TM_BEAT_GRID

/** The editor's snap context: beat snapping on the imported grid, with the editor's own millisecond and frame grids. */
export const LT_SNAP_CONTEXT = {
  mode: 'beat' as const,
  beatGridMs: TM_BEAT_GRID.map(beat => beat.timeSec * 1000),
  wordBoundaryMs: [] as number[],
  millisecondGridMs: 10,
  frameRate: 30,
}

/** Evenly spaced word timings inside a cue, with the confidences given. */
function words(cueId: string, startMs: number, endMs: number, texts: string[], confidences: number[]): LyricWord[] {
  const step = (endMs - startMs) / texts.length
  return texts.map((text, index) => ({
    id: `${cueId}-w${index + 1}`,
    text,
    startMs: Math.round(startMs + index * step),
    endMs: Math.round(startMs + (index + 1) * step) - 40,
    confidence: confidences[index],
    source: 'transcription' as const,
  }))
}

const adlib = { vocalRole: 'adlib', intentionalOverlap: true } as const

export const LT_CUES: LyricCue[] = [
  { id: 'lt-cue-01', startMs: 3200, endMs: 7400, text: 'Hold the line', confidence: 0.94, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-02', startMs: 8000, endMs: 12100, text: 'Feel it in the low end', words: words('lt-cue-02', 8000, 12100, ['Feel','it','in','the','low','end'], [0.93, 0.95, 0.9, 0.92, 0.88, 0.94]), confidence: 0.91, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-03', startMs: 12400, endMs: 16800, text: 'Rising with the light', words: words('lt-cue-03', 12400, 16800, ['Rising','with','the','light'], [0.9, 0.86, 0.84, 0.92]), confidence: 0.88, source: 'transcription', reviewStatus: 'unreviewed' },
  { id: 'lt-cue-04', startMs: 17200, endMs: 21500, text: 'Hold on to the sound', confidence: 0.9, source: 'import', reviewStatus: 'reviewed' },
  { id: 'lt-cue-05', startMs: 22000, endMs: 24400, text: 'Here it comes', confidence: 0.83, source: 'manual', reviewStatus: 'corrected' },
  { id: 'lt-cue-06', startMs: 25000, endMs: 31000, text: 'Obsessed with the fall', words: words('lt-cue-06', 25000, 31000, ['Obsessed','with','the','fall'], [0.97, 0.95, 0.93, 0.96]), confidence: 0.95, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-07', startMs: 31500, endMs: 36500, text: 'Chasing every echo', words: words('lt-cue-07', 31500, 36500, ['Chasing','every','echo'], [0.82, 0.41, 0.63]).map((word, index, all) => index === all.length - 1 ? { ...word, endMs: 37200 } : word), confidence: 0.58, source: 'transcription', reviewStatus: 'unreviewed', warnings: ['low_confidence'] },
  { id: 'lt-cue-08', startMs: 33000, endMs: 35500, text: '(echo)', confidence: 0.77, source: 'transcription', analysisMetadata: adlib },
  { id: 'lt-cue-09', startMs: 37000, endMs: 41200, text: 'Static in the sky', confidence: 0.92, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-10', startMs: 41800, endMs: 46000, text: 'Break the silence now', confidence: 0.9, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-11', startMs: 46500, endMs: 50500, text: '', confidence: 0.81, source: 'transcription', reviewStatus: 'unreviewed' },
  { id: 'lt-cue-12', startMs: 51000, endMs: 55600, text: 'Drifting out again', words: words('lt-cue-12', 51000, 55600, ['Drifting','out','again'], [0.9, 0.85, 0.88]), confidence: 0.87, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-13', startMs: 57000, endMs: 62000, text: 'Fading into blue', confidence: 0.86, source: 'transcription', reviewStatus: 'unreviewed' },
  { id: 'lt-cue-14', startMs: 60500, endMs: 65000, text: 'Fading into blue, fading', confidence: 0.8, source: 'transcription', reviewStatus: 'unreviewed' },
  { id: 'lt-cue-15', startMs: 66000, endMs: 69500, text: 'Silence', confidence: 0.78, source: 'manual', reviewStatus: 'rejected' },
  { id: 'lt-cue-16', startMs: 72000, endMs: 77500, text: 'Back from the dark', confidence: 0.89, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-17', startMs: 78000, endMs: 84000, text: 'Higher and higher', confidence: 0.93, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-18', startMs: 90500, endMs: 95000, text: 'Obsessed with the fall', words: words('lt-cue-18', 90500, 95000, ['Obsessed','with','the','fall'], [0.94, 0.92, 0.93, 0.95]), confidence: 0.93, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-19', startMs: 90800, endMs: 94800, text: 'ooh', confidence: 0.72, source: 'transcription', analysisMetadata: adlib },
  { id: 'lt-cue-20', startMs: 91500, endMs: 93500, text: 'yeah', confidence: 0.71, source: 'transcription', analysisMetadata: adlib },
  { id: 'lt-cue-21', startMs: 92000, endMs: 94000, text: 'hey', confidence: 0.74, source: 'transcription', analysisMetadata: adlib },
  { id: 'lt-cue-22', startMs: 96000, endMs: 101000, text: 'Chasing every echo', confidence: 0.91, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-23', startMs: 102000, endMs: 108000, text: 'Carry me home', confidence: 0.9, source: 'transcription', reviewStatus: 'reviewed' },
  { id: 'lt-cue-24', startMs: 111000, endMs: 116500, text: 'Until the light goes', confidence: 0.88, source: 'transcription', reviewStatus: 'reviewed' },
]
