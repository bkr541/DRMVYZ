import { useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import type { OscillatorSettings } from '../../../components/vyzualz/react/ReactTypes'
import type { BrandKitAssetWithMedia } from '../BrandKitTypes'

function isSvgMedia(name: string, mimeType: string | null | undefined, role: string | undefined): boolean {
  return mimeType === 'image/svg+xml' || role === 'svg' || /\.svg$/i.test(name)
}

export function BrandSoundDrawingShortcuts({ assets }: { assets: BrandKitAssetWithMedia[] }) {
  const mediaItems = useMediaStore(state => state.items)
  const { oscillatorSettings, setOscillatorSettings, selectSvgMediaGlyph, selectSvgVisual } = useReactStore(useShallow(state => ({
    oscillatorSettings: state.oscillatorSettings,
    setOscillatorSettings: state.setOscillatorSettings,
    selectSvgMediaGlyph: state.selectSvgMediaGlyph,
    selectSvgVisual: state.selectSvgVisual,
  })))
  const previousRef = useRef<OscillatorSettings | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const candidates = useMemo(() => assets
    .filter(asset => asset.role === 'primaryLogo' || asset.role === 'wordmark')
    .map(asset => ({
      asset,
      item: mediaItems.find(item => item.dbId === asset.mediaItemId) ?? null,
    })), [assets, mediaItems])

  async function applyCandidate(index: number) {
    const candidate = candidates[index]
    if (!candidate?.item) return
    const { item } = candidate
    const svg = isSvgMedia(item.name, item.mimeType, item.mediaRole)
    const validation = item.metadata.svgValidation
    if (svg && validation?.isValidSvg === false) {
      setNotice('This SVG failed validation and was not injected into Sound Drawing.')
      return
    }
    previousRef.current ??= { ...oscillatorSettings }
    if (svg && validation?.reactivePathCompatible) {
      await selectSvgMediaGlyph(item.id)
      setNotice(`${candidate.asset.role === 'wordmark' ? 'Brand wordmark' : 'Brand logo'} selected as a reactive path.`)
    } else {
      // Embedded-raster/complex SVGs and regular images use artwork mode.
      await selectSvgVisual(item.id)
      setNotice(`${candidate.asset.role === 'wordmark' ? 'Brand wordmark' : 'Brand logo'} selected as original artwork.`)
    }
  }

  function restorePrevious() {
    if (!previousRef.current) return
    setOscillatorSettings(previousRef.current)
    previousRef.current = null
    setNotice('Previous Sound Drawing source restored.')
  }

  return (
    <section className="bk-section" aria-labelledby="bk-sound-drawing-shortcuts">
      <div className="bk-section-heading"><div>
        <h3 id="bk-sound-drawing-shortcuts">Sound Drawing shortcuts</h3>
        <p>Brand assets are never substituted automatically. Valid vector SVGs can become reactive paths; complex SVGs and regular images use artwork mode.</p>
      </div></div>
      <div className="bk-shortcut-row">
        {candidates.map((candidate, index) => {
          const label = candidate.asset.role === 'wordmark' ? 'Use Brand Wordmark' : 'Use Brand Logo in Sound Drawing'
          const invalid = !candidate.item || (isSvgMedia(candidate.item.name, candidate.item.mimeType, candidate.item.mediaRole) && candidate.item.metadata.svgValidation?.isValidSvg === false)
          return <button key={candidate.asset.id} type="button" className="bk-secondary-button" disabled={invalid} onClick={() => void applyCandidate(index)}>{label}</button>
        })}
        <button type="button" className="bk-text-button" disabled={!previousRef.current} onClick={restorePrevious}>Restore Previous Source</button>
      </div>
      <label className="bk-inline-toggle">
        <input type="checkbox" checked={oscillatorSettings.svgUseReactPalette} onChange={event => setOscillatorSettings({ svgUseReactPalette: event.target.checked })} />
        <span>Use React palette instead of original artwork colors</span>
      </label>
      {candidates.length === 0 && <div className="bk-missing-slot">Link a primary logo or wordmark to enable these shortcuts.</div>}
      {notice && <div className="bk-inline-success" role="status">{notice}</div>}
    </section>
  )
}
