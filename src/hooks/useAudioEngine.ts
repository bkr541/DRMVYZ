import { useRef, useState, useCallback, useEffect, type MutableRefObject } from 'react'
import {
  Track, AudioSource, FftSize,
  TrackAnalysisRuntime,
  BpmSource,
} from '../types'
import type { TrackAnalysisStatus, TrackIntelligenceAnalysis, BeatMarkerMI } from '../features/musicIntelligence/types'
import { generateId } from '../utils/audioUtils'
import { buildMonitoringChain, type MonitoringChain } from '../audio/routing'
import { StereoScopeAudioTap } from '../audio/scope/StereoScopeAudioTap'
import type { MonitoringMode, ReferenceTrack, SpectralFeatures } from '../types/audio'
import Meyda from 'meyda'
import {
  musicIntelligenceEngine,
  type MusicIntelligenceEngine,
} from '../features/musicIntelligence/MusicIntelligenceEngine'
import { buildEffectiveBeatGrid } from '../features/trackIntelligence/beatGridUtils'
import { applyResnap, applyReanalyze } from '../features/musicIntelligence/bpmReanalysis'
import type { BpmReanalysisMode, BpmReanalysisStatus } from '../features/musicIntelligence/types'
import { analyzeTrackBuffer } from '../features/musicIntelligence/offlineTrackAnalyzer'
import { useTrackAnalysisStore } from '../features/musicIntelligence/trackAnalysisStorage'
import {
  createLocalRuntimeTrack,
  createPreparedRuntimeTrack,
  createRemoteRuntimeTrack,
  getTrackAudioTrackId,
  isPersistedTrack,
  type RuntimeTrackUrlInput,
  type PreparedTrackInput,
} from '../audio/runtimeTrack'
import { upsertTrackAnalysisPayload } from '../lib/audioDb'
import { useReactStore } from '../stores/reactStore'
import {
  isShowManagerTransportReady,
  requestAudioSourceMutation,
  type AudioSourceMutationOptions,
} from '../audio/audioSourcePolicy'
import { adaptMIAnalysis, resolveTrackSections } from '../features/trackIntelligence/trackMapAdapter'
import {
  TrackAnalysisCoordinator,
  computeAnalysisVariantKey,
  computeImportedGridRevision,
} from '../features/trackIntelligence/TrackAnalysisCoordinator'

function resolveAuthoritativeSectionsForTrack(
  track: Track,
  analysis: TrackIntelligenceAnalysis | null,
) {
  const state = useReactStore.getState()
  const manualSections = state.manualTrackSectionsByTrackId[track.id] ?? []
  const suppressedIds = state.suppressedAutoSectionsByTrackId[track.id] ?? []
  const analyzedSections = analysis ? adaptMIAnalysis(analysis) : []
  const durationSec = Math.max(track.duration, analysis?.durationMs ? analysis.durationMs / 1000 : 0)
  return resolveTrackSections({ analyzedSections, manualSections, suppressedIds, durationSec })
}

function publishAuthoritativeTrackState(track: Track, analysis: TrackIntelligenceAnalysis | null): boolean {
  return musicIntelligenceEngine.setAuthoritativeTrackState({
    analysis,
    resolvedSections: resolveAuthoritativeSectionsForTrack(track, analysis),
    trackId: track.id,
    sourceId: track.id,
  })
}

// 60-second ring buffer
class RingBuffer {
  private buf: Float32Array
  private pos = 0
  private filled = false
  readonly capacity: number
  readonly sampleRate: number

  constructor(sampleRate: number, seconds = 60) {
    this.sampleRate = sampleRate
    this.capacity = sampleRate * seconds
    this.buf = new Float32Array(this.capacity)
  }

  write(data: Float32Array) {
    for (let i = 0; i < data.length; i++) {
      this.buf[this.pos] = data[i]
      this.pos = (this.pos + 1) % this.capacity
      if (this.pos === 0) this.filled = true
    }
  }

  read(seconds: number): Float32Array {
    const count = Math.min(
      Math.floor(seconds * this.sampleRate),
      this.filled ? this.capacity : this.pos
    )
    const result = new Float32Array(count)
    let readPos = ((this.pos - count) % this.capacity + this.capacity) % this.capacity
    for (let i = 0; i < count; i++) {
      result[i] = this.buf[(readPos + i) % this.capacity]
    }
    return result
  }
}

export interface AudioEngine {
  source: AudioSource
  setSource: (s: AudioSource, options?: AudioSourceMutationOptions) => Promise<void>
  micError: string | null
  isActive: boolean

  tracks: Track[]
  currentIndex: number
  isPlaying: boolean
  currentTime: number
  /**
   * High-precision getter — reads HTMLAudioElement.currentTime at the moment of
   * the call. For canvas/RAF sync only; never triggers React state updates.
   */
  getCurrentTime: () => number
  duration: number
  volume: number
  addTracks: (files: File[], options?: AudioSourceMutationOptions) => void
  replaceTracks: (files: File[], options?: AudioSourceMutationOptions) => void
  addPreparedTracks: (inputs: PreparedTrackInput[], options?: AudioSourceMutationOptions) => void
  replacePreparedTracks: (inputs: PreparedTrackInput[], options?: AudioSourceMutationOptions) => void
  /** Load pre-built tracks by URL (e.g. signed Supabase URLs) without a File object. */
  addTrackUrls: (tracks: RuntimeTrackUrlInput[], options?: AudioSourceMutationOptions) => void
  replaceTrackUrls: (tracks: RuntimeTrackUrlInput[], options?: AudioSourceMutationOptions) => void
  removeTrack: (id: string, options?: AudioSourceMutationOptions) => void
  selectTrack: (i: number, options?: AudioSourceMutationOptions) => void
  play: () => void
  pause: () => void
  stop: () => void
  next: () => void
  prev: () => void
  seek: (t: number) => void
  setVolume: (v: number) => void

  analyserMaster: AnalyserNode | null
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  audioContext: AudioContext | null
  sampleRate: number

  fftSize: FftSize
  setFftSize: (n: FftSize) => void
  smoothing: number
  setSmoothing: (n: number) => void

  ringBuffer: RingBuffer | null

  /**
   * Synchronized stereo capture for the Sound Drawing professional scope core.
   *
   * Separate from `analyserL`/`analyserR`: those are two independent analysers
   * that each snapshot on their own read, with no guarantee the samples came
   * from the same instant — adequate for level meters, not for a vectorscope.
   * null until the audio graph is built; capture itself is best-effort and
   * consumers must handle a tap that never becomes active.
   */
  scopeStereoTap: StereoScopeAudioTap | null

  // Monitoring
  monitoringMode: MonitoringMode
  setMonitoringMode: (mode: MonitoringMode) => void

  // Reference tracks
  referenceTracks: ReferenceTrack[]
  activeRefSlot: number
  isABMode: boolean
  refVolume: number
  autoLoudnessMatch: boolean
  addReferenceTrack: (file: File, slot?: number) => void
  removeReferenceTrack: (id: string) => void
  setActiveRefSlot: (slot: number) => void
  setABMode: (on: boolean) => void
  setRefVolume: (v: number) => void
  setAutoLoudnessMatch: (on: boolean) => void

  refAnalyserMaster: AnalyserNode | null
  refAnalyserL: AnalyserNode | null
  refAnalyserR: AnalyserNode | null

  // Recording — tap the master gain signal for MediaRecorder capture
  getRecordingStream: () => MediaStream | null

  // Demo mode
  demoSilent: boolean
  setDemoSilent: (v: boolean) => void

  // Meyda spectral features
  spectralFeatures: SpectralFeatures | null
  // Ref for direct high-frequency reads without React re-renders
  spectralFeaturesRef: MutableRefObject<SpectralFeatures | null>
  // Meyda is idle by default — start/stop explicitly when a feature needs it
  meydaActive: boolean
  startSpectralAnalysis: () => void
  stopSpectralAnalysis: () => void
  // Centralized music intelligence — shared singleton that LiveVisualCanvas
  // feeds each frame via updateFromAudioFrame().
  musicIntelligenceEngine: MusicIntelligenceEngine

  // Return cached decoded AudioBuffer for a track if available in memory (coordinator buffer cache).
  getDecodedBuffer: (trackId: string) => AudioBuffer | undefined

  // ── Canonical active-track intelligence ───────────────────────────────────
  // The audio engine is the source of truth for track analysis state.
  // React consumers should read these rather than reaching into separate stores.

  currentTrackId:         string | null
  currentAudioTrackId:    string | null
  currentTrackIsPersisted: boolean
  currentTrack:           Track | null
  currentAnalysis:        TrackIntelligenceAnalysis | null
  currentAnalysisStatus:  TrackAnalysisStatus
  currentAnalysisError:   string | null

  // BPM provenance — effective BPM respects overrides, original analyzed BPM is always available
  currentAnalyzedBpm:    number | null
  currentEffectiveBpm:   number | null
  currentBpmConfidence:  number | null
  // null when no source or BPM is unavailable; microphone BPM comes from AudioFeatureBus
  currentBpmSource:      BpmSource | null
  /**
   * Regenerated beat grid for the active track when a manual BPM override is in
   * effect.  null when no override is active; consumers should fall back to
   * currentAnalysis.beatGrid / currentAnalysis.downbeats in that case.
   */
  currentEffectiveBeatGrid: BeatMarkerMI[] | null

  currentKey: { tonic: string; mode: string; confidence?: number } | null

  // Update a track's analysis runtime in-place (called by UI after offline analysis)
  updateTrackRuntime: (trackId: string, patch: Partial<TrackAnalysisRuntime>) => void
  // Set or clear a per-track manual BPM override
  setBpmOverride: (trackId: string, bpm: number | null) => void
  // Re-queue a failed or unanalyzed track for analysis (may reuse cached analysis)
  retryAnalysis: (trackId: string) => void
  // Force fresh analysis, bypassing both memory and persistent analysis caches
  reanalyzeTrack: (trackId: string) => void
  /**
   * Rebuild BPM-dependent analysis using the current manual override BPM.
   * 'resnap': re-snaps section boundaries to the new grid, preserves detection.
   * 'reanalyze': re-runs section detection from stored curves, then snaps to grid.
   * Neither mode re-runs FFT, waveform, key, lyric, or chroma analysis.
   * A new call for the same track cancels any in-flight request.
   */
  reanalyzeWithBpmOverride: (trackId: string, opts: { bpm: number; mode: BpmReanalysisMode }) => Promise<void>
  /** Reanalysis status for the current active track. */
  currentBpmReanalysisStatus: BpmReanalysisStatus
}

export function useAudioEngine(): AudioEngine {
  const [source, setSourceState] = useState<AudioSource>('file')
  const [micError, setMicError] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [fftSize, setFftSizeState] = useState<FftSize>(2048)
  const [smoothing, setSmoothingState] = useState(0.8)
  const [monitoringMode, setMonitoringModeState] = useState<MonitoringMode>('stereo')
  const [referenceTracks, setReferenceTracks] = useState<ReferenceTrack[]>([])
  const [activeRefSlot, setActiveRefSlot] = useState(1)
  const [isABMode, setIsABMode] = useState(false)
  const [refVolume, setRefVolumeState] = useState(1.0)
  const [autoLoudnessMatch, setAutoLoudnessMatch] = useState(true)
  const [spectralFeatures, setSpectralFeatures] = useState<SpectralFeatures | null>(null)
  const [meydaActive, setMeydaActive] = useState(false)
  const [demoSilent, setDemoSilentState] = useState(true)

  // Core graph refs
  const ctxRef           = useRef<AudioContext | null>(null)
  const aMasterRef       = useRef<AnalyserNode | null>(null)
  const aLRef            = useRef<AnalyserNode | null>(null)
  const aRRef            = useRef<AnalyserNode | null>(null)
  const masterGainRef    = useRef<GainNode | null>(null)
  const splitterRef      = useRef<ChannelSplitterNode | null>(null)
  const monitoringHeadRef= useRef<GainNode | null>(null)  // feeds monitoring chain
  const monitoringChainRef = useRef<MonitoringChain | null>(null)
  const abGainARef       = useRef<GainNode | null>(null)  // main → monitoring (A mode)
  const abGainBRef       = useRef<GainNode | null>(null)  // ref → monitoring (B mode)
  const muteGainRef      = useRef<GainNode | null>(null)  // output mute (for silent demo)

  // Reference graph refs
  const refAudioRef      = useRef<HTMLAudioElement | null>(null)
  const refFileSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const refGainRef       = useRef<GainNode | null>(null)
  const refAnalyserMRef  = useRef<AnalyserNode | null>(null)
  const refSplitterRef   = useRef<ChannelSplitterNode | null>(null)
  const refALRef         = useRef<AnalyserNode | null>(null)
  const refARRef         = useRef<AnalyserNode | null>(null)

  // Source nodes
  const fileSourceRef    = useRef<MediaElementAudioSourceNode | null>(null)
  const micSourceRef     = useRef<MediaStreamAudioSourceNode | null>(null)
  const micStreamRef     = useRef<MediaStream | null>(null)
  const demoNodesRef     = useRef<AudioNode[]>([])

  // Ring buffer — written by AudioWorklet message handler
  const ringBufRef       = useRef<RingBuffer | null>(null)
  const workletNodeRef   = useRef<AudioWorkletNode | null>(null)
  const scopeTapRef      = useRef<StereoScopeAudioTap | null>(null)
  const recordingDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const audioRef         = useRef<HTMLAudioElement | null>(null)
  const activeSourceNodeRef = useRef<AudioNode | null>(null)
  const meydaRef         = useRef<ReturnType<typeof Meyda.createMeydaAnalyzer> | null>(null)

  // Spectral data hot path — never triggers React renders
  const spectralFeaturesRef     = useRef<SpectralFeatures | null>(null)
  const meydaRunningRef         = useRef(false)
  // Shadow ref so getCurrentTime can fall back without capturing state in its closure
  const currentTimeRef = useRef(0)
  useEffect(() => { currentTimeRef.current = currentTime }, [currentTime])

  // ── Track analysis coordinator refs ──────────────────────────────────────────
  // Stable mutable callbacks so the coordinator never holds stale React closure refs.
  const coordinatorRef = useRef<TrackAnalysisCoordinator | null>(null)
  const tracksRef      = useRef<Track[]>(tracks)
  const currentIndexRef = useRef<number>(currentIndex)
  const ensureContextRef = useRef<() => AudioContext>(() => { throw new Error('not ready') })
  // Dispatch table: properties reassigned each render so coordinator callbacks always call current logic.
  const dispatchRef = useRef({
    runtime:  (_id: string, _patch: Partial<TrackAnalysisRuntime>) => {},
    duration: (_id: string, _dur: number) => {},
    engine:   (_analysis: TrackIntelligenceAnalysis, _trackId: string) => {},
    isActive: (_trackId: string): boolean => false,
  })

  // ── Init main audio element ─────────────────────────────────────────────────
  useEffect(() => {
    const el = new Audio()
    el.crossOrigin = 'anonymous'
    el.volume = volume
    audioRef.current = el
    const onTimeUpdate   = () => setCurrentTime(el.currentTime)
    const onDurationChange = () => setDuration(el.duration || 0)
    el.addEventListener('timeupdate',     onTimeUpdate)
    el.addEventListener('durationchange', onDurationChange)
    return () => {
      el.removeEventListener('timeupdate',     onTimeUpdate)
      el.removeEventListener('durationchange', onDurationChange)
      el.pause(); el.src = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Stereo scope capture disposal ───────────────────────────────────────────
  // The tap owns a worklet node and its message port; both must be released with
  // the hook, not left holding a reference to a torn-down audio graph.
  useEffect(() => {
    return () => {
      scopeTapRef.current?.dispose()
      scopeTapRef.current = null
    }
  }, [])

  // ── Init reference audio element ────────────────────────────────────────────
  useEffect(() => {
    const el = new Audio()
    el.crossOrigin = 'anonymous'
    el.loop = true
    refAudioRef.current = el
    return () => { el.pause(); el.src = '' }
  }, [])

  // ── Auto-advance ────────────────────────────────────────────────────────────
  const handleEnded = useCallback(() => {
    setCurrentIndex(prev => {
      const nextIndex    = prev + 1
      const hasNextTrack = nextIndex < tracks.length
      const mayAdvanceSource = requestAudioSourceMutation({ notifyOnBlocked: false })
      // Show Manager owns one linked track. Never auto-advance from it into an
      // unrelated playlist entry when playback reaches the end.
      const shouldAdvance = hasNextTrack && mayAdvanceSource
      setIsPlaying(shouldAdvance)
      return shouldAdvance ? nextIndex : prev
    })
  }, [tracks.length])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.addEventListener('ended', handleEnded)
    return () => el.removeEventListener('ended', handleEnded)
  }, [handleEnded])

  // ── Build audio graph ───────────────────────────────────────────────────────
  const ensureContext = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
      return ctxRef.current
    }

    const ctx = new AudioContext()
    ctxRef.current = ctx

    // Initialize the centralized music intelligence engine with this context's sample rate
    musicIntelligenceEngine.initialize({ sampleRate: ctx.sampleRate })

    // Master gain + main analysers
    const masterGain = ctx.createGain()
    masterGain.gain.value = 1
    masterGainRef.current = masterGain

    const aMaster = ctx.createAnalyser()
    aMaster.fftSize = fftSize
    aMaster.smoothingTimeConstant = smoothing
    aMasterRef.current = aMaster

    const splitter = ctx.createChannelSplitter(2)
    splitterRef.current = splitter

    const aL = ctx.createAnalyser()
    aL.fftSize = 1024; aL.smoothingTimeConstant = 0.8; aLRef.current = aL
    const aR = ctx.createAnalyser()
    aR.fftSize = 1024; aR.smoothingTimeConstant = 0.8; aRRef.current = aR

    masterGain.connect(aMaster)
    masterGain.connect(splitter)
    splitter.connect(aL, 0)
    splitter.connect(aR, 1)

    // Ring buffer — populated by AudioWorkletNode (audio thread → main thread transfer).
    // Worklet loads asynchronously; a brief window at startup may miss samples.
    // Falls back to empty ring buffer if AudioWorklet is unavailable (CSP / old browser).
    ringBufRef.current = new RingBuffer(ctx.sampleRate, 60)
    ctx.audioWorklet.addModule('/worklets/ring-buffer-processor.js')
      .then(() => {
        if (ctxRef.current !== ctx) return   // context was replaced before worklet loaded
        const worklet = new AudioWorkletNode(ctx, 'ring-buffer-processor', {
          numberOfInputs:   1,
          numberOfOutputs:  0,   // sink node — stays active via active input per spec
          channelCount:     1,
          channelCountMode: 'explicit',
        })
        worklet.port.onmessage = (e: MessageEvent<{ samples: Float32Array }>) => {
          ringBufRef.current?.write(e.data.samples)
        }
        masterGain.connect(worklet)
        workletNodeRef.current  = worklet
      })
      .catch(() => undefined)

    // Synchronized stereo scope capture. Taps masterGain in parallel with the
    // analysers and never joins the monitoring chain, so it cannot alter or
    // delay what the user hears. Failure to load is non-fatal: the tap reports
    // itself unavailable and Sound Drawing keeps its existing analyser path.
    const scopeTap = new StereoScopeAudioTap(ctx)
    scopeTapRef.current = scopeTap
    void scopeTap.start(masterGain).catch(() => undefined)

    // Reference analysers
    const refGain = ctx.createGain()
    refGain.gain.value = refVolume
    refGainRef.current = refGain

    const refAnalyserM = ctx.createAnalyser()
    refAnalyserM.fftSize = fftSize; refAnalyserM.smoothingTimeConstant = smoothing
    refAnalyserMRef.current = refAnalyserM

    const refSplitter = ctx.createChannelSplitter(2)
    refSplitterRef.current = refSplitter

    const refAL = ctx.createAnalyser()
    refAL.fftSize = 1024; refAL.smoothingTimeConstant = 0.8; refALRef.current = refAL
    const refAR = ctx.createAnalyser()
    refAR.fftSize = 1024; refAR.smoothingTimeConstant = 0.8; refARRef.current = refAR

    refGain.connect(refAnalyserM)
    refGain.connect(refSplitter)
    refSplitter.connect(refAL, 0)
    refSplitter.connect(refAR, 1)

    // A/B crossfade gains — A=main, B=ref → both feed monitoringHead
    const abGainA = ctx.createGain(); abGainA.gain.value = 1; abGainARef.current = abGainA
    const abGainB = ctx.createGain(); abGainB.gain.value = 0; abGainBRef.current = abGainB
    aMaster.connect(abGainA)
    refAnalyserM.connect(abGainB)

    // Monitoring head → initial stereo chain → destination
    const monHead = ctx.createGain(); monitoringHeadRef.current = monHead
    abGainA.connect(monHead)
    abGainB.connect(monHead)

    const chain = buildMonitoringChain(ctx, 'stereo')
    monitoringChainRef.current = chain
    monHead.connect(chain.input)

    // Mute gain — sits between monitoring chain and destination.
    // Keeps signal flowing to analysers while allowing silent output.
    const muteGain = ctx.createGain()
    muteGain.gain.value = 1
    muteGainRef.current = muteGain
    chain.output.connect(muteGain)
    muteGain.connect(ctx.destination)

    // Meyda — created but NOT started. Call startSpectralAnalysis() to activate.
    // The callback writes to a ref only; it never touches React state directly,
    // so it cannot cause re-renders regardless of how often Meyda fires (~86/s).
    try {
      const meyda = Meyda.createMeydaAnalyzer({
        audioContext: ctx,
        source: masterGain as unknown as AudioNode,
        bufferSize: 512,
        featureExtractors: ['rms', 'spectralCentroid', 'spectralSpread', 'spectralRolloff', 'spectralFlatness'],
        callback: (features: Record<string, number>) => {
          spectralFeaturesRef.current = {
            centroid: features.spectralCentroid ?? 0,
            spread:   features.spectralSpread   ?? 0,
            rolloff:  features.spectralRolloff  ?? 0,
            flatness: features.spectralFlatness ?? 0,
            bpm:      spectralFeaturesRef.current?.bpm ?? null,
          }
        },
      })
      meydaRef.current = meyda
      // Register getter so the MI engine reads Meyda features each frame via ref (no re-renders)
      musicIntelligenceEngine.setMeydaFeaturesGetter(() => spectralFeaturesRef.current)
      // Auto-start Meyda — writes to spectralFeaturesRef; MI engine benefits immediately.
      // meydaActive React state stays false; call startSpectralAnalysis() to also
      // enable the 5-Hz React-state publisher used by the spectral UI panel.
      meyda.start()
      meydaRunningRef.current = true
    } catch { /**/ }

    return ctx
  }, [fftSize, smoothing, refVolume])

  // ── Monitoring mode ─────────────────────────────────────────────────────────
  const setMonitoringMode = useCallback((mode: MonitoringMode) => {
    setMonitoringModeState(mode)
    const ctx = ctxRef.current
    const monHead = monitoringHeadRef.current
    if (!ctx || !monHead) return

    // Tear down old chain
    const old = monitoringChainRef.current
    if (old) {
      try { monHead.disconnect(old.input) } catch { /**/ }
      old.cleanup()
    }

    // Build and wire new chain
    const chain = buildMonitoringChain(ctx, mode)
    monitoringChainRef.current = chain
    monHead.connect(chain.input)
    const mute = muteGainRef.current
    chain.output.connect(mute ?? ctx.destination)
  }, [])

  // ── A/B mode ────────────────────────────────────────────────────────────────
  const setABMode = useCallback((on: boolean) => {
    setIsABMode(on)
    const a = abGainARef.current
    const b = abGainBRef.current
    if (!a || !b) return
    if (on) {
      a.gain.setTargetAtTime(0, ctxRef.current!.currentTime, 0.05)
      b.gain.setTargetAtTime(1, ctxRef.current!.currentTime, 0.05)
      // Play reference
      const refEl = refAudioRef.current
      if (refEl && refEl.src) refEl.play().catch(() => { /**/ })
      audioRef.current?.pause()
    } else {
      a.gain.setTargetAtTime(1, ctxRef.current!.currentTime, 0.05)
      b.gain.setTargetAtTime(0, ctxRef.current!.currentTime, 0.05)
      refAudioRef.current?.pause()
      const el = audioRef.current
      if (el && isPlaying) el.play().catch(() => { /**/ })
    }
  }, [isPlaying])

  // ── Reference track management ───────────────────────────────────────────────
  const addReferenceTrack = useCallback((file: File, slot = 1) => {
    const url = URL.createObjectURL(file)
    const name = file.name
    const displayName = name.replace(/\.[^.]+$/, '')

    setReferenceTracks(prev => {
      const existing = prev.find(t => t.slot === slot)
      if (existing) URL.revokeObjectURL(existing.url)
      const next = [...prev.filter(t => t.slot !== slot), { id: generateId(), name, displayName, url, slot }]
      return next.sort((a, b) => a.slot - b.slot)
    })

    setActiveRefSlot(slot)

    // Connect reference audio element
    const ctx = ensureContext()
    const refEl = refAudioRef.current
    const refGain = refGainRef.current
    if (!refEl || !refGain) return

    refEl.src = url
    refEl.load()

    if (!refFileSourceRef.current) {
      refFileSourceRef.current = ctx.createMediaElementSource(refEl)
      refFileSourceRef.current.connect(refGain)
    }
  }, [ensureContext])

  const removeReferenceTrack = useCallback((id: string) => {
    setReferenceTracks(prev => {
      const t = prev.find(x => x.id === id)
      if (t) URL.revokeObjectURL(t.url)
      return prev.filter(x => x.id !== id)
    })
  }, [])

  const setRefVolume = useCallback((v: number) => {
    setRefVolumeState(v)
    if (refGainRef.current) refGainRef.current.gain.value = v
  }, [])

  // ── Source management ───────────────────────────────────────────────────────
  const disconnectSource = useCallback(() => {
    const node = activeSourceNodeRef.current
    const gain = masterGainRef.current
    if (node && gain) { try { node.disconnect(gain) } catch { /**/ } }
    demoNodesRef.current.forEach(n => {
      try { (n as OscillatorNode).stop?.(); n.disconnect() } catch { /**/ }
    })
    demoNodesRef.current = []
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null; micSourceRef.current = null
    activeSourceNodeRef.current = null
  }, [])

  const connectFileSource = useCallback(() => {
    const ctx = ensureContext()
    const el = audioRef.current
    const gain = masterGainRef.current
    if (!el || !gain) return
    if (!fileSourceRef.current) fileSourceRef.current = ctx.createMediaElementSource(el)
    fileSourceRef.current.connect(gain)
    activeSourceNodeRef.current = fileSourceRef.current
  }, [ensureContext])

  const connectMicSource = useCallback(async () => {
    setMicError(null)
    const ctx = ensureContext()
    const gain = masterGainRef.current
    if (!gain) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream
      const micNode = ctx.createMediaStreamSource(stream)
      micSourceRef.current = micNode
      micNode.connect(gain)
      activeSourceNodeRef.current = micNode
    } catch (err) {
      setMicError(`Microphone access denied: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [ensureContext])

  const connectDemoSource = useCallback(() => {
    const ctx = ensureContext()
    const gain = masterGainRef.current
    if (!gain) return
    const nodes: AudioNode[] = []
    const bass = ctx.createOscillator()
    bass.frequency.value = 60; bass.type = 'sine'
    const bassG = ctx.createGain(); bassG.gain.value = 0.4
    bass.connect(bassG); bassG.connect(gain); bass.start()
    nodes.push(bass, bassG)
    const mid = ctx.createOscillator()
    mid.frequency.value = 440; mid.type = 'triangle'
    const midG = ctx.createGain(); midG.gain.value = 0.2
    mid.connect(midG); midG.connect(gain); mid.start()
    nodes.push(mid, midG)
    const bufSize = ctx.sampleRate * 2
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.1
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 3000
    noise.connect(hpf); hpf.connect(gain); noise.start()
    nodes.push(noise, hpf)
    // Keep masterGain at 0.35 so analysers see a signal
    gain.gain.value = 0.35
    demoNodesRef.current = nodes
    activeSourceNodeRef.current = bassG
  }, [ensureContext])

  const setSource = useCallback(async (s: AudioSource, options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    disconnectSource()
    if (masterGainRef.current) masterGainRef.current.gain.value = 1
    if (s === 'file') {
      const activeIndex = currentIndexRef.current
      if (activeIndex >= 0) connectFileSource()
      // Re-apply the active track's analysis when switching back to file.
      // This handles the case where mic/demo was active and we return to the
      // same file track (currentIndex unchanged, so the track-change effect
      // does not refire, but MI state was cleared on mic/demo entry).
      const track = tracksRef.current[activeIndex]
      if (track) {
        musicIntelligenceEngine.setSourceId(track.id, track.id)
        publishAuthoritativeTrackState(
          track,
          track.analysisRuntime.status === 'complete' ? track.analysisRuntime.analysis : null,
        )
      } else {
        musicIntelligenceEngine.setSourceId(null, null)
        musicIntelligenceEngine.setTrackAnalysis(null)
      }
    } else if (s === 'microphone') {
      // Clear offline analysis — live BPM comes from AudioFeatureBus each frame.
      musicIntelligenceEngine.setSourceId('microphone', null)
      musicIntelligenceEngine.setTrackAnalysis(null)
      await connectMicSource()
    } else {
      // Demo: clear file analysis, set demo source, demo BPM is handled by
      // the currentEffectiveBpm effect which reads source === 'demo'.
      musicIntelligenceEngine.setSourceId('demo', null)
      musicIntelligenceEngine.setTrackAnalysis(null)
      connectDemoSource()
      // Apply current demoSilent state to mute node
      if (muteGainRef.current) muteGainRef.current.gain.value = demoSilent ? 0 : 1
    }
    setSourceState(s)
    setIsPlaying(s === 'demo')
  }, [disconnectSource, connectFileSource, connectMicSource, connectDemoSource, demoSilent])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current
    if (!el || currentIndex < 0 || currentIndex >= tracks.length) return
    el.src = tracks[currentIndex].url; el.load()
    if (isPlaying && source === 'file') {
      connectFileSource()
      const ctx = ensureContext()
      if (ctx.state === 'suspended') ctx.resume()
      el.play().catch(() => setIsPlaying(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, tracks])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // ── Per-track analysis runtime update ────────────────────────────────────────
  const updateTrackRuntime = useCallback((trackId: string, patch: Partial<TrackAnalysisRuntime>) => {
    // The analysis coordinator can publish its first `decoding` update
    // synchronously from enqueue(). Compose against React's latest queued
    // playlist state so that update cannot overwrite a track addition that was
    // scheduled earlier in the same event.
    setTracks(currentTracks => {
      const nextTracks = currentTracks.map(track =>
        track.id === trackId
          ? { ...track, analysisRuntime: { ...track.analysisRuntime, ...patch } }
          : track,
      )
      tracksRef.current = nextTracks
      return nextTracks
    })
  }, [])

  const bpmReanalysisRunnerRef = useRef<((
    trackId: string,
    request: { bpm: number; mode: BpmReanalysisMode },
  ) => Promise<void>) | null>(null)

  const setBpmOverride = useCallback((trackId: string, bpm: number | null) => {
    if (bpm !== null) {
      // Capture the originally-detected BPM once so it survives further overrides.
      const track        = tracksRef.current.find(t => t.id === trackId)
      const detectedBpm  = track?.analysisRuntime.detectedBpm
                        ?? track?.analysisRuntime.analysis?.bpm
                        ?? null
      updateTrackRuntime(trackId, {
        bpmOverride:       bpm,
        bpmOverrideSource: 'manual_override',
        detectedBpm,
        gridStale:         true,
      })
    } else {
      const track = tracksRef.current.find(candidate => candidate.id === trackId)
      const detectedBpm = track?.analysisRuntime.detectedBpm
        ?? track?.analysisRuntime.analysis?.detectedBpm
        ?? track?.analysisRuntime.analysis?.bpm
        ?? null
      const needsRestore = detectedBpm != null
        && detectedBpm > 0
        && track?.analysisRuntime.analysis?.bpmUsedForGrid != null
        && Math.abs(track.analysisRuntime.analysis.bpmUsedForGrid - detectedBpm) > 0.0001
      updateTrackRuntime(trackId, {
        bpmOverride: null,
        bpmOverrideSource: null,
        detectedBpm: null,
        gridStale: needsRestore,
      })
      if (needsRestore && detectedBpm != null) {
        queueMicrotask(() => {
          void bpmReanalysisRunnerRef.current?.(trackId, { bpm: detectedBpm, mode: 'reanalyze' })
        })
      }
    }
  }, [updateTrackRuntime])

  const retryAnalysis = useCallback((trackId: string) => {
    const track = tracksRef.current.find(t => t.id === trackId)
    if (!track) return
    updateTrackRuntime(trackId, { status: 'queued', error: null })
    coordinatorRef.current?.enqueue(track, 'high')
  }, [updateTrackRuntime])

  const reanalyzeTrack = useCallback((trackId: string) => {
    const track = tracksRef.current.find(t => t.id === trackId)
    if (!track) return
    updateTrackRuntime(trackId, { status: 'queued', error: null })
    coordinatorRef.current?.reanalyze(track)
  }, [updateTrackRuntime])

  // ── BPM-override reanalysis ───────────────────────────────────────────────────
  // Per-track cancellation tokens. When a new request arrives for the same track,
  // the previous token is marked cancelled so its commit is a no-op.
  const bpmReanalysisTokens = useRef(new Map<string, { cancelled: boolean }>())

  const reanalyzeWithBpmOverride = useCallback(async (
    trackId: string,
    { bpm, mode }: { bpm: number; mode: BpmReanalysisMode },
  ): Promise<void> => {
    const previous = bpmReanalysisTokens.current.get(trackId)
    if (previous) previous.cancelled = true
    const token = { cancelled: false }
    bpmReanalysisTokens.current.set(trackId, token)
    updateTrackRuntime(trackId, { bpmReanalysisStatus: 'reanalyzing' })

    try {
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      if (token.cancelled) return

      const sourceTrack = tracksRef.current.find(track => track.id === trackId)
      const sourceAnalysis = sourceTrack?.analysisRuntime.analysis
      if (!sourceTrack || !sourceAnalysis) throw new Error('no analysis available for reanalysis')

      const result = mode === 'resnap'
        ? applyResnap(sourceAnalysis, bpm)
        : applyReanalyze(sourceAnalysis, bpm)

      const currentTrack = tracksRef.current.find(track => track.id === trackId)
      if (token.cancelled || !currentTrack || currentTrack.analysisRuntime.analysis !== sourceAnalysis) return

      const variantKey = computeAnalysisVariantKey(currentTrack.analysisRuntime.analysisKey, {
        bpmOverride: bpm,
        mode,
        gridRevision: computeImportedGridRevision(currentTrack.importedAnalysisSeed),
      })
      try {
        useTrackAnalysisStore.getState().saveTrackAnalysis(variantKey, result)
      } catch (error) {
        console.warn(`[BpmReanalysis] cache save failed for ${trackId}:`, error)
      }

      const commitTrack = tracksRef.current.find(track => track.id === trackId)
      if (token.cancelled || !commitTrack || commitTrack.analysisRuntime.analysis !== sourceAnalysis) return

      if (dispatchRef.current.isActive(trackId)) {
        publishAuthoritativeTrackState(commitTrack, result)
      }
      updateTrackRuntime(trackId, {
        analysis: result,
        effectiveBeatGrid: commitTrack.analysisRuntime.bpmOverride != null ? result.beatGrid : null,
        gridStale: false,
        bpmReanalysisStatus: 'complete',
      })
    } catch (error) {
      if (!token.cancelled) {
        console.warn(`[BpmReanalysis] ${trackId} failed:`, error)
        updateTrackRuntime(trackId, { bpmReanalysisStatus: 'failed' })
      }
    } finally {
      if (bpmReanalysisTokens.current.get(trackId) === token) {
        bpmReanalysisTokens.current.delete(trackId)
      }
    }
  }, [updateTrackRuntime])
  bpmReanalysisRunnerRef.current = reanalyzeWithBpmOverride

  // ── Canonical active-track intelligence ────────────────────────────────────
  const currentTrack            = currentIndex >= 0 && currentIndex < tracks.length ? tracks[currentIndex] ?? null : null
  const currentTrackId          = currentTrack?.id ?? null
  const currentAudioTrackId     = getTrackAudioTrackId(currentTrack)
  const currentTrackIsPersisted = isPersistedTrack(currentTrack)
  const currentAnalysis        = currentTrack?.analysisRuntime.analysis ?? null
  const currentAnalysisStatus  = currentTrack?.analysisRuntime.status ?? ('not_analyzed' as TrackAnalysisStatus)
  const currentAnalysisError   = currentTrack?.analysisRuntime.error ?? null
  const currentAnalyzedBpm     = currentAnalysis?.bpm ?? null

  // ── Track-change: apply/clear MI engine and prioritize coordinator ────────────
  // Depends on both `currentIndex` AND `currentTrackId` so the effect re-runs
  // when the same playlist position is replaced by a different track (e.g. after
  // replaceTracks() — the index stays at 0 but the ID changes).
  // Also depends on `currentAnalysisStatus` so we re-apply analysis when it
  // transitions to 'complete' without the coordinator path running first.
  useEffect(() => {
    const track = tracksRef.current[currentIndex]
    if (!track) {
      musicIntelligenceEngine.setSourceId(null, null)
      musicIntelligenceEngine.setTrackAnalysis(null)
      return
    }
    // Immediately clear previous track state before the new one loads.
    musicIntelligenceEngine.setSourceId(track.id, track.id)
    coordinatorRef.current?.prioritize(track.id)
    publishAuthoritativeTrackState(
      track,
      track.analysisRuntime.status === 'complete' ? track.analysisRuntime.analysis : null,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentTrackId, currentAnalysisStatus])

  const getRecordingStream = useCallback((): MediaStream | null => {
    const ctx = ensureContext()
    const gain = masterGainRef.current
    if (!gain) return null
    if (!recordingDestRef.current) {
      const dest = ctx.createMediaStreamDestination()
      gain.connect(dest)
      recordingDestRef.current = dest
    }
    return recordingDestRef.current.stream
  }, [ensureContext])

  const startSpectralAnalysis = useCallback(() => {
    ensureContext()
    const meyda = meydaRef.current
    if (meyda && !meydaRunningRef.current) {
      meyda.start()
      meydaRunningRef.current = true
      setMeydaActive(true)
    }
  }, [ensureContext])

  const stopSpectralAnalysis = useCallback(() => {
    const meyda = meydaRef.current
    if (meyda && meydaRunningRef.current) {
      meyda.stop()
      meydaRunningRef.current = false
      setMeydaActive(false)
    }
  }, [])

  // Throttled React state publication: ~5 Hz, only while Meyda is running.
  // Direct consumers that need sub-5Hz precision should read spectralFeaturesRef instead.
  useEffect(() => {
    if (!meydaActive) return
    const id = setInterval(() => {
      const f = spectralFeaturesRef.current
      if (f) {
        setSpectralFeatures({ ...f })
      }
    }, 200) // 5 Hz
    return () => clearInterval(id)
  }, [meydaActive])

  // ── Settings ─────────────────────────────────────────────────────────────────
  const setFftSize = useCallback((n: FftSize) => {
    setFftSizeState(n)
    if (aMasterRef.current) aMasterRef.current.fftSize = n
    if (refAnalyserMRef.current) refAnalyserMRef.current.fftSize = n
  }, [])

  const setDemoSilent = useCallback((v: boolean) => {
    setDemoSilentState(v)
    if (muteGainRef.current) {
      muteGainRef.current.gain.value = v ? 0 : 1
    }
  }, [])

  const setSmoothing = useCallback((n: number) => {
    setSmoothingState(n)
    for (const ref of [aMasterRef, aLRef, aRRef, refAnalyserMRef, refALRef, refARRef]) {
      if (ref.current) ref.current.smoothingTimeConstant = n
    }
  }, [])

  // ── Update coordinator dispatch table each render ─────────────────────────────
  // Must happen before any playlist callback that references these.
  tracksRef.current       = tracks
  currentIndexRef.current = currentIndex
  ensureContextRef.current = ensureContext
  dispatchRef.current.runtime = (trackId, patch) => updateTrackRuntime(trackId, patch)
  dispatchRef.current.duration = (trackId, dur) => {
    // Duration can resolve before React commits a just-added track. Use a
    // functional update for the same reason as updateTrackRuntime above.
    setTracks(currentTracks => {
      const nextTracks = currentTracks.map(track =>
        track.id === trackId ? { ...track, duration: dur } : track,
      )
      tracksRef.current = nextTracks
      return nextTracks
    })
  }
  dispatchRef.current.engine = (analysis, trackId) => {
    const track = tracksRef.current.find(candidate => candidate.id === trackId)
    if (!track || !dispatchRef.current.isActive(trackId)) return
    musicIntelligenceEngine.setSourceId(trackId, trackId)
    publishAuthoritativeTrackState(track, analysis)
  }
  dispatchRef.current.isActive = (trackId) =>
    tracksRef.current[currentIndexRef.current]?.id === trackId

  // ── Init coordinator once ────────────────────────────────────────────────────
  if (!coordinatorRef.current) {
    coordinatorRef.current = new TrackAnalysisCoordinator(
      {
        decodeBuffer: async ({ url, sourceFile, signal }) => {
          const ctx = ensureContextRef.current()
          if (sourceFile) {
            const ab = await sourceFile.arrayBuffer()
            return ctx.decodeAudioData(ab)
          }
          const resp = await fetch(url, { signal })
          if (!resp.ok) {
            throw new Error(`Audio fetch failed: ${resp.status} ${resp.statusText}`)
          }
          const ab = await resp.arrayBuffer()
          return ctx.decodeAudioData(ab)
        },
        analyze: (buffer, seed, onProgress, signal) => analyzeTrackBuffer(buffer, { seed, onProgress, signal }),
        getCachedAnalysis:  (key) => useTrackAnalysisStore.getState().getTrackAnalysis(key),
        saveCachedAnalysis: (key, analysis) =>
          useTrackAnalysisStore.getState().saveTrackAnalysis(key, analysis),
        saveCompletedTrackAnalysis: async (trackId, analysis) => {
          const runtimeTrack = tracksRef.current.find(track => track.id === trackId)
          const dbTrackId = runtimeTrack ? getTrackAudioTrackId(runtimeTrack) : null
          if (!dbTrackId) return
          const result = await upsertTrackAnalysisPayload(dbTrackId, analysis)
          if (result.error) console.warn('[AudioEngine] track analysis payload save:', result.error)
        },
      },
      {
        onRuntimeUpdate:  (trackId, patch)       => dispatchRef.current.runtime(trackId, patch),
        onDurationUpdate: (trackId, dur)         => dispatchRef.current.duration(trackId, dur),
        onApplyToEngine:  (analysis, trackId)    => dispatchRef.current.engine(analysis, trackId),
        isActiveTrack:    (trackId)              => dispatchRef.current.isActive(trackId),
      },
    )
  }

  // ── Playlist ─────────────────────────────────────────────────────────────────
  const addTracks = useCallback((files: File[], options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    const newTracks = files.map(file => createLocalRuntimeTrack(file))
    setTracks(prev => {
      if (prev.length === 0) setCurrentIndex(0)
      return [...prev, ...newTracks]
    })
    newTracks.forEach(t => coordinatorRef.current?.enqueue(t, 'normal'))
  }, [])

  const replaceTracks = useCallback((files: File[], options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    coordinatorRef.current?.invalidate()
    // Synchronously clear stale MI state before the new tracks arrive so the
    // old track's BPM/markers never bleed into the new track's analysis window.
    musicIntelligenceEngine.setSourceId(null, null)
    musicIntelligenceEngine.setTrackAnalysis(null)
    const newTracks = files.map(file => createLocalRuntimeTrack(file))
    setTracks(prev => {
      prev.forEach(t => URL.revokeObjectURL(t.url))
      setCurrentIndex(newTracks.length > 0 ? 0 : -1)
      return newTracks
    })
    newTracks.forEach(t => coordinatorRef.current?.enqueue(t, 'normal'))
  }, [])

  const addPreparedTracks = useCallback((inputs: PreparedTrackInput[], options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    const newTracks = inputs.map(createPreparedRuntimeTrack)
    setTracks(prev => {
      if (prev.length === 0) setCurrentIndex(0)
      return [...prev, ...newTracks]
    })
    newTracks.forEach(t => coordinatorRef.current?.enqueue(t, 'normal'))
  }, [])

  const replacePreparedTracks = useCallback((inputs: PreparedTrackInput[], options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    coordinatorRef.current?.invalidate()
    musicIntelligenceEngine.setSourceId(null, null)
    musicIntelligenceEngine.setTrackAnalysis(null)
    const newTracks = inputs.map(createPreparedRuntimeTrack)
    setTracks(prev => {
      prev.forEach(t => { if (t.url.startsWith('blob:')) URL.revokeObjectURL(t.url) })
      setCurrentIndex(newTracks.length > 0 ? 0 : -1)
      return newTracks
    })
    newTracks.forEach(t => coordinatorRef.current?.enqueue(t, 'normal'))
  }, [])

  const addTrackUrls = useCallback((tracks: RuntimeTrackUrlInput[], options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    const newTracks = tracks.map(createRemoteRuntimeTrack)
    const previousTracks = tracksRef.current
    const nextTracks = [...previousTracks, ...newTracks]
    tracksRef.current = nextTracks
    if (previousTracks.length === 0 && newTracks.length > 0) {
      currentIndexRef.current = 0
      setCurrentIndex(0)
    }
    setTracks(nextTracks)
    newTracks
      .filter(t => !(t.analysisRuntime.status === 'complete' && t.analysisRuntime.analysis))
      .forEach(t => coordinatorRef.current?.enqueue(t, 'normal'))
  }, [])

  const replaceTrackUrls = useCallback((tracks: RuntimeTrackUrlInput[], options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    coordinatorRef.current?.invalidate()
    musicIntelligenceEngine.setSourceId(null, null)
    musicIntelligenceEngine.setTrackAnalysis(null)
    const newTracks = tracks.map(createRemoteRuntimeTrack)
    // Only revoke blob: URLs — signed Supabase URLs should not be revoked.
    tracksRef.current.forEach(t => { if (t.url.startsWith('blob:')) URL.revokeObjectURL(t.url) })
    tracksRef.current = newTracks
    const nextIndex = newTracks.length > 0 ? 0 : -1
    currentIndexRef.current = nextIndex
    setCurrentIndex(nextIndex)
    setTracks(newTracks)
    newTracks
      .filter(t => !(t.analysisRuntime.status === 'complete' && t.analysisRuntime.analysis))
      .forEach(t => coordinatorRef.current?.enqueue(t, 'normal'))
  }, [])

  const removeTrack = useCallback((id: string, options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    coordinatorRef.current?.cancelTrack(id)
    // If the active track is being removed, clear MI state immediately.
    if (tracksRef.current[currentIndexRef.current]?.id === id) {
      musicIntelligenceEngine.setSourceId(null, null)
      musicIntelligenceEngine.setTrackAnalysis(null)
    }
    setTracks(prev => {
      const idx = prev.findIndex(t => t.id === id)
      if (idx >= 0 && prev[idx].url.startsWith('blob:')) URL.revokeObjectURL(prev[idx].url)
      const next = prev.filter(t => t.id !== id)
      setCurrentIndex(ci => {
        if (ci === idx) return Math.min(ci, next.length - 1)
        if (ci > idx) return ci - 1
        return ci
      })
      return next
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const selectTrack = useCallback((i: number, options: AudioSourceMutationOptions = {}) => {
    if (!requestAudioSourceMutation(options)) return
    setCurrentIndex(i); setIsPlaying(true)
    scopeTapRef.current?.reset()
    connectFileSource()
    const ctx = ensureContext()
    if (ctx.state === 'suspended') ctx.resume()
  }, [connectFileSource, ensureContext])

  const play = useCallback(() => {
    const el = audioRef.current
    const track = tracksRef.current[currentIndexRef.current]
    if (!el || !track || !isShowManagerTransportReady(getTrackAudioTrackId(track))) return
    // URL loaders update the authoritative refs before React commits their
    // playlist state. Point the media element at that track immediately so a
    // same-tick Load and Play action cannot observe a stale index/source.
    if (el.src !== track.url) {
      el.src = track.url
      el.load()
    }
    connectFileSource()
    const ctx = ensureContext()
    if (ctx.state === 'suspended') ctx.resume()
    el.play().then(() => setIsPlaying(true)).catch(() => { /**/ })
  }, [connectFileSource, ensureContext])

  const pause  = useCallback(() => {
    // Pausing is always safe: Show Manager uses this to silence a stale source
    // while the linked track is being activated. Starting/seek remain gated.
    audioRef.current?.pause(); setIsPlaying(false)
  }, [])
  const stop   = useCallback(() => {
    const el = audioRef.current
    const track = tracksRef.current[currentIndexRef.current]
    if (!el || !isShowManagerTransportReady(getTrackAudioTrackId(track))) return
    el.pause(); el.currentTime = 0; setIsPlaying(false); setCurrentTime(0)
    scopeTapRef.current?.reset()
    musicIntelligenceEngine.resolveLyricsAt(0, 'discontinuous')
  }, [])
  const next   = useCallback(() => {
    if (!requestAudioSourceMutation()) return
    if (currentIndex < tracks.length - 1) { setCurrentIndex(i => i + 1); setIsPlaying(true); connectFileSource() }
  }, [currentIndex, tracks.length, connectFileSource])
  const prev   = useCallback(() => {
    if (!requestAudioSourceMutation()) return
    if (currentIndex > 0) { setCurrentIndex(i => i - 1); setIsPlaying(true); connectFileSource() }
  }, [currentIndex, connectFileSource])
  const seek   = useCallback((t: number) => {
    const el = audioRef.current
    const track = tracksRef.current[currentIndexRef.current]
    if (!el || !isShowManagerTransportReady(getTrackAudioTrackId(track))) return
    el.currentTime = t
    const resolvedTime = el.currentTime
    setCurrentTime(resolvedTime)
    // Discard captured audio so no scope window straddles the jump and renders
    // pre- and post-seek samples as one continuous trace.
    scopeTapRef.current?.reset()
    musicIntelligenceEngine.resolveLyricsAt(resolvedTime, 'discontinuous')
  }, [])

  // Stable getter — reads audioRef directly so it is safe to call every RAF frame
  // without touching React state. Falls back to currentTimeRef when no element exists.
  const getCurrentTime = useCallback((): number => {
    return audioRef.current?.currentTime ?? currentTimeRef.current
  }, [])  // intentionally empty: only reads refs, never stale
  const setVolume = useCallback((v: number) => setVolumeState(v), [])

  const isActive = (source === 'file' && isPlaying) || source === 'microphone' || source === 'demo'

  let currentEffectiveBpm:  number | null = null
  let currentBpmSource:     BpmSource | null = null
  let currentBpmConfidence: number | null = null

  if (source === 'demo') {
    currentEffectiveBpm = 120
    currentBpmSource    = 'live_analysis'
  } else if (source === 'file' && currentTrack) {
    const { bpmOverride, bpmOverrideSource, analysis, gridStale } = currentTrack.analysisRuntime
    if (gridStale && analysis !== null) {
      currentEffectiveBpm = analysis.bpmUsedForGrid ?? analysis.bpm
      currentBpmSource = 'offline_analysis'
      currentBpmConfidence = analysis.bpmConfidence
    } else if (bpmOverride !== null && bpmOverrideSource !== null) {
      currentEffectiveBpm  = bpmOverride
      currentBpmSource     = bpmOverrideSource
      currentBpmConfidence = analysis?.bpmConfidence ?? null
    } else if (analysis !== null) {
      currentEffectiveBpm  = analysis.bpmUsedForGrid ?? analysis.bpm
      currentBpmSource     = currentTrack.externalMetadata?.source?.startsWith('rekordbox') && currentTrack.externalMetadata.bpm != null
        ? 'rekordbox'
        : 'offline_analysis'
      currentBpmConfidence = analysis.bpmConfidence
    }
    // No analysis and no override → null; never expose 120 as a track-derived value
  }
  // microphone: live BPM is published through AudioFeatureBus each frame, not React state

  // ── Sync MI engine BPM and beat grid from the canonical effective BPM ────────
  // Fires whenever effective BPM, confidence, override state, track identity,
  // or analysis status changes.
  //
  // When a manual override is active:
  //   - MI engine receives the regenerated beat markers (setEffectiveBpm).
  //   - The per-track effectiveBeatGrid runtime field is populated so the Track
  //     Map can draw beat lines at the override BPM instead of the stale
  //     analyzed grid.
  // When override is cleared:
  //   - MI engine markers are restored from the original analysis.
  //   - effectiveBeatGrid is set to null so the Track Map falls back to
  //     analysis.beatGrid / analysis.downbeats.
  // Analysis-complete re-fires (via currentAnalysisStatus dep) so an override
  // set before analysis finishes picks up the real beatGridOffsetSec once
  // analysis lands, correcting the phase anchor.
  useEffect(() => {
    if (source !== 'file' || !currentTrack) return

    const runtime    = currentTrack.analysisRuntime
    const analysis   = runtime.analysis
    const trackId    = currentTrack.id
    const hasOverride = runtime.bpmOverride !== null

    // Keep the previous complete analysis snapshot live while BPM/grid work is pending.
    // The reanalysis commit publishes grid, sections, phrases, and moments together.
    if (runtime.gridStale) return

    if (currentEffectiveBpm === null || currentEffectiveBpm <= 0) {
      musicIntelligenceEngine.setBpm(0, 0)
      if (runtime.effectiveBeatGrid !== null) {
        updateTrackRuntime(trackId, { effectiveBeatGrid: null })
      }
      return
    }

    if (hasOverride) {
      // Use the real analyzed offset when available; fall back to 0 until
      // analysis completes (effect re-runs on status change).
      const offsetSec   = analysis?.beatGridOffsetSec ?? 0
      const durationSec = currentTrack.duration

      if (analysis) {
        musicIntelligenceEngine.setEffectiveBpm(
          currentEffectiveBpm, currentBpmConfidence ?? 0.8, offsetSec, durationSec,
        )
      } else {
        // No analysis yet — set BPM only; markers will be (re-)applied when
        // analysis completes and this effect fires again.
        musicIntelligenceEngine.setBpm(currentEffectiveBpm, currentBpmConfidence ?? 0.8)
      }

      // Regenerate the Track Map beat grid from the same BPM + offset so both
      // the visual engine and the canvas always draw identical timing.
      const existingPhase = analysis?.musicalGrid?.downbeatPhase
        ?? analysis?.beatGrid.findIndex(marker => marker.isDownbeat)
        ?? 0
      const effectiveBeatGrid = buildEffectiveBeatGrid(
        currentEffectiveBpm,
        durationSec,
        offsetSec,
        analysis?.timeSignature ?? 4,
        existingPhase >= 0 ? existingPhase : 0,
      )
      updateTrackRuntime(trackId, { effectiveBeatGrid })
    } else if (analysis) {
      // Override cleared — restore original analyzed markers and wipe the
      // override grid so the Track Map reverts to analysis.beatGrid.
      musicIntelligenceEngine.restoreAnalysisMarkers()
      musicIntelligenceEngine.setBpm(currentEffectiveBpm, currentBpmConfidence ?? 0.8)
      if (runtime.effectiveBeatGrid !== null) {
        updateTrackRuntime(trackId, { effectiveBeatGrid: null })
      }
    } else {
      // No override, no analysis — just signal the BPM.
      musicIntelligenceEngine.setBpm(currentEffectiveBpm, currentBpmConfidence ?? 0.8)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, currentEffectiveBpm, currentBpmConfidence, currentTrackId,
      currentTrack?.analysisRuntime.bpmOverride, currentTrack?.analysisRuntime.gridStale, currentTrack?.duration,
      currentAnalysisStatus])

  const currentKey = currentAnalysis?.harmonic.dominantKey
    ? {
        tonic:      currentAnalysis.harmonic.dominantKey,
        mode:       currentAnalysis.harmonic.dominantMode ?? 'major',
        confidence: currentAnalysis.harmonic.keyConfidence ?? 0,
      }
    : null

  return {
    source, setSource, micError, isActive,
    tracks, currentIndex, isPlaying, currentTime, getCurrentTime, duration, volume,
    addTracks, replaceTracks, addPreparedTracks, replacePreparedTracks, addTrackUrls, replaceTrackUrls, removeTrack, selectTrack, play, pause, stop, next, prev, seek, setVolume,
    analyserMaster: aMasterRef.current,
    analyserL: aLRef.current,
    analyserR: aRRef.current,
    audioContext: ctxRef.current,
    sampleRate: ctxRef.current?.sampleRate ?? 44100,
    fftSize, setFftSize, smoothing, setSmoothing,
    ringBuffer: ringBufRef.current,
    scopeStereoTap: scopeTapRef.current,
    monitoringMode, setMonitoringMode,
    referenceTracks, activeRefSlot, setActiveRefSlot,
    isABMode, setABMode,
    refVolume, setRefVolume,
    autoLoudnessMatch, setAutoLoudnessMatch,
    addReferenceTrack, removeReferenceTrack,
    refAnalyserMaster: refAnalyserMRef.current,
    refAnalyserL: refALRef.current,
    refAnalyserR: refARRef.current,
    spectralFeatures, spectralFeaturesRef,
    meydaActive, startSpectralAnalysis, stopSpectralAnalysis,
    demoSilent, setDemoSilent,
    getRecordingStream,
    musicIntelligenceEngine,
    getDecodedBuffer: (trackId: string) => coordinatorRef.current?.getDecodedBuffer(trackId),
    currentTrackId, currentAudioTrackId, currentTrackIsPersisted, currentTrack, currentAnalysis,
    currentAnalysisStatus, currentAnalysisError,
    currentAnalyzedBpm, currentEffectiveBpm, currentBpmConfidence, currentBpmSource,
    currentEffectiveBeatGrid: currentTrack?.analysisRuntime.effectiveBeatGrid ?? null,
    currentKey,
    updateTrackRuntime, setBpmOverride, retryAnalysis, reanalyzeTrack,
    reanalyzeWithBpmOverride,
    currentBpmReanalysisStatus: (currentTrack?.analysisRuntime.bpmReanalysisStatus ?? 'idle') as BpmReanalysisStatus,
  }
}
