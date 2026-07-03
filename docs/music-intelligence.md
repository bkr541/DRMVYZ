# DRMVYZ Music Intelligence

Layered real-time and offline analysis pipeline that turns raw audio into structured data the visual system can consume.

---

## Layers 1–8

| Layer | Name | Where |
|-------|------|--------|
| 1 | **Audio Bands** | Raw FFT → sub/bass/lowMid/mid/high/air + normalized variants |
| 2 | **Rhythm Events** | Onset detection → kick/snare/hat/transient, beat hits |
| 3 | **Musical Grid** | BPM grid → beatPhase, beatInBar, barIndex, phrase4/8/16/32 |
| 4 | **Energy Envelope** | EMA-smoothed energy, spectral flux, tension, complexity, build/drop |
| 5 | **Sections** | Offline heuristic or manual — type/progress/intensity/confidence |
| 6 | **Harmonic** | Krumhansl-Schmuckler key detection, tonal chord detection, pitchy pitch |
| 7 | **Stems & Lyrics** | Per-stem curve interpolation, ActiveLyricTracker, active line/word/wordHit |
| 8 | **Semantic** | EMA-based build/drop/fakeout/vocalHook confidence, mood (14 labels), texture (5 labels) |

---

## Key Classes

### `MusicIntelligenceEngine`
`src/features/musicIntelligence/MusicIntelligenceEngine.ts`

Central coordinator. Called every animation frame by `LiveVisualCanvas`.

```ts
engine.updateFromAudioFrame({ freqBuf, timeBuf, sampleRate, audioTime, isPlaying })
```

Internally delegates to:
- `MultiBandAnalyzer` — Layer 1
- `RhythmAnalyzer` — Layer 2
- `BeatGrid` — Layer 3
- `EnergyAnalyzer` — Layer 4 (+ Meyda spectral features via getter)
- `HarmonicAnalyzer` — Layer 6
- `StemCurveInterpolator` — Layer 7
- `ActiveLyricTracker` — Layer 7 lyrics
- `SemanticAnalyzer` — Layer 8 (reads completed partial frame)

After assembly, publishes a `MusicIntelligenceFrame` to `AudioFeatureBus`.

```ts
engine.setTrackAnalysis(analysis)   // wire offline sections, BPM, beat markers, stems, lyrics
engine.setManualSections(sections)  // manual sections override analysis sections
engine.setBpm(bpm, confidence)
engine.reset()
```

### `AudioFeatureBus`
`src/features/musicIntelligence/AudioFeatureBus.ts`

Module-level singleton pub/sub for `MusicIntelligenceFrame`.

```ts
AudioFeatureBus.getFrame()           // zero-allocation read — safe every rAF tick
AudioFeatureBus.setFrame(frame)      // called by the engine after assembly
AudioFeatureBus.subscribe(listener)  // returns unsubscribe fn
AudioFeatureBus.reset()              // called on track change
```

React components that need live values use `requestAnimationFrame` + direct DOM writes (refs). Do **not** use `subscribe()` or `useState` for high-frequency render consumers.

### `MusicIntelligenceFrame`
`src/features/musicIntelligence/types.ts`

Published at ~60 fps. Shape:

```ts
interface MusicIntelligenceFrame {
  timeSec:    number
  frameId:    number
  sampleRate: number
  sourceId:   string | null
  trackId:    string | null
  bands:      MIBands       // Layer 1
  rhythm:     MIRhythm      // Layers 2–3
  energy:     MIEnergy      // Layer 4
  section:    MISection     // Layer 5
  harmonic:   MIHarmonic    // Layer 6
  stems:      MIStems       // Layer 7
  lyrics:     MILyrics      // Layer 7 lyrics
  semantics:  MISemantics   // Layer 8
  raw:        { freqData, timeDomainData }
  confidence: { overall, rhythm, harmonic, section }
}
```

The frame is always fully populated (no optional sub-fields). Absent data gracefully defaults to 0/null/false.

### `TrackIntelligenceAnalysis`
`src/features/musicIntelligence/types.ts`

Offline analysis result — persisted to `localStorage` via `useTrackAnalysisStore`.

Key fields: `bpm`, `bpmConfidence`, `sections[]`, `beatGrid[]`, `energyCurves`, `spectralCurves`, `stemCurves`, `harmonic.pitchCurve`, `harmonic.dominantKey/Mode`, `semanticMoments[]`, `lyrics`.

---

## Real-time vs Offline Analysis

### Real-time (per frame, `LiveVisualCanvas`)
1. `AnalyserNode.getByteFrequencyData(freqBuf)` — browser-native
2. `musicIntelligenceEngine.updateFromAudioFrame(...)` — all layers 1–8
3. `AudioFeatureBus.getFrame()` — read by modulation system and React renderer

Cost: O(fftSize/2) operations per frame. Designed to be lightweight.

### Offline (`analyzeTrackBuffer`)
`src/features/musicIntelligence/offlineTrackAnalyzer.ts`

```ts
const analysis = await analyzeTrackBuffer(audioBuffer, options)
useTrackAnalysisStore.getState().saveTrackAnalysis(trackId, analysis)
engine.setTrackAnalysis(analysis)
```

Runs full FFT frame-by-frame over the entire audio buffer (async but CPU-bound). Produces feature curves, key detection, sections, beat grid, pitch curve, and semantic moments. Should be run in a Web Worker for tracks > 3 min to avoid blocking the main thread.

---

## Modulation Sources

All numeric sources return `0–1`. Trigger sources return `0` or `1`. See `src/lib/miSourceRegistry.ts` for the full categorized registry.

| Category | Example keys |
|----------|-------------|
| Audio Bands | `sub`, `bass`, `lowMid`, `mid`, `high`, `air`, `volume`, `rms`, `peak`, `nBass`, … |
| Rhythm | `beat`, `beatPhase`, `kick`, `snare`, `hat`, `transient`, `downbeat` |
| Musical Grid | `phrase4`, `phrase8`, `phrase16`, `phrase32`, `phrase16Hit`, … |
| Energy | `energy`, `energyShort`, `spectralFlux`, `tension`, `complexity`, `buildProgress`, `dropImpact` |
| Section | `sectionProgress`, `sectionIntensity` |
| Harmonic | `pitchHz`, `melodyHeight`, `keyConfidence`, `chordConfidence`, `chordChange` (trigger) |
| Stems & Lyrics | `vocalEnergy`, `drumEnergy`, `vocalActivity`, `lyricLineProgress`, `wordHit` (trigger) |
| Semantic | `buildConfidence`, `dropConfidence`, `fakeoutConfidence`, `vocalHookConfidence` |

### How to add a new modulation source

1. Add the key to `ModulationSourceKey` in `src/lib/miSourceRegistry.ts`
2. Add a `MISourceDef` entry to `MI_SOURCE_REGISTRY`
3. Add the field to `MIBands` / `MIRhythm` / etc. in `src/features/musicIntelligence/types.ts`
4. Populate the field in the relevant analyzer class
5. Add a `case` in `resolveSourceValue` in `src/lib/audioModulation.ts`
6. Add a `case` in `getModulationSourceValue` in `src/features/musicIntelligence/selectors.ts` (for React-path consumers)

### How to add a new analysis curve

1. Add a `FeatureCurve` field to `TrackIntelligenceAnalysis` in `types.ts`
2. Compute the curve in `analyzeTrackBuffer` — follow the pattern of `energyCurves.bass`
3. Add a `downsampleCurve(...)` call in the return statement
4. Update `adaptMIAnalysis` in `trackMapAdapter.ts` if the curve affects section display

---

## Diagnostics Panel

The **Music Intelligence** tab in the right rail (AUDIO) shows live values from all 8 layers.

`src/components/vyzualz/modulation/MusicIntelligenceDiagnosticsPanel.tsx`

Implementation: reads `AudioFeatureBus.getFrame()` in a `requestAnimationFrame` loop, writes directly to DOM refs — **zero React state updates** so it cannot cause extra renders.

---

## Performance Notes

- **Never call `analyzeTrackBuffer` on the main thread for long tracks.** It blocks for several seconds. Use `useTrackAnalysisStore` to persist results and only analyze once per track.
- **Do not introduce React `useState` in render-loop consumers.** Use refs + direct DOM writes or the `AudioFeatureBus.subscribe()` API for non-React sinks.
- The `ModulationRoute` system reads from the MI frame via `resolveSourceValue` in `applyModulatedEffects`. Legacy `AudioBand` sources (`bass`, `lowMid`, `mid`, `high`, `volume`, `beat`) use the raw `AudioBandValues` object for backward-compatible smoothing behavior.

---

## Optional Backend Tools for Heavy Analysis

These are not implemented in the browser. Use the `StemAnalysisBackend` interface to wire them in via a server endpoint.

| Tool | Use case |
|------|----------|
| **demucs** / **spleeter** / **openunmix** | Stem separation (vocals, drums, bass, instruments) |
| **Groq Whisper via Supabase Edge Function** | Online lyric transcription with segment and word timestamps; credentials stay server-side |
| **Private transcription worker** | Optional codec fallback when browser audio preparation cannot decode the source file |
| **librosa** | Feature extraction, onset detection, chroma, MFCCs |
| **essentia** | Music description, key/chord, rhythm, tonal analysis |
| **pyloudnorm** | LUFS loudness normalization |
| **torch** | Custom ML models for mood, genre, structure |

Lyric transcription is routed through `supabase/functions/lyric-transcription` and currently requires an internet connection. Groq Whisper is the canonical online provider for new jobs, called server-side from the Supabase Edge Function. Browser users never call Groq directly, there is no `VITE_GROQ_API_KEY`, and transcription credentials must stay out of `VITE_*` variables.

Historical OpenAI-era job rows remain readable for compatibility, but active transcription execution and retries route through Groq. Existing lyric document saving, cue saving, word timing, chunk reconciliation, retry/cancel behavior, and private browser-prepared audio storage remain unchanged.

The direct provider route keeps compatible files under the provider byte limit as one request. Oversized uncompressed PCM or IEEE-float WAV files are automatically split into valid overlapping RIFF/WAVE chunks, transcribed with bounded concurrency, and reconciled back onto the original track timeline. Oversized compressed containers are prepared in the browser as private mono PCM WAV chunks when possible; a source codec the browser cannot decode still requires conversion or the optional long-audio backend.
