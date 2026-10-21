import { useState } from 'react'
import { AppIconGallery } from './AppIconGallery'
import { Cinema2StillPreview } from './Cinema2StillPreview'
import type { Cinema2MockState } from './useCinema2MockState'

// ── Cinema2CanvasMockup ──────────────────────────────────────────────────────
//
// Center stage, Cinema 2.0 engine. Defaults to the application icon review
// sheet; the selected filmstrip still remains available under Concept preview.

export function Cinema2CanvasMockup({ state }: { state: Cinema2MockState }) {
  const [surface, setSurface] = useState<'icons' | 'preview'>('icons')
  return (
    <div className="llai-workspace">
      <div className="llai-tabs" role="tablist" aria-label="Cinema 2.0 visualizer content">
        <button type="button" role="tab" id="ll-c2-icons-tab" aria-selected={surface === 'icons'} aria-controls="ll-c2-center-panel" onClick={() => setSurface('icons')}>Icons</button>
        <button type="button" role="tab" id="ll-c2-preview-tab" aria-selected={surface === 'preview'} aria-controls="ll-c2-center-panel" onClick={() => setSurface('preview')}>Concept preview</button>
      </div>
      <div className="llai-content" role="tabpanel" id="ll-c2-center-panel" aria-labelledby={surface === 'icons' ? 'll-c2-icons-tab' : 'll-c2-preview-tab'}>
        {surface === 'icons' ? <AppIconGallery /> : <Cinema2ConceptPreview state={state} />}
      </div>
    </div>
  )
}

function Cinema2ConceptPreview({ state }: { state: Cinema2MockState }) {
  if (!state.selectedPreset || !state.selectedStill) {
    return (
      <div className="rv-layout-lab-cinema2-canvas" aria-label="Cinema 2.0 concept preview (mockup)">
        <div className="rv-layout-lab-cinema2-empty">Select a preset, then a still, to preview it here.</div>
      </div>
    )
  }

  return (
    <div className="rv-layout-lab-cinema2-canvas" aria-label="Cinema 2.0 concept preview (mockup)">
      <div className="rv-layout-lab-cinema2-stage">
        <Cinema2StillPreview still={state.selectedStill} uid="ll-c2-canvas" />
      </div>
      <div className="rv-layout-lab-cinema2-canvas-status">
        <span>CONCEPT MOCKUP</span>
        <strong>{state.selectedPreset.name}</strong>
        <small>{state.selectedStill.label}</small>
      </div>
    </div>
  )
}
