/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
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
})
