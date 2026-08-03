/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { useContextualHelpStore } from '../../../features/contextualHelp/contextualHelpStore'
import { CANVAS_REACT_CONTROL_GROUPS, CanvasEngineFxPanel } from './ReactCanvasEngineShell'

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({
    currentTrackId: null,
    currentAnalysis: null,
    duration: 0,
  }),
}))

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  useContextualHelpStore.setState({ infoEnabled: true })
  useReactStore.getState().resetReactView()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('CANVAS right-panel control contract', () => {
  it('exposes Particle Quality with the other particle controls', () => {
    const particleGroup = CANVAS_REACT_CONTROL_GROUPS.find(group => group.title === 'Motion + Particles')

    expect(particleGroup?.controls).toEqual(expect.arrayContaining([
      'particleDensity',
      'particleSize',
      'particleColorMode',
      'particleQuality',
    ]))
  })

  it('renders Display before orchestration and CANVAS React Controls', () => {
    act(() => root.render(<CanvasEngineFxPanel />))
    const labels = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())
    const sourceIndex = labels.indexOf('CANVAS Source Link')
    const displayIndex = labels.indexOf('Display')
    const orchestrationIndex = labels.indexOf('Performance Orchestration')
    const reactControlsIndex = labels.indexOf('CANVAS React Controls')
    const timingIndex = labels.indexOf('Video Timing')

    expect(sourceIndex).toBeGreaterThanOrEqual(0)
    expect(displayIndex).toBeGreaterThan(sourceIndex)
    expect(orchestrationIndex).toBeGreaterThan(displayIndex)
    expect(reactControlsIndex).toBeGreaterThan(orchestrationIndex)
    expect(timingIndex).toBeGreaterThan(reactControlsIndex)
  })

  it('places explicit info triggers beside CANVAS controls without changing the control contract', () => {
    act(() => root.render(<CanvasEngineFxPanel />))

    const helpIds = [...host.querySelectorAll<HTMLButtonElement>('.drm-help-info-trigger')]
      .map(button => button.dataset.helpId)

    expect(helpIds).toEqual(expect.arrayContaining([
      'react.canvas.sourceAndDisplay.sourceLink.autoSelect',
      'react.canvas.sourceAndDisplay.display.fitMode',
      'react.canvas.sourceAndDisplay.display.scale',
      'react.canvas.sourceAndDisplay.display.positionX',
      'react.canvas.sourceAndDisplay.display.positionY',
      'react.canvas.sourceAndDisplay.display.rotation',
      'react.canvas.sourceAndDisplay.display.outputOpacity',
      'react.canvas.performanceOrchestration.autoPerformance',
      'react.canvas.performanceOrchestration.performanceShow',
      'react.canvas.performanceOrchestration.autoRole',
      'react.canvas.performanceOrchestration.composition',
      'react.canvas.performanceOrchestration.layerComplexity',
      'react.canvas.performanceOrchestration.transitionDensity',
      'react.canvas.performanceOrchestration.effectIntensity',
      'react.canvas.performanceOrchestration.motionIntensity',
      'react.canvas.performanceOrchestration.cutDensity',
      'react.canvas.reactControls.sourceAndReactivity.drySourceMix',
      'react.canvas.reactControls.sourceAndReactivity.visualIntensity',
      'react.canvas.reactControls.sourceAndReactivity.bassReactivity',
      'react.canvas.reactControls.sourceAndReactivity.beatPulse',
      'react.canvas.reactControls.fx.glowAmount',
      'react.canvas.reactControls.fx.trailAmount',
      'react.canvas.reactControls.fx.rgbSplit',
      'react.canvas.reactControls.fx.glitchAmount',
      'react.canvas.reactControls.fx.stutterRate',
      'react.canvas.reactControls.fx.lumaThreshold',
      'react.canvas.videoTiming.triggerOn',
      'react.canvas.videoTiming.clipStartSeconds',
      'react.canvas.videoTiming.clipEndSeconds',
      'react.canvas.videoTiming.loopClipRange',
      'react.canvas.videoTiming.loopFullVideo',
      'react.canvas.videoTiming.restartOnDrop',
      'react.canvas.videoTiming.restartOnSectionChange',
      'react.canvas.videoTiming.restartOnManualPresetChange',
      'react.canvas.videoTiming.sectionTriggerMapping.overview',
    ]))

    const motionGroup = [...host.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .find(button => button.textContent?.includes('Motion + Particles'))
    expect(motionGroup).toBeDefined()
    act(() => motionGroup?.click())

    const expandedHelpIds = [...host.querySelectorAll<HTMLButtonElement>('.drm-help-info-trigger')]
      .map(button => button.dataset.helpId)
    expect(expandedHelpIds).toEqual(expect.arrayContaining([
      'react.canvas.reactControls.motionAndParticles.motionAmount',
      'react.canvas.reactControls.motionAndParticles.turbulence',
      'react.canvas.reactControls.motionAndParticles.particleDensity',
      'react.canvas.reactControls.motionAndParticles.particleSize',
      'react.canvas.reactControls.motionAndParticles.particleColorMode',
      'react.canvas.reactControls.motionAndParticles.particleQuality',
    ]))
  })
})
