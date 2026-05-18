import { useRef, useEffect, useCallback } from 'react'

const PEAK_RES = 2000 // number of peak samples across the full track

interface Props {
  trackUrl: string | null
  currentTime: number
  duration: number
  color?: string
  onSeek?: (t: number) => void
}

export function WaveformModule({ trackUrl, currentTime, duration, color = 'rgba(200,210,220,0.85)', onSeek }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const peaksRef    = useRef<Float32Array | null>(null)
  const loadedUrl   = useRef<string | null>(null)
  const rafRef      = useRef<number>(0)

  // Keep canvas buffer matched to CSS size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          canvas.width  = Math.round(width  * devicePixelRatio)
          canvas.height = Math.round(height * devicePixelRatio)
        }
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // Decode audio file → peak array whenever trackUrl changes
  useEffect(() => {
    if (!trackUrl || trackUrl === loadedUrl.current) return
    loadedUrl.current = trackUrl
    peaksRef.current  = null

    const ac = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    fetch(trackUrl)
      .then(r => r.arrayBuffer())
      .then(buf => ac.decodeAudioData(buf))
      .then(decoded => {
        const numCh = decoded.numberOfChannels
        const len   = decoded.length
        const mono  = new Float32Array(len)
        for (let c = 0; c < numCh; c++) {
          const ch = decoded.getChannelData(c)
          for (let i = 0; i < len; i++) mono[i] += ch[i] / numCh
        }

        const peaks    = new Float32Array(PEAK_RES)
        const chunk    = len / PEAK_RES
        for (let x = 0; x < PEAK_RES; x++) {
          const s = Math.floor(x * chunk)
          const e = Math.min(Math.floor(s + chunk), len)
          let pk = 0
          for (let i = s; i < e; i++) { const a = Math.abs(mono[i]); if (a > pk) pk = a }
          peaks[x] = pk
        }
        peaksRef.current = peaks
        ac.close()
      })
      .catch(() => { ac.close() })
  }, [trackUrl])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const peaks = peaksRef.current
    const midY  = H / 2

    if (!peaks) {
      // No track loaded — draw a faint center line
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()
      return
    }

    const playFrac  = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0
    const playPx    = playFrac * W
    const barW      = Math.max(1, W / PEAK_RES)
    const gap       = barW > 2.5 ? 1 : 0

    for (let x = 0; x < W; x++) {
      const pi   = Math.floor((x / W) * PEAK_RES)
      const pk   = peaks[Math.min(pi, PEAK_RES - 1)]
      const barH = Math.max(1, pk * H * 0.92)
      ctx.fillStyle = x < playPx ? color : 'rgba(200,210,220,0.22)'
      ctx.fillRect(x * barW, midY - barH / 2, barW - gap, barH)
    }

    // Playhead
    if (duration > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(playPx - 0.5, 0, 1.5, H)
    }
  }, [currentTime, duration, color])

  // Render loop
  useEffect(() => {
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek(((e.clientX - rect.left) / rect.width) * duration)
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: onSeek ? 'pointer' : 'default' }}
      onClick={handleClick}
    />
  )
}
