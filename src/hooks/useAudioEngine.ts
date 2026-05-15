import { useRef, useState, useCallback, useEffect } from 'react'
import { Track } from '../types'
import { generateId, getFilenameWithoutExtension } from '../utils/audioUtils'

export interface AudioEngine {
  tracks: Track[]
  currentIndex: number
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  analyserMaster: AnalyserNode | null
  audioRef: React.RefObject<HTMLAudioElement | null>
  addTracks: (files: File[]) => void
  removeTrack: (id: string) => void
  selectTrack: (index: number) => void
  play: () => void
  pause: () => void
  stop: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setVolume: (v: number) => void
}

export function useAudioEngine(): AudioEngine {
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)

  // Single AudioContext + nodes — created lazily on first interaction
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const splitterRef = useRef<ChannelSplitterNode | null>(null)
  const analyserLRef = useRef<AnalyserNode | null>(null)
  const analyserRRef = useRef<AnalyserNode | null>(null)
  const analyserMasterRef = useRef<AnalyserNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Create the <audio> element once
  useEffect(() => {
    const el = new Audio()
    el.crossOrigin = 'anonymous'
    el.volume = volume
    audioRef.current = el

    el.addEventListener('timeupdate', () => setCurrentTime(el.currentTime))
    el.addEventListener('durationchange', () => setDuration(el.duration || 0))
    el.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentIndex(i => {
        if (i < 0) return i
        // auto-advance handled via effect below
        return i
      })
    })

    return () => {
      el.pause()
      el.src = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-advance when track ends
  const handleEnded = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev + 1
      return next < tracks.length ? next : prev
    })
    setIsPlaying(true)
  }, [tracks.length])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.addEventListener('ended', handleEnded)
    return () => el.removeEventListener('ended', handleEnded)
  }, [handleEnded])

  // Initialise AudioContext + nodes lazily (browser requires user gesture)
  const ensureContext = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
      return
    }
    const ctx = new AudioContext()
    ctxRef.current = ctx

    const el = audioRef.current!
    // Single MediaElementSourceNode per element
    const source = ctx.createMediaElementSource(el)
    sourceRef.current = source

    // Stereo splitter for L/R meters
    const splitter = ctx.createChannelSplitter(2)
    splitterRef.current = splitter

    // Per-channel analysers
    const aL = ctx.createAnalyser()
    aL.fftSize = 1024
    aL.smoothingTimeConstant = 0.8
    analyserLRef.current = aL

    const aR = ctx.createAnalyser()
    aR.fftSize = 1024
    aR.smoothingTimeConstant = 0.8
    analyserRRef.current = aR

    // Master analyser for spectrum + scope
    const aMaster = ctx.createAnalyser()
    aMaster.fftSize = 2048
    aMaster.smoothingTimeConstant = 0.8
    analyserMasterRef.current = aMaster

    // Graph: source → splitter → L/R analysers (monitoring only)
    //        source → master analyser → destination
    source.connect(splitter)
    splitter.connect(aL, 0)
    splitter.connect(aR, 1)

    source.connect(aMaster)
    aMaster.connect(ctx.destination)
  }, [])

  // Load track into audio element when currentIndex changes
  useEffect(() => {
    const el = audioRef.current
    if (!el || currentIndex < 0 || currentIndex >= tracks.length) return

    el.src = tracks[currentIndex].url
    el.load()

    if (isPlaying) {
      ensureContext()
      el.play().catch(() => setIsPlaying(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, tracks])

  // Keep audio element volume in sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const addTracks = useCallback((files: File[]) => {
    const newTracks: Track[] = files.map(f => ({
      id: generateId(),
      name: f.name,
      displayName: getFilenameWithoutExtension(f.name),
      url: URL.createObjectURL(f),
      duration: 0,
    }))
    setTracks(prev => {
      const updated = [...prev, ...newTracks]
      // auto-select first track if none selected
      if (prev.length === 0) setCurrentIndex(0)
      return updated
    })
  }, [])

  const removeTrack = useCallback((id: string) => {
    setTracks(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const track = prev[idx]
      if (track) URL.revokeObjectURL(track.url)
      const next = prev.filter(t => t.id !== id)
      setCurrentIndex(ci => {
        if (ci === idx) return Math.min(ci, next.length - 1)
        if (ci > idx) return ci - 1
        return ci
      })
      return next
    })
  }, [])

  const selectTrack = useCallback((index: number) => {
    setCurrentIndex(index)
    setIsPlaying(true)
    ensureContext()
  }, [ensureContext])

  const play = useCallback(() => {
    const el = audioRef.current
    if (!el || currentIndex < 0) return
    ensureContext()
    el.play().then(() => setIsPlaying(true)).catch(() => {})
  }, [currentIndex, ensureContext])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [])

  const stop = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
    setIsPlaying(false)
    setCurrentTime(0)
  }, [])

  const next = useCallback(() => {
    setCurrentIndex(i => Math.min(i + 1, tracks.length - 1))
    setIsPlaying(true)
    ensureContext()
  }, [tracks.length, ensureContext])

  const prev = useCallback(() => {
    setCurrentIndex(i => Math.max(i - 1, 0))
    setIsPlaying(true)
    ensureContext()
  }, [ensureContext])

  const seek = useCallback((time: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = time
    setCurrentTime(time)
  }, [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
  }, [])

  return {
    tracks,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    analyserL: analyserLRef.current,
    analyserR: analyserRRef.current,
    analyserMaster: analyserMasterRef.current,
    audioRef,
    addTracks,
    removeTrack,
    selectTrack,
    play,
    pause,
    stop,
    next,
    prev,
    seek,
    setVolume,
  }
}
