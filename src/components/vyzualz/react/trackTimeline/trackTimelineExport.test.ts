import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { RgbWaveformAnalysis } from '../../../../features/waveform/rgbWaveformTypes'
import type { AudioEngine } from '../../../../hooks/useAudioEngine'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../../../../types'
import { downloadBlob } from '../../../../utils/wavExport'
import { createTrackTimelineArchive, downloadTrackTimelineExport } from './trackTimelineExport'
import { captureTrackTimelineExport } from './trackTimelineExportData'
import { buildTrackTimelineModel } from './trackTimelineModel'

vi.mock('../../../../stores/reactStore', () => ({ useReactStore: { getState: () => ({
  manualTrackSectionsByTrackId: {}, suppressedAutoSectionsByTrackId: {}, presetAutomationCuesByTrackId: {}, pixGridActionCuesByTrackId: {},
}) } }))
vi.mock('../../../../stores/visualStore', () => ({ useVisualStore: { getState: () => ({
  cueMarkers: [{ id: 'own-cue', time: 2, trackId: 'track-1' }, { id: 'other-cue', time: 4, trackId: 'other-track' }],
}) } }))
vi.mock('../../../../utils/wavExport', () => ({ downloadBlob: vi.fn() }))

function snapshot() {
  const beat = { timeSec: 0.25, confidence: 0.8, isDownbeat: true }
  const section = { id: 's1', label: 'Intro', type: 'intro' as const, startSec: 0, endSec: 6, intensity: 0.4, confidence: 0.5 }
  const source: TrackIntelligenceAnalysis = {
    analysisVersion: 'test', createdAt: '2026-01-01T00:00:00.000Z', durationMs: 6000, bpm: 120, bpmConfidence: 0.8,
    timeSignature: 4, beatGridOffsetSec: 0.25, beatGrid: [beat], downbeats: [beat], phrases: [], sections: [section],
    energyCurves: { instant: [], shortTerm: [], bass: [], mid: [], high: [] },
    spectralCurves: { centroid: [], flux: [], complexity: [] },
    harmonic: { dominantKey: null, dominantMode: null, keyConfidence: 0, keyChanges: [], chordProgression: [], pitchCurve: [], melodyContourCurve: [] },
    stemCurves: null, lyrics: null, semanticMoments: [], warnings: [], errors: [],
  }
  const analysis = { ...source, bpmUsedForGrid: 126, beatGrid: [{ ...beat, timeSec: 0 }], beatGridOffsetSec: 0 }
  const rgbWaveform: RgbWaveformAnalysis = {
    version: 1, durationSec: 6, sampleRate: 44100, binCount: 2,
    positivePeaks: new Float32Array([0.5, 0.75]), negativePeaks: new Float32Array([-0.5, -0.25]),
    rms: new Float32Array([0.25, 0.5]), lowEnergy: new Float32Array([0.5, 0]),
    midEnergy: new Float32Array([0, 0.5]), highEnergy: new Float32Array([0.5, 0.5]),
  }
  const engine = {
    currentTrack: {
      id: 'track-1', name: 'track.wav', displayName: 'Track', title: 'Björk </script><script>alert(1)</script>',
      url: 'https://example.invalid/private-signed-media',
      externalMetadata: { source: 'rekordbox_usb', bpm: 120 },
      importedCueMarkers: [{ id: 'hot-cue', label: 'Hot Cue B', time: 3, type: 'custom', kind: 'hot_cue' }],
      importedAnalysisSeed: { source: 'rekordbox_usb', beatGrid: [beat] },
      analysisRuntime: { ...DEFAULT_TRACK_ANALYSIS_RUNTIME, gridStale: true, bpmOverride: 126 },
    },
    currentAnalysis: source, currentAnalysisStatus: 'complete', currentEffectiveBeatGrid: analysis.beatGrid,
    currentEffectiveBpm: 126, currentAnalyzedBpm: 120, getCurrentTime: () => 4, isPlaying: false,
  } as unknown as AudioEngine
  const model = buildTrackTimelineModel({ analysis, rgbWaveform, filename: 'track.wav', channels: 2 })
  return captureTrackTimelineExport({ engine, analysis, rgbWaveform, model, resolvedSections: [section] })
}

describe('Track Timeline ZIP export', () => {
  it('packages the full timeline and exact matching embedded JSON with distinct grid sources', async () => {
    const data = snapshot()
    const archive = createTrackTimelineArchive(data)
    expect(archive.type).toBe('application/zip')
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))
    expect(Object.keys(entries).sort()).toEqual(['track-timeline.html', 'track-timeline.json'])
    const json = strFromU8(entries['track-timeline.json']!)
    const html = strFromU8(entries['track-timeline.html']!)
    expect(html.match(/<script type="application\/json" id="capture">([^<]*)<\/script>/)?.[1]).toBe(json)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(json).not.toContain('private-signed-media')
    expect(JSON.parse(json)).toMatchObject({
      track: { title: data.track.title, durationSec: 6, channels: 2 },
      trackAnalysis: { bpm: 120, beatGrid: [{ timeSec: 0.25 }] },
      effectiveGrid: { bpm: 126, isOverride: true, beatGrid: [{ timeSec: 0 }] },
      transport: { positionSec: 4, runtime: { gridStale: true } },
      timeline: { waveform: [{ start: 0, end: 3 }, { start: 3, end: 6 }] },
      rgbWaveform: { positivePeaks: [0.5, 0.75], negativePeaks: [-0.5, -0.25] },
      rekordbox: { cueMarkers: [{ id: 'hot-cue' }], analysisSeed: { beatGrid: [{ timeSec: 0.25 }] } },
      trackMap: { manualCueMarkers: [{ id: 'own-cue' }], resolvedSections: [{ id: 's1' }] },
      playbackSnapshot: null,
    })
  })

  it('delegates to the normal download flow in the timeline window with a portable ZIP filename', () => {
    const data = snapshot()
    const ownerDocument = {} as Document
    data.track.title = 'Live: Cut/One?'
    downloadTrackTimelineExport(data, ownerDocument)
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Live_ Cut_One_ - Track Timeline.zip', ownerDocument)
  })
})
