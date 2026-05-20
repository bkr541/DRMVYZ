import { useRef, useState, useCallback, useEffect } from 'react'
import { Track, AudioSource, FftSize } from '../types'
import { generateId, getFilenameWithoutExtension } from '../utils/audioUtils'
import { buildMonitoringChain, type MonitoringChain } from '../audio/routing'
import type { MonitoringMode, ReferenceTrack, SpectralFeatures } from '../types/audio'
import { analyze as analyzeBPM } from 'web-audio-beat-detector'
import Meyda from 'meyda'

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
  setSource: (s: AudioSource) => Promise<void>
  micError: string | null
  isActive: boolean

  tracks: Track[]
  currentIndex: number
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  addTracks: (files: File[]) => void
  replaceTracks: (files: File[]) => void
  removeTrack: (id: string) => void
  selectTrack: (i: number) => void
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

  // Demo mode
  demoSilent: boolean
  setDemoSilent: (v: boolean) => void

  // Meyda spectral features
  spectralFeatures: SpectralFeatures | null
  bpmDetecting: boolean
  detectBPM: () => Promise<void>
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
  const [bpmDetecting, setBpmDetecting] = useState(false)
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

  // Ring buffer
  const ringBufRef       = useRef<RingBuffer | null>(null)
  const scriptProcRef    = useRef<ScriptProcessorNode | null>(null)

  const audioRef         = useRef<HTMLAudioElement | null>(null)
  const activeSourceNodeRef = useRef<AudioNode | null>(null)
  const meydaRef         = useRef<ReturnType<typeof Meyda.createMeydaAnalyzer> | null>(null)

  // ── Init main audio element ─────────────────────────────────────────────────
  useEffect(() => {
    const el = new Audio()
    el.crossOrigin = 'anonymous'
    el.volume = volume
    audioRef.current = el
    el.addEventListener('timeupdate', () => setCurrentTime(el.currentTime))
    el.addEventListener('durationchange', () => setDuration(el.duration || 0))
    return () => { el.pause(); el.src = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setIsPlaying(true)
      return prev + 1 < tracks.length ? prev + 1 : prev
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

    // Ring buffer capture
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    ringBufRef.current = new RingBuffer(ctx.sampleRate, 60)
    proc.onaudioprocess = (e) => {
      ringBufRef.current?.write(e.inputBuffer.getChannelData(0))
    }
    masterGain.connect(proc)
    proc.connect(ctx.destination)
    scriptProcRef.current = proc

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

    // Meyda for spectral features
    try {
      const meyda = Meyda.createMeydaAnalyzer({
        audioContext: ctx,
        source: masterGain as unknown as AudioNode,
        bufferSize: 512,
        featureExtractors: ['rms', 'spectralCentroid', 'spectralSpread', 'spectralRolloff', 'spectralFlatness'],
        callback: (features: Record<string, number>) => {
          setSpectralFeatures({
            centroid: features.spectralCentroid ?? 0,
            spread: features.spectralSpread ?? 0,
            rolloff: features.spectralRolloff ?? 0,
            flatness: features.spectralFlatness ?? 0,
            bpm: null,
          })
        },
      })
      meyda.start()
      meydaRef.current = meyda
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

  const setSource = useCallback(async (s: AudioSource) => {
    disconnectSource()
    if (masterGainRef.current) masterGainRef.current.gain.value = 1
    if (s === 'file') { if (currentIndex >= 0) connectFileSource() }
    else if (s === 'microphone') { await connectMicSource() }
    else {
      connectDemoSource()
      // Apply current demoSilent state to mute node
      if (muteGainRef.current) muteGainRef.current.gain.value = demoSilent ? 0 : 1
    }
    setSourceState(s)
    setIsPlaying(s === 'demo')
  }, [disconnectSource, connectFileSource, connectMicSource, connectDemoSource, currentIndex, demoSilent])

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

  // ── BPM detection ────────────────────────────────────────────────────────────
  const detectBPM = useCallback(async () => {
    if (currentIndex < 0 || currentIndex >= tracks.length) return
    setBpmDetecting(true)
    try {
      const ctx = ensureContext()
      const response = await fetch(tracks[currentIndex].url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const bpm = await analyzeBPM(audioBuffer)
      setSpectralFeatures(prev =>
        prev ? { ...prev, bpm } : { centroid: 0, spread: 0, rolloff: 0, flatness: 0, bpm }
      )
    } catch { /**/ }
    setBpmDetecting(false)
  }, [currentIndex, tracks, ensureContext])

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

  // ── Playlist ─────────────────────────────────────────────────────────────────
  const addTracks = useCallback((files: File[]) => {
    const newTracks: Track[] = files.map(f => ({
      id: generateId(), name: f.name,
      displayName: getFilenameWithoutExtension(f.name),
      url: URL.createObjectURL(f), duration: 0,
    }))
    setTracks(prev => {
      if (prev.length === 0) setCurrentIndex(0)
      return [...prev, ...newTracks]
    })
  }, [])

  const replaceTracks = useCallback((files: File[]) => {
    const newTracks: Track[] = files.map(f => ({
      id: generateId(), name: f.name,
      displayName: getFilenameWithoutExtension(f.name),
      url: URL.createObjectURL(f), duration: 0,
    }))
    setTracks(prev => {
      prev.forEach(t => URL.revokeObjectURL(t.url))
      setCurrentIndex(newTracks.length > 0 ? 0 : -1)
      return newTracks
    })
  }, [])

  const removeTrack = useCallback((id: string) => {
    setTracks(prev => {
      const idx = prev.findIndex(t => t.id === id)
      if (idx >= 0) URL.revokeObjectURL(prev[idx].url)
      const next = prev.filter(t => t.id !== id)
      setCurrentIndex(ci => {
        if (ci === idx) return Math.min(ci, next.length - 1)
        if (ci > idx) return ci - 1
        return ci
      })
      return next
    })
  }, [])

  const selectTrack = useCallback((i: number) => {
    setCurrentIndex(i); setIsPlaying(true)
    connectFileSource()
    const ctx = ensureContext()
    if (ctx.state === 'suspended') ctx.resume()
  }, [connectFileSource, ensureContext])

  const play = useCallback(() => {
    const el = audioRef.current
    if (!el || currentIndex < 0) return
    connectFileSource()
    const ctx = ensureContext()
    if (ctx.state === 'suspended') ctx.resume()
    el.play().then(() => setIsPlaying(true)).catch(() => { /**/ })
  }, [currentIndex, connectFileSource, ensureContext])

  const pause  = useCallback(() => { audioRef.current?.pause(); setIsPlaying(false) }, [])
  const stop   = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    el.pause(); el.currentTime = 0; setIsPlaying(false); setCurrentTime(0)
  }, [])
  const next   = useCallback(() => {
    if (currentIndex < tracks.length - 1) { setCurrentIndex(i => i + 1); setIsPlaying(true); connectFileSource() }
  }, [currentIndex, tracks.length, connectFileSource])
  const prev   = useCallback(() => {
    if (currentIndex > 0) { setCurrentIndex(i => i - 1); setIsPlaying(true); connectFileSource() }
  }, [currentIndex, connectFileSource])
  const seek   = useCallback((t: number) => {
    const el = audioRef.current; if (!el) return
    el.currentTime = t; setCurrentTime(t)
  }, [])
  const setVolume = useCallback((v: number) => setVolumeState(v), [])

  const isActive = (source === 'file' && isPlaying) || source === 'microphone' || source === 'demo'

  return {
    source, setSource, micError, isActive,
    tracks, currentIndex, isPlaying, currentTime, duration, volume,
    addTracks, replaceTracks, removeTrack, selectTrack, play, pause, stop, next, prev, seek, setVolume,
    analyserMaster: aMasterRef.current,
    analyserL: aLRef.current,
    analyserR: aRRef.current,
    audioContext: ctxRef.current,
    sampleRate: ctxRef.current?.sampleRate ?? 44100,
    fftSize, setFftSize, smoothing, setSmoothing,
    ringBuffer: ringBufRef.current,
    monitoringMode, setMonitoringMode,
    referenceTracks, activeRefSlot, setActiveRefSlot,
    isABMode, setABMode,
    refVolume, setRefVolume,
    autoLoudnessMatch, setAutoLoudnessMatch,
    addReferenceTrack, removeReferenceTrack,
    refAnalyserMaster: refAnalyserMRef.current,
    refAnalyserL: refALRef.current,
    refAnalyserR: refARRef.current,
    spectralFeatures, bpmDetecting, detectBPM,
    demoSilent, setDemoSilent,
  }
}
