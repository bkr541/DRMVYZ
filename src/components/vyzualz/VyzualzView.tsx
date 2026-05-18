import { useState, useRef, useEffect, useCallback } from 'react'
import { AnalyzerSidebar } from '../analyzer/AnalyzerSidebar'

// ── Types ─────────────────────────────────────────────────────────────
interface VzMedia {
  id: string
  name: string
  type: 'image' | 'video'
  meta: string
  favorite: boolean
  gradient: string
}

interface VzPreset {
  id: string
  name: string
  color: string
  gradient: string
}

interface VzEffects {
  masterIntensity: number
  bassReactivity: number
  glitchAmount: number
  rgbSplit: number
  tunnelSpeed: number
  displacement: number
  bloom: number
  strobe: number
  feedbackTrails: number
  logoScale: number
  colorShift: number
}

// ── Constants ─────────────────────────────────────────────────────────
const MEDIA_ITEMS: VzMedia[] = [
  { id: 'm1', name: 'DVYDRM Logo.png',      type: 'image', meta: 'PNG · 1920×1080', favorite: true,  gradient: 'linear-gradient(135deg,#061525 0%,#0a3a55 55%,#19bff2 100%)' },
  { id: 'm2', name: 'Dream Theft Loop.mp4', type: 'video', meta: 'MP4 · 00:15',     favorite: false, gradient: 'linear-gradient(135deg,#140020 0%,#4a1070 55%,#9333ea 100%)' },
  { id: 'm3', name: 'Boss Arrival.mp4',     type: 'video', meta: 'MP4 · 00:12',     favorite: false, gradient: 'linear-gradient(135deg,#200800 0%,#7a2000 55%,#f97316 100%)' },
  { id: 'm4', name: 'DRMWLD City.png',      type: 'image', meta: 'PNG · 1920×1080', favorite: true,  gradient: 'linear-gradient(135deg,#001510 0%,#004a30 55%,#059669 100%)' },
  { id: 'm5', name: 'Portal Bloom.mp4',     type: 'video', meta: 'MP4 · 00:20',     favorite: false, gradient: 'linear-gradient(135deg,#1a0020 0%,#6a0050 55%,#ec4899 100%)' },
  { id: 'm6', name: 'Character Glitch.png', type: 'image', meta: 'PNG · 1080×1350', favorite: false, gradient: 'linear-gradient(135deg,#001500 0%,#004800 55%,#22c55e 100%)' },
  { id: 'm7', name: 'Final Restore.mp4',    type: 'video', meta: 'MP4 · 00:18',     favorite: true,  gradient: 'linear-gradient(135deg,#150f00 0%,#604000 55%,#fbbf24 100%)' },
  { id: 'm8', name: 'Nightmare Signal.png', type: 'image', meta: 'PNG · 1920×1080', favorite: false, gradient: 'linear-gradient(135deg,#150005 0%,#550020 55%,#e11d48 100%)' },
]

const PRESET_LIST: VzPreset[] = [
  { id: 'p1', name: 'Dream Theft',      color: '#19bff2', gradient: 'linear-gradient(135deg,#0a1830 0%,#0a3a55 60%,#19bff2 100%)' },
  { id: 'p2', name: 'Nightmare Signal', color: '#e11d48', gradient: 'linear-gradient(135deg,#1a0010 0%,#550020 60%,#e11d48 100%)' },
  { id: 'p3', name: 'Boss Intro',       color: '#f97316', gradient: 'linear-gradient(135deg,#1a0800 0%,#7a2000 60%,#f97316 100%)' },
  { id: 'p4', name: 'Portal Bloom',     color: '#a855f7', gradient: 'linear-gradient(135deg,#150020 0%,#5a0090 60%,#a855f7 100%)' },
  { id: 'p5', name: 'Final Restore',    color: '#fbbf24', gradient: 'linear-gradient(135deg,#1a1200 0%,#604000 60%,#fbbf24 100%)' },
]

const EFFECT_CHAIN_ITEMS = ['RGB Split','Glitch Bars','Scanlines','Tunnel','Displacement','Noise Fog','Bloom','Feedback'] as const

const SHORTCUTS = [
  { key: '1–5', desc: 'Switch Preset' },
  { key: 'F',   desc: 'Fullscreen' },
  { key: 'G',   desc: 'Glitch Punch' },
  { key: 'B',   desc: 'Bass Pulse' },
  { key: 'SPC', desc: 'Beat Flash' },
  { key: 'V',   desc: 'Next Media' },
]

const FREQ_BANDS = [
  { label: 'Bass',  value: 0.82, color: '#19bff2' },
  { label: 'LMid',  value: 0.54, color: '#58d15b' },
  { label: 'Mid',   value: 0.41, color: '#a78bfa' },
  { label: 'High',  value: 0.67, color: '#f97316' },
  { label: 'Vol',   value: 0.74, color: '#19bff2' },
]

const DEFAULT_EFFECTS: VzEffects = {
  masterIntensity: 0.85,
  bassReactivity:  0.90,
  glitchAmount:    0.75,
  rgbSplit:        0.65,
  tunnelSpeed:     0.60,
  displacement:    0.70,
  bloom:           0.80,
  strobe:          0.45,
  feedbackTrails:  0.55,
  logoScale:       1.20,
  colorShift:      0.30,
}

// ── VzSlider ──────────────────────────────────────────────────────────
function VzSlider({ label, value, min = 0, max = 1, step = 0.01, onChange, colorTrack }: {
  label: string; value: number; min?: number; max?: number; step?: number
  onChange: (v: number) => void; colorTrack?: boolean
}) {
  const pct = `${((value - min) / (max - min)) * 100}%`
  return (
    <div className="vz-slider-wrap">
      <div className="vz-slider-header">
        <span className="vz-slider-label">{label}</span>
        <span className="vz-slider-val">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        className={`vz-slider${colorTrack ? ' vz-slider--color' : ''}`}
        style={{ '--pct': pct } as React.CSSProperties}
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

// ── BeatCanvas ────────────────────────────────────────────────────────
function BeatCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = 70, H = 22
    canvas.width  = W * devicePixelRatio
    canvas.height = H * devicePixelRatio
    canvas.style.width  = `${W}px`
    canvas.style.height = `${H}px`
    const dpr = devicePixelRatio

    // Kick waveform shape (pre-computed)
    const shape = [0,0,0.08,0.15,0.9,1,0.7,0.4,0.22,0.14,0.1,0.08,0.06,0.05,0.04,0.03,0.02,0.01,0,0]

    let t = 0
    function frame() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cW = canvas.width, cH = canvas.height
      const mid = cH / 2
      const beatPhase = (t % 120) / 120  // cycle every 120 frames
      const beatPulse = beatPhase < 0.15 ? 1 - beatPhase / 0.15 : 0

      ctx.beginPath()
      shape.forEach((v, i) => {
        const x = (i / (shape.length - 1)) * cW
        const amp = (0.3 + beatPulse * 0.7) * v * mid * 0.85
        if (i === 0) ctx.moveTo(x, mid - amp)
        else ctx.lineTo(x, mid - amp)
      })
      ;[...shape].reverse().forEach((v, i) => {
        const x = ((shape.length - 1 - i) / (shape.length - 1)) * cW
        const amp = (0.3 + beatPulse * 0.7) * v * mid * 0.85
        ctx.lineTo(x, mid + amp)
      })
      ctx.closePath()

      const alpha = 0.4 + beatPulse * 0.55
      const grad = ctx.createLinearGradient(0, 0, cW, 0)
      grad.addColorStop(0, `rgba(25,191,242,0)`)
      grad.addColorStop(0.25, `rgba(25,191,242,${alpha})`)
      grad.addColorStop(0.75, `rgba(25,191,242,${alpha})`)
      grad.addColorStop(1, `rgba(25,191,242,0)`)
      ctx.fillStyle = grad
      ctx.fill()

      // Stroke line
      ctx.beginPath()
      shape.forEach((v, i) => {
        const x = (i / (shape.length - 1)) * cW
        const amp = (0.3 + beatPulse * 0.7) * v * mid * 0.85
        if (i === 0) ctx.moveTo(x, mid - amp)
        else ctx.lineTo(x, mid - amp)
      })
      ctx.strokeStyle = `rgba(25,191,242,${0.6 + beatPulse * 0.35})`
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()

      // Center line
      ctx.beginPath()
      ctx.moveTo(0, mid); ctx.lineTo(cW, mid)
      ctx.strokeStyle = 'rgba(25,191,242,0.1)'
      ctx.lineWidth = dpr
      ctx.stroke()

      t++
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return <canvas ref={canvasRef} />
}

// ── LiveVisualCanvas ──────────────────────────────────────────────────
function LiveVisualCanvas({ isPlaying }: { isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const startRef  = useRef<number>(performance.now())
  const playRef   = useRef(isPlaying)

  useEffect(() => { playRef.current = isPlaying }, [isPlaying])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      canvas.width  = Math.round(r.width  * devicePixelRatio)
      canvas.height = Math.round(r.height * devicePixelRatio)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    function frame() {
      if (!canvas || !ctx) return
      const t   = performance.now() - startRef.current
      const W   = canvas.width, H = canvas.height
      if (W === 0 || H === 0) { animRef.current = requestAnimationFrame(frame); return }
      const dpr = devicePixelRatio
      const cx  = W / 2, cy = H / 2

      // Background
      ctx.fillStyle = '#050709'
      ctx.fillRect(0, 0, W, H)

      // Radial bg glow
      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.55)
      bgGlow.addColorStop(0, 'rgba(10,24,45,0.9)')
      bgGlow.addColorStop(1, 'rgba(3,6,8,0)')
      ctx.fillStyle = bgGlow
      ctx.fillRect(0, 0, W, H)

      // Grid spokes
      ctx.save()
      ctx.strokeStyle = 'rgba(25,191,242,0.04)'
      ctx.lineWidth = dpr
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * Math.max(W, H), cy + Math.sin(angle) * Math.max(W, H))
        ctx.stroke()
      }
      ctx.restore()

      // Horizontal grid lines (perspective-ish)
      ctx.strokeStyle = 'rgba(25,191,242,0.04)'
      ctx.lineWidth = dpr
      for (let i = 1; i <= 5; i++) {
        const y = cy + (H * 0.5) * (i / 5) ** 1.4
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
        const y2 = cy - (H * 0.5) * (i / 5) ** 1.4
        ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke()
      }

      // Animated rings
      const speed  = playRef.current ? 1 : 0.25
      for (let r = 0; r < 5; r++) {
        const baseR  = (Math.min(W, H) * 0.09) + r * (Math.min(W, H) * 0.085)
        const pulse  = Math.sin(t * 0.001 * speed * (1 + r * 0.12) + r * 1.3) * (Math.min(W, H) * 0.012)
        const radius = baseR + pulse
        const alpha  = 0.06 + Math.sin(t * 0.0013 * speed + r * 1.2) * 0.04
        ctx.strokeStyle = `rgba(25,191,242,${alpha})`
        ctx.lineWidth = 1.5 * dpr
        ctx.shadowColor = '#19bff2'
        ctx.shadowBlur = 8
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Inner glow
      const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.18)
      innerGlow.addColorStop(0, 'rgba(25,191,242,0.07)')
      innerGlow.addColorStop(1, 'rgba(25,191,242,0)')
      ctx.fillStyle = innerGlow
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.18, 0, Math.PI * 2); ctx.fill()

      // DVYDRM text with RGB split
      const fontSize = Math.max(20 * dpr, Math.min(52 * dpr, W * 0.12))
      ctx.font = `900 ${fontSize}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const rgbShift = 2.5 * dpr
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#ff0055'
      ctx.fillText('DVYDRM', cx - rgbShift, cy)
      ctx.fillStyle = '#0044ff'
      ctx.fillText('DVYDRM', cx + rgbShift, cy)
      ctx.globalAlpha = 1

      ctx.shadowColor = '#19bff2'
      ctx.shadowBlur = 24
      ctx.fillStyle = 'rgba(25,191,242,0.92)'
      ctx.fillText('DVYDRM', cx, cy)
      ctx.shadowBlur = 0

      // Subtitle
      const subSize = fontSize * 0.26
      ctx.globalAlpha = 0.35
      ctx.font = `400 ${subSize}px Inter, sans-serif`
      ctx.fillStyle = '#19bff2'
      ctx.fillText('DREAM  WORLD', cx, cy + fontSize * 0.7)
      ctx.globalAlpha = 1

      // Scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.14)'
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1)

      // HUD corner decorators
      const cSize = 14 * dpr, margin = 10 * dpr
      ctx.strokeStyle = 'rgba(25,191,242,0.28)'
      ctx.lineWidth = 1.5 * dpr
      const corners: [number, number, number, number][] = [
        [margin, margin, 1, 1],
        [W - margin, margin, -1, 1],
        [margin, H - margin, 1, -1],
        [W - margin, H - margin, -1, -1],
      ]
      corners.forEach(([x, y, dx, dy]) => {
        ctx.beginPath()
        ctx.moveTo(x + dx * cSize, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * cSize)
        ctx.stroke()
      })

      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="vz-preview-canvas"
    />
  )
}

// ── AudioWaveformCanvas ───────────────────────────────────────────────
function AudioWaveformCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      canvas.width  = Math.round(r.width  * devicePixelRatio)
      canvas.height = Math.round(r.height * devicePixelRatio)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let t = 0
    function frame() {
      if (!canvas || !ctx) return
      const W = canvas.width, H = canvas.height
      if (W === 0 || H === 0) { animRef.current = requestAnimationFrame(frame); return }
      const dpr = devicePixelRatio
      ctx.clearRect(0, 0, W, H)
      const mid = H / 2

      ctx.beginPath()
      const pts = 120
      for (let i = 0; i <= pts; i++) {
        const x = (i / pts) * W
        const n1 = Math.sin(i * 0.18 + t * 0.04) * 0.45
        const n2 = Math.sin(i * 0.07 + t * 0.02) * 0.3
        const n3 = Math.sin(i * 0.4  + t * 0.07) * 0.15
        const amp = (n1 + n2 + n3) * mid * 0.7
        if (i === 0) ctx.moveTo(x, mid + amp)
        else ctx.lineTo(x, mid + amp)
      }
      ctx.strokeStyle = 'rgba(25,191,242,0.65)'
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()

      // Fill below
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, 'rgba(25,191,242,0.15)')
      grad.addColorStop(1, 'rgba(25,191,242,0)')
      ctx.fillStyle = grad
      ctx.fill()

      t++
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="vz-waveform-mini" style={{ flex: 1, height: '26px', display: 'block' }} />
}

// ── VyzualzHeader ─────────────────────────────────────────────────────
function VyzualzHeader() {
  return (
    <div className="vz-header">
      <div className="vz-header-title-group">
        <div className="vz-header-title">VYZUALZ</div>
        <div className="vz-header-sub">Virtual Audio Synthesizer</div>
      </div>

      <div className="vz-header-sep" />

      <div className="vz-input-group">
        <span className="vz-input-label">Audio In</span>
        <select className="az-select">
          <option>BlackHole 2ch</option>
          <option>Built-in Microphone</option>
          <option>Aggregate Device</option>
        </select>
        <span className="vz-active-pill">ACTIVE</span>
      </div>

      <div className="vz-header-sep" />

      <div className="vz-freq-meters">
        {FREQ_BANDS.map(b => (
          <div key={b.label} className="vz-freq-meter">
            <div className="vz-freq-bar-track">
              <div
                className="vz-freq-bar-fill"
                style={{ height: `${b.value * 100}%`, background: b.color }}
              />
            </div>
            <span className="vz-freq-label">{b.label}</span>
          </div>
        ))}
      </div>

      <div className="vz-header-sep" />

      <div className="vz-beat-wrap">
        <BeatCanvas />
        <span className="vz-beat-label">KICK</span>
      </div>

      <span className="az-spacer" />
      <button className="az-overflow-btn">···</button>
    </div>
  )
}

// ── MediaDeckPanel ────────────────────────────────────────────────────
function MediaDeckPanel({ activeMedia, onSelect }: {
  activeMedia: string; onSelect: (id: string) => void
}) {
  const [filter, setFilter] = useState<'All' | 'Images' | 'Videos' | 'Favorites'>('All')
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(MEDIA_ITEMS.filter(m => m.favorite).map(m => m.id))
  )

  const filtered = MEDIA_ITEMS.filter(m => {
    if (filter === 'Images')    return m.type === 'image'
    if (filter === 'Videos')    return m.type === 'video'
    if (filter === 'Favorites') return favorites.has(m.id)
    return true
  })

  const toggleFav = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  return (
    <div className="vz-panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="vz-panel-header">
        <span className="vz-panel-title">Media Deck</span>
        <button className="vz-import-btn">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Import
        </button>
      </div>

      <div className="vz-filter-tabs">
        {(['All','Images','Videos','Favorites'] as const).map(f => (
          <button key={f}
            className={`vz-filter-tab ${filter === f ? 'vz-filter-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      <div className="vz-media-scroll">
        <div className="vz-media-grid">
          {filtered.map(m => (
            <div
              key={m.id}
              className={`vz-media-card ${activeMedia === m.id ? 'vz-media-card--active' : ''}`}
              onClick={() => onSelect(m.id)}
            >
              <div className="vz-media-thumb" style={{ background: m.gradient }}>
                <span className="vz-media-type-badge">{m.type === 'video' ? 'MP4' : 'IMG'}</span>
                <button
                  className={`vz-media-star ${favorites.has(m.id) ? 'vz-media-star--active' : ''}`}
                  onClick={e => toggleFav(m.id, e)}
                >★</button>
              </div>
              <div className="vz-media-info">
                <div className="vz-media-name">{m.name}</div>
                <div className="vz-media-meta">{m.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── LiveVisualPreview ─────────────────────────────────────────────────
function LiveVisualPreview({ isPlaying, onPlay, onPause, bpm, onBpmChange, bpmSync, onToggleBpmSync, onTap }: {
  isPlaying: boolean; onPlay: () => void; onPause: () => void
  bpm: number; onBpmChange: (v: number) => void
  bpmSync: boolean; onToggleBpmSync: () => void; onTap: () => void
}) {
  return (
    <div className="vz-preview-panel">
      <div className="vz-preview-canvas-wrap">
        <LiveVisualCanvas isPlaying={isPlaying} />
        <div className="vz-preview-pills">
          <span className="vz-preview-pill">1920×1080</span>
          <span className="vz-preview-pill">60 FPS</span>
          <span className="vz-preview-pill">GPU</span>
        </div>
      </div>

      <div className="vz-preview-transport">
        {/* Prev */}
        <button className="vz-preview-trans-btn" title="Previous">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          className="vz-preview-play-btn"
          title={isPlaying ? 'Pause' : 'Play'}
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying
            ? <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>

        {/* Next */}
        <button className="vz-preview-trans-btn" title="Next">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>

        <div className="az-spacer" />

        {/* BPM Sync toggle */}
        <div className="vz-sync-toggle" onClick={onToggleBpmSync}>
          <div className={`vz-sync-track ${bpmSync ? 'vz-sync-track--on' : ''}`}>
            <div className="vz-sync-thumb" />
          </div>
          <span className="vz-sync-label">BPM Sync</span>
        </div>

        {/* BPM */}
        <div className="vz-bpm-group">
          <span className="vz-bpm-label">BPM</span>
          <span className="vz-bpm-val">{bpm}</span>
          <button className="vz-tap-btn" onClick={onTap}>TAP</button>
        </div>

        <div className="vz-header-sep" />

        {/* Quality */}
        <select className="az-select">
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      </div>
    </div>
  )
}

// ── AudioAnalyzerPanel ────────────────────────────────────────────────
function AudioAnalyzerPanel() {
  const BAND_DATA = [
    { label: 'Bass',    value: 0.82, color: '#19bff2' },
    { label: 'Low Mid', value: 0.54, color: '#58d15b' },
    { label: 'Mid',     value: 0.41, color: '#a78bfa' },
    { label: 'High',    value: 0.67, color: '#f97316' },
    { label: 'Volume',  value: 0.74, color: '#19bff2' },
  ]
  return (
    <div className="vz-analyzer-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <span className="vz-panel-title">Audio Analyzer</span>
      </div>
      <div className="vz-analyzer-body">
        <div className="vz-band-bars">
          {BAND_DATA.map(b => (
            <div key={b.label} className="vz-band-col">
              <span className="vz-band-bar-val">{b.value.toFixed(2)}</span>
              <div className="vz-band-bar-track">
                <div className="vz-band-bar-fill" style={{ height: `${b.value * 100}%`, background: b.color, boxShadow: `0 0 5px ${b.color}55` }} />
              </div>
              <span className="vz-band-bar-label">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="vz-waveform-row">
          <span className="vz-waveform-label">LIVE WAVEFORM</span>
          <AudioWaveformCanvas />
        </div>
      </div>
    </div>
  )
}

// ── EffectControlsPanel ───────────────────────────────────────────────
function EffectControlsPanel({ effects, onChange, onReset }: {
  effects: VzEffects
  onChange: (key: keyof VzEffects, v: number) => void
  onReset: () => void
}) {
  const sliders: { key: keyof VzEffects; label: string; min?: number; max?: number; color?: boolean }[] = [
    { key: 'masterIntensity', label: 'Master Intensity' },
    { key: 'bassReactivity',  label: 'Bass Reactivity' },
    { key: 'glitchAmount',    label: 'Glitch Amount' },
    { key: 'rgbSplit',        label: 'RGB Split' },
    { key: 'tunnelSpeed',     label: 'Tunnel Speed' },
    { key: 'displacement',    label: 'Displacement' },
    { key: 'bloom',           label: 'Bloom' },
    { key: 'strobe',          label: 'Strobe' },
    { key: 'feedbackTrails',  label: 'Feedback Trails' },
    { key: 'logoScale',       label: 'Logo Scale',    min: 0, max: 2 },
    { key: 'colorShift',      label: 'Color Shift',   color: true },
  ]
  return (
    <div className="vz-effects-panel">
      <div className="vz-panel-header">
        <span className="vz-panel-title">Effect Controls</span>
        <button className="vz-reset-btn" onClick={onReset}>Reset</button>
      </div>
      <div className="vz-effects-scroll">
        {sliders.map(s => (
          <VzSlider
            key={s.key}
            label={s.label}
            value={effects[s.key]}
            min={s.min}
            max={s.max}
            colorTrack={s.color}
            onChange={v => onChange(s.key, v)}
          />
        ))}
      </div>
    </div>
  )
}

// ── EffectChainPanel ──────────────────────────────────────────────────
function EffectChainPanel({ enabled, onToggle }: {
  enabled: Set<string>; onToggle: (name: string) => void
}) {
  return (
    <div className="vz-chain-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <span className="vz-panel-title">Effect Chain</span>
      </div>
      <div className="vz-chain-grid">
        {EFFECT_CHAIN_ITEMS.map(name => (
          <button
            key={name}
            className={`vz-chain-btn ${enabled.has(name) ? 'vz-chain-btn--active' : ''}`}
            onClick={() => onToggle(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── OutputModeCard ────────────────────────────────────────────────────
function OutputModeCard({ outputMode, onOutputModeChange }: {
  outputMode: string; onOutputModeChange: (m: string) => void
}) {
  return (
    <div className="vz-output-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <span className="vz-panel-title">Output Mode</span>
      </div>
      <div className="vz-output-body">
        <select
          className="az-select"
          value={outputMode}
          onChange={e => onOutputModeChange(e.target.value)}
        >
          <option>Windowed</option>
          <option>Fullscreen</option>
          <option>Syphon Output</option>
        </select>
        <button className="vz-fullscreen-btn">Go Fullscreen</button>
        <span className="vz-hotkey-pill">F</span>
      </div>
    </div>
  )
}

// ── PresetStrip ───────────────────────────────────────────────────────
function PresetStrip({ activePreset, onSelect }: {
  activePreset: string; onSelect: (id: string) => void
}) {
  return (
    <div className="vz-presets-section">
      <div className="vz-presets-header">
        <span className="vz-presets-label">Presets</span>
        <button className="vz-new-preset-btn">
          <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          New
        </button>
      </div>
      <div className="vz-preset-cards">
        {PRESET_LIST.map(p => (
          <div
            key={p.id}
            className={`vz-preset-card ${activePreset === p.id ? 'vz-preset-card--active' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <div className="vz-preset-thumb" style={{ background: p.gradient }} />
            <div className="vz-preset-name">{p.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ShortcutPanel ─────────────────────────────────────────────────────
function ShortcutPanel() {
  return (
    <div className="vz-shortcuts-section">
      <span className="vz-shortcuts-label">Shortcuts</span>
      <div className="vz-shortcut-grid">
        {SHORTCUTS.map(s => (
          <div key={s.key} className="vz-shortcut-card">
            <span className="vz-shortcut-key">{s.key}</span>
            <span className="vz-shortcut-desc">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── VyzualzDock ───────────────────────────────────────────────────────
function VyzualzDock({ activePreset, isPlaying, bpm, onPlay, onPause }: {
  activePreset: VzPreset | null; isPlaying: boolean; bpm: number
  onPlay: () => void; onPause: () => void
}) {
  const preset = activePreset ?? PRESET_LIST[0]
  return (
    <div className="az-dock">
      {/* Preset info */}
      <div className="az-dock-track" style={{ width: 280 }}>
        <div className="az-dock-thumb" style={{ borderColor: preset.color + '40', background: preset.gradient }}>
          <span className="az-dock-thumb-letter" style={{ color: preset.color, fontSize: 11, fontWeight: 800 }}>
            {preset.name[0]}
          </span>
        </div>
        <div className="az-dock-info">
          <div className="vz-dock-preset-label">Active Preset</div>
          <div className="vz-dock-preset-name">{preset.name}</div>
          <div className="az-dock-format">
            <span className="az-dock-format-tag">BlackHole 2ch</span>
            <span className="az-dock-format-tag">Live</span>
          </div>
        </div>
      </div>

      {/* Transport */}
      <div className="az-dock-transport">
        <button className="az-transport-btn" title="Previous Preset">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>
        <button
          className="az-play-btn"
          title={isPlaying ? 'Pause' : 'Play'}
          style={{ borderColor: preset.color, color: preset.color, boxShadow: `0 0 12px ${preset.color}30` }}
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying
            ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>
        <button className="az-transport-btn" title="Next Preset">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>

      {/* BPM */}
      <div className="vz-dock-bpm-group">
        <span className="vz-dock-bpm-label">BPM</span>
        <span className="vz-dock-bpm-val">{bpm}</span>
      </div>

      {/* Volume */}
      <div className="az-dock-volume">
        <span className="az-dock-vol-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="rgba(245,248,250,0.4)">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </span>
        <span className="az-dock-vol-db" style={{ fontSize: 9 }}>–0.0 dB</span>
        <input type="range" className="az-dock-vol-slider"
          min={0} max={1} step={0.005} defaultValue={1.0}
          style={{ '--pct': '100%' } as React.CSSProperties}
        />
      </div>

      {/* Right: output + gear */}
      <div className="az-dock-right">
        <select className="az-dock-source-select">
          <option>Main Out</option>
          <option>Syphon</option>
          <option>NDI Stream</option>
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

export function VyzualzView({ activeView, onNavigate }: Props) {
  const [activeMedia,  setActiveMedia]  = useState('m1')
  const [activePreset, setActivePreset] = useState('p1')
  const [effects,      setEffects]      = useState<VzEffects>(DEFAULT_EFFECTS)
  const [enabledFx,    setEnabledFx]    = useState<Set<string>>(
    () => new Set(['RGB Split','Tunnel','Bloom','Glitch Bars'])
  )
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [bpm,          setBpm]          = useState(120)
  const [bpmSync,      setBpmSync]      = useState(false)
  const [outputMode,   setOutputMode]   = useState('Windowed')

  const tapTimesRef = useRef<number[]>([])

  const handleEffectChange = useCallback((key: keyof VzEffects, v: number) => {
    setEffects(prev => ({ ...prev, [key]: v }))
  }, [])

  const handleFxToggle = useCallback((name: string) => {
    setEnabledFx(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }, [])

  const handleTap = useCallback(() => {
    const now = performance.now()
    const times = tapTimesRef.current
    times.push(now)
    if (times.length > 4) times.splice(0, times.length - 4)
    if (times.length >= 2) {
      const intervals = times.slice(1).map((t, i) => t - times[i])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      setBpm(Math.round(60000 / avg))
    }
  }, [])

  const currentPreset = PRESET_LIST.find(p => p.id === activePreset) ?? null

  return (
    <div className="az-root">
      <div className="az-shell">
        <AnalyzerSidebar activeView={activeView} onNavigate={onNavigate} />

        <div className="vz-main">
          <VyzualzHeader />

          <div className="vz-body">
            {/* Left: Media Deck */}
            <div className="vz-left">
              <MediaDeckPanel activeMedia={activeMedia} onSelect={setActiveMedia} />
            </div>

            {/* Center: Preview + Analyzer */}
            <div className="vz-center">
              <LiveVisualPreview
                isPlaying={isPlaying}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                bpm={bpm}
                onBpmChange={setBpm}
                bpmSync={bpmSync}
                onToggleBpmSync={() => setBpmSync(v => !v)}
                onTap={handleTap}
              />
              <AudioAnalyzerPanel />
            </div>

            {/* Right: Effects + Chain + Output */}
            <div className="vz-right">
              <EffectControlsPanel
                effects={effects}
                onChange={handleEffectChange}
                onReset={() => setEffects(DEFAULT_EFFECTS)}
              />
              <EffectChainPanel enabled={enabledFx} onToggle={handleFxToggle} />
              <OutputModeCard outputMode={outputMode} onOutputModeChange={setOutputMode} />
            </div>
          </div>

          {/* Bottom strip */}
          <div className="vz-bottom">
            <PresetStrip activePreset={activePreset} onSelect={setActivePreset} />
            <ShortcutPanel />
          </div>
        </div>
      </div>

      <VyzualzDock
        activePreset={currentPreset}
        isPlaying={isPlaying}
        bpm={bpm}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
    </div>
  )
}
