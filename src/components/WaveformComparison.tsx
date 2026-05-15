import React, { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface WaveformTrackProps {
  url: string | null
  label: string
  primaryColor: string
  isPlaying?: boolean
}

function WaveformTrack({ url, label, primaryColor, isPlaying }: WaveformTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: primaryColor + '66',
      progressColor: primaryColor,
      cursorColor: primaryColor,
      height: 60,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      interact: false,
    })
    wsRef.current = ws

    if (url) {
      ws.load(url).catch(() => { /**/ })
    }

    return () => { ws.destroy(); wsRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return (
    <div className="wf-track">
      <div className="wf-track-label" style={{ color: primaryColor }}>{label}</div>
      <div ref={containerRef} className="wf-track-canvas" />
      {!url && <div className="wf-empty">No track loaded</div>}
    </div>
  )
}

interface Props {
  mainUrl: string | null
  refUrl: string | null
  isABMode: boolean
  primaryColor: string
  secondaryColor: string
}

export function WaveformComparison({ mainUrl, refUrl, isABMode, primaryColor, secondaryColor }: Props) {
  return (
    <div className="waveform-comparison">
      <WaveformTrack
        url={mainUrl}
        label={`A — MAIN${!isABMode ? ' ◀ ACTIVE' : ''}`}
        primaryColor={primaryColor}
      />
      <WaveformTrack
        url={refUrl}
        label={`B — REFERENCE${isABMode ? ' ◀ ACTIVE' : ''}`}
        primaryColor={secondaryColor}
      />
    </div>
  )
}
