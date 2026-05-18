import { useState, useRef, useId, useEffect, useCallback } from 'react'
import { AnalyzerSidebar } from '../analyzer/AnalyzerSidebar'

// ── Types ─────────────────────────────────────────────────────────────
interface RefLoudness {
  lufs: number; truePeak: number; dynamicRange: number; crestFactor: number
}
interface RefStereo {
  correlation: number; width: number; balance: number
}
interface RefBands {
  lf: number; lmf: number; mf: number; hmf: number; hf: number
}
interface RefTrack {
  id: string
  role: 'main' | 'reference'
  refIndex?: number
  title: string
  artist: string
  fileName: string
  format: string
  sampleRate: string
  bitDepth: string
  duration: number
  accentColor: string
  waveformData: number[]
  spectrumData: number[]
  loudness: RefLoudness
  stereo: RefStereo
  bands: RefBands
  url: string
}

// Accent: main=cyan, ref01=purple, ref02=slate, ref03=orange
const SLOT_COLORS = ['#19bff2', '#a78bfa', '#94a3b8', '#fb923c']

// ── Mock data ─────────────────────────────────────────────────────────
function strHash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}
function seededRng(seed: number) {
  let s = seed >>> 0
  return (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF }
}
function generateMockAnalysis(file: File, role: 'main' | 'reference', refIndex?: number): RefTrack {
  const hash = strHash(file.name + file.size)
  const rng  = seededRng(hash)
  const waveformData = Array.from({ length: 200 }, (_, i) => {
    const env = Math.abs(Math.sin(i * 0.05 + hash * 0.00001)) * 0.7 + 0.3
    return Math.min(1, rng() * env)
  })
  const spectrumData = Array.from({ length: 64 }, (_, i) => {
    const shape = Math.exp(-i * 0.022) * 0.72 + 0.12
    return Math.min(1, rng() * 0.32 + shape)
  })
  const slotIdx = role === 'main' ? 0 : (refIndex ?? 1)
  return {
    id: `track-${hash.toString(36)}`,
    role, refIndex,
    title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    artist: '—',
    fileName: file.name,
    format: (file.name.split('.').pop() ?? 'audio').toUpperCase(),
    sampleRate: '44.1 kHz',
    bitDepth: '24-bit',
    duration: 180 + (hash % 120),
    accentColor: SLOT_COLORS[slotIdx],
    waveformData, spectrumData,
    loudness: {
      lufs: -12 - rng() * 6,
      truePeak: -(rng() * 2 + 0.3),
      dynamicRange: 5 + rng() * 9,
      crestFactor: 7 + rng() * 7,
    },
    stereo: { correlation: 0.55 + rng() * 0.45, width: 30 + rng() * 60, balance: rng() * 8 - 4 },
    bands: {
      lf: 0.2 + rng() * 0.65, lmf: 0.3 + rng() * 0.55, mf: 0.35 + rng() * 0.5,
      hmf: 0.25 + rng() * 0.55, hf: 0.12 + rng() * 0.58,
    },
    url: URL.createObjectURL(file),
  }
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
function isAudio(f: File): boolean {
  return f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
}

// ── WaveformCanvas ────────────────────────────────────────────────────
function WaveformCanvas({ data, accentColor, height = 60 }: {
  data: number[]; accentColor: string; height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function draw() {
      if (!canvas) return
      const W = canvas.offsetWidth
      if (W === 0) return
      const dpr = devicePixelRatio
      canvas.width  = Math.round(W * dpr)
      canvas.height = Math.round(height * dpr)
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const midY = canvas.height / 2
      const barW = canvas.width / data.length
      const gap  = barW > 2.5 ? dpr : 0
      ctx.fillStyle = accentColor
      ctx.globalAlpha = 0.75
      data.forEach((val, i) => {
        const bh = Math.max(dpr, val * canvas.height * 0.9)
        ctx.fillRect(i * barW, midY - bh / 2, Math.max(dpr, barW - gap), bh)
      })
      ctx.globalAlpha = 1
    }
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    draw()
    return () => ro.disconnect()
  }, [data, accentColor, height])
  return <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
}

// Waveform + time ruler
function WaveformWithRuler({ data, accentColor, height = 64, duration }: {
  data: number[]; accentColor: string; height?: number; duration: number
}) {
  const marks = [0, 0.25, 0.5, 0.75, 1].map(f => fmtDur(duration * f))
  return (
    <div className="ref-waveform-wrap">
      <WaveformCanvas data={data} accentColor={accentColor} height={height} />
      <div className="ref-waveform-ruler">
        {marks.map((m, i) => <span key={i} className="ref-ruler-tick">{m}</span>)}
      </div>
    </div>
  )
}

// ── SpectrumMini ──────────────────────────────────────────────────────
function SpectrumMini({ data, accentColor, height = 48 }: {
  data: number[]; accentColor: string; height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function draw() {
      if (!canvas) return
      const W = canvas.offsetWidth
      if (W === 0) return
      const dpr = devicePixelRatio
      canvas.width  = Math.round(W * dpr)
      canvas.height = Math.round(height * dpr)
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cW = canvas.width, cH = canvas.height
      ctx.beginPath()
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * cW
        const y = cH - val * cH * 0.88
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()
      ctx.lineTo(cW, cH); ctx.lineTo(0, cH); ctx.closePath()
      const grad = ctx.createLinearGradient(0, 0, 0, cH)
      grad.addColorStop(0, accentColor + '50')
      grad.addColorStop(1, accentColor + '00')
      ctx.fillStyle = grad
      ctx.fill()
      // Freq axis labels
      ctx.fillStyle = 'rgba(245,248,250,0.22)'
      ctx.font = `${6 * dpr}px monospace`
      const freqLabels = ['20', '100', '1k', '10k', '20k']
      const freqPos    = [0, 0.12, 0.38, 0.7, 0.97]
      freqLabels.forEach((lbl, i) => {
        ctx.fillText(lbl, freqPos[i] * cW + 1, cH - 2)
      })
    }
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    draw()
    return () => ro.disconnect()
  }, [data, accentColor, height])
  return <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
}

// ── StereoMini (vectorscope) ──────────────────────────────────────────
function StereoMini({ correlation, width, accentColor, size = 60 }: {
  correlation: number; width: number; accentColor: string; size?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = devicePixelRatio
    canvas.width  = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    canvas.style.width  = `${size}px`
    canvas.style.height = `${size}px`
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const cW = canvas.width, cH = canvas.height
    const cx = cW / 2, cy = cH / 2
    const r  = Math.min(cx, cy) - 3 * dpr

    // Outer circle
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = dpr
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    // Crosshairs
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.beginPath()
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r)
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy)
    ctx.stroke()
    // Diagonal guides
    const d = r * 0.707
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.beginPath()
    ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d)
    ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d)
    ctx.stroke()

    // Ellipse blob (45° rotation = vectorscope orientation)
    const sX = Math.max(2, (width / 100) * r * 0.78)
    const sY = Math.max(2, Math.abs(correlation) * r * 0.78)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-Math.PI / 4)
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(sX, sY))
    grad.addColorStop(0, accentColor + 'cc')
    grad.addColorStop(0.5, accentColor + '66')
    grad.addColorStop(1, accentColor + '08')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(0, 0, sX, sY, 0, 0, Math.PI * 2)
    ctx.fill()
    // Scatter dots
    const rng = seededRng(Math.round(correlation * 1000 + width * 100))
    ctx.fillStyle = accentColor
    for (let i = 0; i < 18; i++) {
      const a = rng() * Math.PI * 2
      const len = rng() * Math.min(sX, sY) * 0.9
      const px = Math.cos(a) * (len * (sX / Math.max(sX, sY)))
      const py = Math.sin(a) * (len * (sY / Math.max(sX, sY)))
      ctx.globalAlpha = 0.5 + rng() * 0.5
      ctx.beginPath()
      ctx.arc(px, py, 0.8 * dpr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.restore()

    // L / R / ±1 labels
    ctx.fillStyle = 'rgba(245,248,250,0.3)'
    ctx.font = `${6.5 * dpr}px monospace`
    ctx.fillText('L', 2, cy + 3)
    ctx.fillText('R', cW - 8 * dpr, cy + 3)
    ctx.fillStyle = 'rgba(245,248,250,0.18)'
    ctx.font = `${5.5 * dpr}px monospace`
    ctx.fillText('-1', 2, cH - 2)
    ctx.fillText('+1', cW - 12 * dpr, cH - 2)
  }, [correlation, width, accentColor, size])
  return <canvas ref={canvasRef} style={{ display: 'block', flexShrink: 0 }} />
}

// ── Band bars (vertical segmented columns) ────────────────────────────
const BAND_SEGS = 7
function BandBarsV({ bands, accentColor }: { bands: RefBands; accentColor: string }) {
  const entries: [string, number][] = [
    ['LF', bands.lf], ['LMF', bands.lmf], ['MF', bands.mf], ['HMF', bands.hmf], ['HF', bands.hf],
  ]
  return (
    <div className="ref-bands-v">
      {entries.map(([label, val]) => (
        <div key={label} className="ref-bandv-col">
          <div className="ref-bandv-segs">
            {Array.from({ length: BAND_SEGS }, (_, j) => {
              // segs from top (j=0 = top = highest threshold)
              const threshold = (BAND_SEGS - j) / BAND_SEGS
              const lit = val >= threshold
              return (
                <div
                  key={j}
                  className="ref-bandv-seg"
                  style={{
                    background: lit ? accentColor : 'rgba(255,255,255,0.06)',
                    opacity: lit ? 0.6 + (j / BAND_SEGS) * 0.4 : 1,
                  }}
                />
              )
            })}
          </div>
          <span className="ref-bandv-label">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Loudness stats ────────────────────────────────────────────────────
function LoudnessStats({ loudness }: { loudness: RefLoudness }) {
  const lufsOk  = loudness.lufs >= -23 && loudness.lufs <= -6
  const peakOk  = loudness.truePeak <= -1
  const rows: [string, string, string][] = [
    ['LUFS',       `${loudness.lufs.toFixed(1)}`,         lufsOk  ? 'ok' : 'warn'],
    ['TRUE PEAK',  `${loudness.truePeak.toFixed(1)} dBTP`, peakOk ? 'ok' : 'crit'],
    ['DYN RANGE',  `${loudness.dynamicRange.toFixed(1)} dB`, 'ok'],
    ['CREST',      `${loudness.crestFactor.toFixed(1)} dB`,  'ok'],
  ]
  return (
    <div className="ref-stats">
      {rows.map(([label, val, status]) => (
        <div key={label} className="ref-stat-row">
          <span className="ref-stat-label">{label}</span>
          <span className={`ref-stat-val ref-stat-val--${status}`}>{val}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main card content ─────────────────────────────────────────────────
function MainCardContent({ track }: { track: RefTrack }) {
  return (
    <div className="ref-main-content">
      {/* Top: artwork + title/meta */}
      <div className="ref-main-top">
        <div className="ref-main-art" style={{ borderColor: track.accentColor + '30' }}>
          <span className="ref-main-art-letter" style={{ color: track.accentColor }}>
            {track.title[0]?.toUpperCase() ?? '♪'}
          </span>
        </div>
        <div className="ref-card-meta">
          <div className="ref-card-title">{track.title}</div>
          <div className="ref-card-artist">{track.artist}</div>
          <div className="ref-card-tags">
            <span className="ref-card-tag">{track.format}</span>
            <span className="az-spacer-dot" />
            <span className="ref-card-tag">{track.sampleRate}</span>
            <span className="az-spacer-dot" />
            <span className="ref-card-tag">{track.bitDepth}</span>
            <span className="az-spacer-dot" />
            <span className="ref-card-tag">{fmtDur(track.duration)}</span>
          </div>
        </div>
      </div>

      {/* Full-width waveform */}
      <WaveformWithRuler
        data={track.waveformData} accentColor={track.accentColor}
        height={78} duration={track.duration}
      />

      {/* Bottom 4-column strip */}
      <div className="ref-main-bottom">
        <div className="ref-main-bottom-cell">
          <SpectrumMini data={track.spectrumData} accentColor={track.accentColor} height={58} />
        </div>
        <div className="ref-main-bottom-cell">
          <div className="ref-section-label">LOUDNESS</div>
          <LoudnessStats loudness={track.loudness} />
        </div>
        <div className="ref-main-bottom-cell ref-main-bottom-cell--center">
          <div className="ref-section-label">STEREO</div>
          <StereoMini correlation={track.stereo.correlation} width={track.stereo.width} accentColor={track.accentColor} size={68} />
        </div>
        <div className="ref-main-bottom-cell">
          <div className="ref-section-label">BANDS</div>
          <BandBarsV bands={track.bands} accentColor={track.accentColor} />
        </div>
      </div>
    </div>
  )
}

// ── Ref card content ──────────────────────────────────────────────────
function RefCardContent({ track }: { track: RefTrack }) {
  return (
    <div className="ref-ref-content">
      {/* Compact top: small art + meta */}
      <div className="ref-ref-top">
        <div className="ref-ref-art" style={{ borderColor: track.accentColor + '30' }}>
          <span className="ref-ref-art-letter" style={{ color: track.accentColor }}>
            {track.title[0]?.toUpperCase() ?? '♪'}
          </span>
        </div>
        <div className="ref-card-meta">
          <div className="ref-card-title ref-card-title--sm">{track.title}</div>
          <div className="ref-card-artist ref-card-artist--sm">{track.artist}</div>
          <div className="ref-card-tags">
            <span className="ref-card-tag">{track.format}</span>
            <span className="az-spacer-dot" />
            <span className="ref-card-tag">{track.sampleRate}</span>
            <span className="az-spacer-dot" />
            <span className="ref-card-tag">{track.bitDepth}</span>
            <span className="az-spacer-dot" />
            <span className="ref-card-tag">{fmtDur(track.duration)}</span>
          </div>
        </div>
        <button className="ref-card-options">···</button>
      </div>

      {/* Waveform */}
      <WaveformWithRuler
        data={track.waveformData} accentColor={track.accentColor}
        height={56} duration={track.duration}
      />

      {/* Bottom 4-column */}
      <div className="ref-ref-bottom">
        <div className="ref-ref-bottom-cell">
          <SpectrumMini data={track.spectrumData} accentColor={track.accentColor} height={50} />
        </div>
        <div className="ref-ref-bottom-cell">
          <div className="ref-section-label">LOUDNESS</div>
          <LoudnessStats loudness={track.loudness} />
        </div>
        <div className="ref-ref-bottom-cell ref-ref-bottom-cell--center">
          <div className="ref-section-label">STEREO</div>
          <StereoMini correlation={track.stereo.correlation} width={track.stereo.width} accentColor={track.accentColor} size={56} />
        </div>
        <div className="ref-ref-bottom-cell">
          <div className="ref-section-label">BANDS</div>
          <BandBarsV bands={track.bands} accentColor={track.accentColor} />
        </div>
      </div>
    </div>
  )
}

// ── Empty slot ────────────────────────────────────────────────────────
function EmptySlot({ onUpload, isMain }: { onUpload: (f: File[]) => void; isMain?: boolean }) {
  const fileId = useId()
  const [drag, setDrag] = useState(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const files = Array.from(e.dataTransfer.files).filter(isAudio)
    if (files.length) onUpload(files)
  }
  return (
    <label
      htmlFor={fileId}
      className={`ref-empty-slot ${isMain ? 'ref-empty-slot--main' : ''} ${drag ? 'ref-empty-slot--drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div className="ref-empty-icon">
        <svg viewBox="0 0 24 24" width={isMain ? 26 : 20} height={isMain ? 26 : 20} fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </div>
      <div className="ref-empty-title">{isMain ? 'Upload Main Track' : 'Add Reference Track'}</div>
      <div className="ref-empty-sub">{isMain ? 'Drop your song here' : 'Drop reference here'}</div>
      <div className="ref-empty-formats">WAV · AIFF · MP3 · FLAC</div>
      <input id={fileId} type="file" accept="audio/*" style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files ?? []).filter(isAudio)
          if (files.length) onUpload(files)
          e.target.value = ''
        }}
      />
    </label>
  )
}

// ── Main track card ───────────────────────────────────────────────────
function MainTrackCard({ track, onUpload, onRemove, isSelected, onClick }: {
  track: RefTrack | null; onUpload: (f: File[]) => void; onRemove: () => void
  isSelected: boolean; onClick: () => void
}) {
  if (!track) return <EmptySlot onUpload={onUpload} isMain />
  return (
    <div
      className={`ref-main-card ${isSelected ? 'ref-main-card--selected' : ''}`}
      onClick={onClick}
    >
      <div className="ref-main-card-header">
        <span className="az-spacer" />
        <span className="ref-badge ref-badge--main">MY TRACK</span>
        <button className="ref-card-options" onClick={e => e.stopPropagation()}>···</button>
        <button className="ref-card-remove" onClick={e => { e.stopPropagation(); onRemove() }} title="Remove">✕</button>
      </div>
      <MainCardContent track={track} />
    </div>
  )
}

// ── Reference track card ──────────────────────────────────────────────
function RefTrackCard({ refIndex, track, onUpload, onRemove, isSelected, onClick }: {
  refIndex: 1 | 2 | 3; track: RefTrack | null; onUpload: (f: File[]) => void
  onRemove: () => void; isSelected: boolean; onClick: () => void
}) {
  const label = `REF 0${refIndex}`
  const color = SLOT_COLORS[refIndex]

  if (!track) {
    return (
      <div className="ref-card">
        <div className="ref-card-header">
          <span className="ref-badge" style={{ background: color + '18', color, borderColor: color + '3a' }}>{label}</span>
        </div>
        <EmptySlot onUpload={onUpload} />
      </div>
    )
  }
  return (
    <div
      className={`ref-card ${isSelected ? 'ref-card--selected' : ''}`}
      style={{ '--ref-accent': color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="ref-card-header">
        <span className="ref-badge" style={{ background: color + '18', color, borderColor: color + '3a' }}>{label}</span>
        <span className="az-spacer" />
        <button className="ref-card-options" onClick={e => e.stopPropagation()}>···</button>
        <button className="ref-card-remove" onClick={e => { e.stopPropagation(); onRemove() }} title="Remove">✕</button>
      </div>
      <RefCardContent track={track} />
    </div>
  )
}

// ── Reference top bar ─────────────────────────────────────────────────
function ReferenceTopBar({ trackCount, loudnessMatch, linkedPlayback, viewMode, onToggleLoudness, onToggleLinked, onSetViewMode, onAddReference }: {
  trackCount: number; loudnessMatch: boolean; linkedPlayback: boolean
  viewMode: 'Grid' | 'Overlay' | 'A/B'
  onToggleLoudness: () => void; onToggleLinked: () => void
  onSetViewMode: (m: 'Grid' | 'Overlay' | 'A/B') => void; onAddReference: () => void
}) {
  return (
    <div className="ref-topbar">
      <span className="ref-topbar-title">REFERENCE</span>
      <button className="ref-add-btn" onClick={onAddReference} disabled={trackCount >= 4}>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        Add Reference
      </button>
      <span className="ref-count-pill">{trackCount} / 4 Tracks</span>
      <span className="az-spacer" />
      <label className="ref-toggle">
        <input type="checkbox" checked={loudnessMatch} onChange={onToggleLoudness} />
        <span className="ref-toggle-track"><span className="ref-toggle-thumb" /></span>
        Loudness Match
      </label>
      <label className="ref-toggle">
        <input type="checkbox" checked={linkedPlayback} onChange={onToggleLinked} />
        <span className="ref-toggle-track"><span className="ref-toggle-thumb" /></span>
        Linked Playback
      </label>
      <div className="az-seg-group">
        {(['Grid', 'Overlay', 'A/B'] as const).map(m => (
          <button key={m}
            className={`az-seg-btn ${viewMode === m ? 'az-seg-btn--active' : ''}`}
            onClick={() => onSetViewMode(m)}
          >{m}</button>
        ))}
      </div>
      <button className="az-overflow-btn">···</button>
    </div>
  )
}

// ── Reference match panel ─────────────────────────────────────────────
function ReferenceMatchPanel({ tracks }: { tracks: (RefTrack | null)[] }) {
  const [, r1, r2, r3] = tracks
  const refList = [r1, r2, r3]
  const scores  = refList.map(t => t ? 72 + (strHash(t.id) % 24) : null)
  const valid   = scores.filter((s): s is number => s !== null)
  const avg     = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null
  const C       = 2 * Math.PI * 32

  return (
    <div className="ref-summary-panel">
      <div className="ref-section-label">REFERENCE MATCH</div>
      {avg !== null ? (
        <>
          <div className="ref-match-gauge">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <circle cx="40" cy="40" r="32" fill="none"
                stroke="#19bff2" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${C * avg / 100} ${C}`}
                strokeDashoffset={C * 0.25}
                style={{ filter: 'drop-shadow(0 0 5px rgba(25,191,242,0.7))' }}
              />
              <text x="40" y="37" textAnchor="middle" fill="rgba(245,248,250,0.92)" fontSize="15" fontWeight="300" fontFamily="Inter,sans-serif">{avg}%</text>
              <text x="40" y="50" textAnchor="middle" fill="rgba(245,248,250,0.3)" fontSize="6.5" fontFamily="Inter,sans-serif">Overall Match</text>
            </svg>
          </div>
          <div className="ref-match-bars">
            {scores.map((score, i) => score !== null && (
              <div key={i} className="ref-match-bar-row">
                <span className="ref-match-bar-label">REF 0{i + 1}</span>
                <div className="ref-match-bar-track">
                  <div className="ref-match-bar-fill" style={{ width: `${score}%`, background: SLOT_COLORS[i + 1] }} />
                </div>
                <span className="ref-match-bar-pct">{score}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="ref-summary-empty">Upload tracks to see scores</div>
      )}
      <button className="ref-report-btn">View Full Report</button>
    </div>
  )
}

// ── Smart insights panel (4-column horizontal) ────────────────────────
const INSIGHT_PATHS = [
  'M0,10 C6,2 12,18 18,10 C24,2 30,18 36,10 C42,2 48,18 54,10 C57,4 60,8 60,10',
  'M0,12 L8,5 L16,15 L24,8 L32,14 L40,4 L48,13 L56,7 L60,10',
  'M0,8 Q10,18 20,8 Q30,0 40,10 Q50,18 60,10',
  'M0,10 C4,4 8,16 14,9 C18,4 22,16 28,10 C32,5 36,14 42,10 C46,6 52,15 56,10 L60,10',
]
const INSIGHT_COLS = [
  { label: 'TONAL BALANCE', path: INSIGHT_PATHS[0], text: 'Close match to REF 03. Slightly more energy in 20–120 Hz and 2–4 kHz.' },
  { label: 'LOUDNESS',      path: INSIGHT_PATHS[1], text: 'Your track is 1.1 LU below REF 01. Loudness match is active.' },
  { label: 'STEREO WIDTH',  path: INSIGHT_PATHS[2], text: 'Wider than REF 02, slightly narrower than REF 03.' },
  { label: 'DYNAMICS',      path: INSIGHT_PATHS[3], text: 'Higher dynamic range than REF 01 & REF 03, closer to REF 02.' },
]

function SmartInsightsPanel() {
  return (
    <div className="ref-summary-panel ref-insights-panel">
      <div className="ref-section-label">SMART INSIGHTS</div>
      <div className="ref-insights-grid">
        {INSIGHT_COLS.map(col => (
          <div key={col.label} className="ref-insight-col">
            <div className="ref-insight-col-label">{col.label}</div>
            <svg viewBox="0 0 60 20" width="100%" height="18" preserveAspectRatio="none" style={{ display: 'block' }}>
              <path d={col.path} fill="none" stroke="var(--az-cyan)" strokeWidth="1.4" opacity="0.65" />
            </svg>
            <p className="ref-insight-col-text">{col.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Target range panel ────────────────────────────────────────────────
function TargetRangePanel() {
  const rows: [string, string][] = [
    ['LUFS',        '-11.0 ± 1.0'],
    ['TRUE PEAK',   '-1.0 dBTP'],
    ['DYN. RANGE',  '8–12 dB'],
    ['STEREO CORR.','0.00 ± 0.2'],
  ]
  return (
    <div className="ref-summary-panel">
      <div className="ref-section-label">TARGET RANGE</div>
      <div className="ref-target-rows">
        {rows.map(([label, val]) => (
          <div key={label} className="ref-target-row">
            <span className="ref-target-label">{label}</span>
            <span className="ref-target-val">{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bottom dock ───────────────────────────────────────────────────────
function RefBottomDock({ selected, isPlaying, currentTime, onPlay, onPause, onStop }: {
  selected: RefTrack | null; isPlaying: boolean; currentTime: number
  onPlay: () => void; onPause: () => void; onStop: () => void
}) {
  const accent  = selected?.accentColor ?? '#19bff2'
  const initial = selected?.title[0]?.toUpperCase() ?? '♪'
  const title   = selected?.title ?? 'No track selected'

  return (
    <div className="az-dock ref-dock">
      {/* A/B Compare button */}
      <button className="ref-ab-btn">
        <span className="ref-ab-btn-top">A / B</span>
        <span className="ref-ab-btn-sub">COMPARE</span>
      </button>

      {/* Track info */}
      <div className="az-dock-track" style={{ width: 320 }}>
        <div className="az-dock-thumb" style={{ borderColor: accent + '40' }}>
          <span className="az-dock-thumb-letter" style={{ color: accent + 'aa' }}>{initial}</span>
        </div>
        <div className="az-dock-info">
          <span className="az-dock-title">{title}</span>
          {selected && (
            <div className="az-dock-format">
              <span className="az-dock-format-tag">{selected.sampleRate}</span>
              <span className="az-dock-format-tag">Stereo</span>
            </div>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className="az-dock-transport">
        <button className="az-transport-btn" title="Previous" disabled={!selected}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>
        <button className="az-transport-btn" title="Stop" disabled={!selected} onClick={onStop}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
        </button>
        <button className="az-play-btn" disabled={!selected} title={isPlaying ? 'Pause' : 'Play'}
          onClick={isPlaying ? onPause : onPlay}>
          {isPlaying
            ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>
        <button className="az-transport-btn" title="Next" disabled={!selected}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>

      {/* Time */}
      <div className="az-dock-time">
        <span className="az-dock-time-current">{fmtDur(currentTime)}.000</span>
        <span className="az-dock-time-total">{selected ? fmtDur(selected.duration) + '.000' : '00:00.000'}</span>
      </div>

      {/* Volume */}
      <div className="az-dock-volume">
        <span className="az-dock-vol-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="rgba(245,248,250,0.4)">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </span>
        <span className="az-dock-vol-db" style={{ fontSize: 9 }}>–1.1 dB</span>
        <input type="range" className="az-dock-vol-slider"
          min={0} max={1} step={0.005} defaultValue={0.8}
          style={{ '--pct': '80%' } as React.CSSProperties}
        />
      </div>

      {/* Right: source + gear */}
      <div className="az-dock-right">
        <select className="az-dock-source-select">
          <option>Main Out</option>
          <option>Headphones</option>
        </select>
        <button className="az-dock-gear-btn" title="Settings">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ opacity: 0.5 }}>
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────
interface Props {
  activeView: 'analyzer' | 'reference' | 'vyzualz'
  onNavigate: (v: 'analyzer' | 'reference' | 'vyzualz') => void
}

export function ReferenceView({ activeView, onNavigate }: Props) {
  const [mainTrack,  setMainTrack]  = useState<RefTrack | null>(null)
  const [refTracks,  setRefTracks]  = useState<[RefTrack | null, RefTrack | null, RefTrack | null]>([null, null, null])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loudnessMatch,  setLoudnessMatch]  = useState(false)
  const [linkedPlayback, setLinkedPlayback] = useState(false)
  const [viewMode,  setViewMode]  = useState<'Grid' | 'Overlay' | 'A/B'>('Grid')
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [dragOver,    setDragOver]    = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const audioRef    = useRef<HTMLAudioElement | null>(null)

  const totalTracks = (mainTrack ? 1 : 0) + refTracks.filter(Boolean).length

  const selectedTrack = mainTrack?.id === selectedId ? mainTrack
    : refTracks.find(t => t?.id === selectedId) ?? null

  // Sync audio src when selected track changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (selectedTrack) {
      audio.src = selectedTrack.url
      audio.load()
      setCurrentTime(0)
      setIsPlaying(false)
    } else {
      audio.src = ''
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [selectedTrack?.id])

  const handleMainUpload = useCallback((files: File[]) => {
    const file = files[0]; if (!file) return
    const track = generateMockAnalysis(file, 'main')
    setMainTrack(track); setSelectedId(track.id)
  }, [])

  const handleRefUpload = useCallback((files: File[], refIndex: 1 | 2 | 3) => {
    const file = files[0]; if (!file) return
    const track = generateMockAnalysis(file, 'reference', refIndex)
    setRefTracks(prev => {
      const next = [...prev] as [RefTrack | null, RefTrack | null, RefTrack | null]
      next[refIndex - 1] = track; return next
    })
  }, [])

  const handleAddAny = useCallback((files: File[]) => {
    if (!files.length) return
    if (!mainTrack) { handleMainUpload(files); return }
    const idx = refTracks.findIndex(t => t === null)
    if (idx !== -1) handleRefUpload(files, (idx + 1) as 1 | 2 | 3)
  }, [mainTrack, refTracks, handleMainUpload, handleRefUpload])

  return (
    <div
      className="az-root"
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleAddAny(Array.from(e.dataTransfer.files).filter(isAudio)) }}
    >
      {dragOver && <div className="az-drag-overlay">DROP AUDIO FILES</div>}
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0) }}
        style={{ display: 'none' }}
      />
      <input ref={addInputRef} type="file" accept="audio/*" style={{ display: 'none' }}
        onChange={e => { handleAddAny(Array.from(e.target.files ?? []).filter(isAudio)); e.target.value = '' }}
      />

      <div className="az-shell">
        <AnalyzerSidebar activeView={activeView} onNavigate={onNavigate} />

        <div className="ref-main">
          <ReferenceTopBar
            trackCount={totalTracks}
            loudnessMatch={loudnessMatch} linkedPlayback={linkedPlayback} viewMode={viewMode}
            onToggleLoudness={() => setLoudnessMatch(v => !v)}
            onToggleLinked={() => setLinkedPlayback(v => !v)}
            onSetViewMode={setViewMode}
            onAddReference={() => addInputRef.current?.click()}
          />

          <div className="ref-scroll">
            <MainTrackCard
              track={mainTrack}
              onUpload={handleMainUpload}
              onRemove={() => {
                if (mainTrack) URL.revokeObjectURL(mainTrack.url)
                setMainTrack(null)
                if (selectedId === mainTrack?.id) setSelectedId(null)
              }}
              isSelected={selectedId === mainTrack?.id}
              onClick={() => mainTrack && setSelectedId(mainTrack.id)}
            />

            <div className="ref-cards-row">
              {([1, 2, 3] as const).map(i => (
                <RefTrackCard key={i} refIndex={i}
                  track={refTracks[i - 1]}
                  onUpload={files => handleRefUpload(files, i)}
                  onRemove={() => {
                    const removed = refTracks[i - 1]
                    if (removed) URL.revokeObjectURL(removed.url)
                    setRefTracks(prev => {
                      const next = [...prev] as [RefTrack | null, RefTrack | null, RefTrack | null]
                      next[i - 1] = null; return next
                    })
                    if (selectedId === removed?.id) setSelectedId(null)
                  }}
                  isSelected={selectedId === refTracks[i - 1]?.id}
                  onClick={() => refTracks[i - 1] && setSelectedId(refTracks[i - 1]!.id)}
                />
              ))}
            </div>

            <div className="ref-summary">
              <ReferenceMatchPanel tracks={[mainTrack, ...refTracks]} />
              <SmartInsightsPanel />
              <TargetRangePanel />
            </div>
          </div>
        </div>
      </div>

      <RefBottomDock
        selected={selectedTrack} isPlaying={isPlaying} currentTime={currentTime}
        onPlay={() => { audioRef.current?.play(); setIsPlaying(true) }}
        onPause={() => { audioRef.current?.pause(); setIsPlaying(false) }}
        onStop={() => {
          const audio = audioRef.current
          if (audio) { audio.pause(); audio.currentTime = 0 }
          setIsPlaying(false); setCurrentTime(0)
        }}
      />
    </div>
  )
}
