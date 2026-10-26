import { useState } from 'react'
import { OaLed } from './oaControls'

// ── Option A · stage ───────────────────────────────────────────────────────────────────────────────────────────
//
// The visualizer's frame, built as a viewport instrument: a bezel with crop marks, a status strip on top, a format strip
// below, and two working guide keys (rule-of-thirds grid and title-safe area) that draw over the picture. The picture
// itself stays empty in Layout Lab, as in the other options, because nothing renders here; the frame says so.

export function OptionAStage() {
  const [grid, setGrid] = useState(false)
  const [safe, setSafe] = useState(false)

  return (
    <section className="oa-stage" role="region" aria-label="Layout Lab visualizer">
      <div className="oa-stage__bar">
        <span className="oa-stage__status"><OaLed on={false} tone="red" />Viewport</span>
        <span className="oa-stage__note">Preview · no output</span>
      </div>
      <div className="oa-stage__screen" data-grid={grid} data-safe={safe}>
        <i className="oa-stage__crop oa-stage__crop--tl" />
        <i className="oa-stage__crop oa-stage__crop--tr" />
        <i className="oa-stage__crop oa-stage__crop--bl" />
        <i className="oa-stage__crop oa-stage__crop--br" />
        <span className="oa-stage__guide oa-stage__guide--grid" aria-hidden="true" />
        <span className="oa-stage__guide oa-stage__guide--safe" aria-hidden="true" />
      </div>
      <div className="oa-stage__bar oa-stage__bar--foot">
        <span className="oa-stage__format">1920 × 1080<small>16:9</small></span>
        <span className="oa-stage__guides" role="group" aria-label="Guides">
          <button type="button" className="oa-chip" aria-pressed={grid} data-selected={grid} onClick={() => setGrid(value => !value)}>Grid</button>
          <button type="button" className="oa-chip" aria-pressed={safe} data-selected={safe} onClick={() => setSafe(value => !value)}>Safe area</button>
        </span>
      </div>
    </section>
  )
}
