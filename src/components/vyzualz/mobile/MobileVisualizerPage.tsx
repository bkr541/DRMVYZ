import { forwardRef } from 'react'
import { MobileAudioPanel } from './MobileAudioPanel'

/**
 * Visualizer: the stage on top and the audio source below it. The stage itself is owned by the shell (it must keep running while the user
 * is on another page), which places it over the slot rendered here. With no preset selected the slot shows a notice instead.
 */
export const MobileVisualizerPage = forwardRef<HTMLDivElement, { hasPreset: boolean }>(function MobileVisualizerPage({ hasPreset }, slotRef) {
  return <div className="mpm-panel-content mpm-visualizer">
    <div className="mpm-output-canvas mobile-stage-slot" ref={slotRef} aria-label="Visualizer output" data-has-preset={hasPreset}>
      {!hasPreset && <div className="mobile-stage-empty" role="status">
        <strong>Select preset to display</strong>
        <span>Choose one on the Perform page, or fire a pad.</span>
      </div>}
    </div>
    <div className="mpm-scroll" data-mpm-scroll="visualizer"><MobileAudioPanel /></div>
  </div>
})
