import { useEffect, useMemo, useState } from 'react'
import type { ReactPreset } from './ReactTypes'
import { renderReactPresetThumbnail } from './renderers/ReactPresetThumbnailRenderer'

const THUMB_W = 112
const THUMB_H = 64

export function ReactPresetThumbnail({ preset, className = '' }: {
  preset: ReactPreset
  className?: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const background = useMemo(
    () => `linear-gradient(135deg, ${preset.palette.background}, ${preset.palette.primary}33 55%, ${preset.palette.secondary}40)`,
    [preset.palette.background, preset.palette.primary, preset.palette.secondary],
  )

  useEffect(() => {
    let disposed = false
    setLoadState('loading')
    setDataUrl(null)

    renderReactPresetThumbnail(preset, { width: THUMB_W, height: THUMB_H }).then(url => {
      if (disposed) return
      if (url) {
        setDataUrl(url)
        setLoadState('ready')
      } else {
        setLoadState('error')
      }
    })

    return () => {
      disposed = true
    }
  }, [preset])

  return (
    <div
      className={`rv-preset-thumb${className ? ` ${className}` : ''}${loadState === 'ready' ? ' rv-preset-thumb--ready' : ''}`}
      aria-hidden="true"
      style={{ background }}
    >
      {dataUrl ? (
        <img className="rv-preset-thumb-img" src={dataUrl} alt="" loading="lazy" />
      ) : (
        <div className="rv-preset-thumb-fallback">
          <span className="rv-preset-thumb-fallback-grid" />
          <span className="rv-preset-thumb-fallback-grid" />
          <span className="rv-preset-thumb-fallback-glow" style={{ background: preset.palette.primary }} />
          <span className="rv-preset-thumb-fallback-glow rv-preset-thumb-fallback-glow--secondary" style={{ background: preset.palette.secondary }} />
        </div>
      )}
    </div>
  )
}
