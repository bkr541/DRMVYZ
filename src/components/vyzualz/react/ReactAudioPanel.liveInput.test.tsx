/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'

const liveControls = vi.hoisted(() => ({
  setLiveInputSensitivity: vi.fn(),
  setLiveInputNoiseGate: vi.fn(),
}))

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({
    source: 'microphone',
    liveInputActive: true,
    liveInputSensitivity: 1,
    setLiveInputSensitivity: liveControls.setLiveInputSensitivity,
    liveInputNoiseGate: 0.02,
    setLiveInputNoiseGate: liveControls.setLiveInputNoiseGate,
  }),
}))

vi.mock('../../../stores/reactStore', () => ({
  useReactStore: (selector: (state: { activeReactEngineId: string }) => unknown) => selector({ activeReactEngineId: 'placeholder' }),
}))

import { ReactAudioPanel } from './ReactAudioPanel'

describe('ReactAudioPanel Live Input analysis', () => {
  let root: Root
  let host: HTMLDivElement
  let rafCallbacks: FrameRequestCallback[]

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    rafCallbacks = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    AudioFeatureBus.setAuthoritativeFramePublisherId(null)
    AudioFeatureBus.reset()

    act(() => {
      root.render(<ReactAudioPanel />)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the restrained Live Input metrics and updates them from the shared bus without React state churn', () => {
    AudioFeatureBus.setAuthoritativeFramePublisherId('audio:live-input')
    AudioFeatureBus.setFrame({
      ...DEFAULT_MI_FRAME,
      frameId: 11,
      sourceId: 'live-input:11',
      bands: {
        ...DEFAULT_MI_FRAME.bands,
        volume: 0.72,
        bass: 0.61,
        lowMid: 0.4,
        mid: 0.6,
        high: 0.5,
        air: 0.7,
      },
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 128,
        bpmConfidence: 0.82,
        bpmSource: 'live_analysis',
        beatHit: true,
        beatIndex: 7,
        beatEventId: 7,
        beatEventTimeSec: 3.75,
        transient: 0.75,
        kickHit: true,
        kickStrength: 0.9,
        snareHit: true,
        snareStrength: 0.8,
      },
      capabilities: {
        ...DEFAULT_MI_FRAME.capabilities!,
        liveBands: true,
        rhythmEvents: true,
        beatGrid: true,
      },
      energy: {
        ...DEFAULT_MI_FRAME.energy,
        instant: 0.68,
        spectralFlux: 0.08,
      },
    }, 'audio:live-input')

    act(() => {
      const callback = rafCallbacks.shift()
      callback?.(16)
    })

    const rowValue = (label: string) => {
      const row = Array.from(host.querySelectorAll<HTMLElement>('.vz-mi-row'))
        .find(element => element.querySelector('.vz-mi-row-label')?.textContent === label)
      return row?.querySelector('.vz-mi-row-val')?.textContent
    }

    expect(host.textContent).toContain('Live Input')
    expect(host.textContent).toContain('Capture')
    expect(host.textContent).toContain('LIVE')
    expect(host.textContent).toContain('BPM')
    expect(host.textContent).toContain('128.0')
    expect(host.textContent).toContain('82%')
    expect(host.textContent).toContain('LOCKED')
    expect(rowValue('Volume')).toBe('0.72')
    expect(rowValue('Bass')).toBe('0.61')
    expect(rowValue('Mids')).toBe('0.50')
    expect(rowValue('Highs')).toBe('0.60')
    expect(rowValue('Energy')).toBe('0.68')
    expect(rowValue('Spectral Move')).toBe('0.64')
    expect(rowValue('Transient')).toBe('0.75')
    expect(rowValue('Kick')).toBe('0.90')
    expect(rowValue('Snare')).toBe('0.80')
    expect(host.textContent).toContain('Kick events1')
    expect(host.textContent).toContain('Snare events1')
    const beatDotItem = Array.from(host.querySelectorAll<HTMLElement>('.vz-mi-dot-item'))
      .find(element => element.querySelector('.vz-mi-dot-label')?.textContent === 'Beat')
    expect(beatDotItem?.querySelector('.vz-mi-dot')?.className).toContain('vz-mi-dot--on')
    expect(host.querySelector('[data-live-input-structural-status="unavailable"]')?.textContent).toContain('UNAVAILABLE')
    expect(host.textContent).toContain('not fabricated for Live Input')
    expect(host.textContent).not.toContain('Semantic')
    expect(host.querySelector<HTMLInputElement>('#live-input-analysis-sensitivity')?.value).toBe('1')
    expect(host.querySelector<HTMLInputElement>('#live-input-analysis-noise-gate')?.value).toBe('0.02')
    expect(host.textContent).toContain('Live Input remains inaudible')
  })
})
