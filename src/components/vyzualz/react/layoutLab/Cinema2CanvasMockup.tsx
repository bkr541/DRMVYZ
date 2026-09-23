import { Cinema2StillPreview } from './Cinema2StillPreview'
import type { Cinema2MockState } from './useCinema2MockState'

// ── Cinema2CanvasMockup ──────────────────────────────────────────────────────
//
// Center stage, Cinema 2.0 engine. Shows the still currently selected from
// the left-rail filmstrip at full size, matching the status-bar treatment
// the other engine canvas mockups (PixGrid/LaserDMX/Canvas) already use.

export function Cinema2CanvasMockup({ state }: { state: Cinema2MockState }) {
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
