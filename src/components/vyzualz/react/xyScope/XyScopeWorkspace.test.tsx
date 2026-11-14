// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEnginePanel } from '../ReactEnginePanel'
import {
  XyScopeDesignPanel,
  XyScopeEnginePanel,
  XyScopePresetsPanel,
  XyScopeReactivityPanel,
  XyScopeSurface,
} from './XyScopeWorkspace'

vi.mock('../../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({ currentAudioTrackId: null }),
}))

vi.mock('../ReactAudioPanel', () => ({
  ReactAudioPanel: () => <div data-xyscope-shared-analysis="true">Shared Music Analysis</div>,
}))

vi.mock('../../../../features/lyrics/runtime/useLyricPlayback', () => ({
  useLyricPlaybackSelector: (selector: (state: Record<string, unknown>) => unknown) => selector({
    activeCue: null, activeWord: null, documentId: null, sourceIdentity: null,
  }),
}))

let container: HTMLElement
let root: ReturnType<typeof createRoot>
let nextRafId = 1
let rafCallbacks = new Map<number, FrameRequestCallback>()
let fillRect: ReturnType<typeof vi.fn>
let stroke: ReturnType<typeof vi.fn>

function setInputValue(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  nextRafId = 1
  rafCallbacks = new Map()
  fillRect = vi.fn()
  stroke = vi.fn()
  vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return {
      canvas: this, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalCompositeOperation: 'source-over',
      setTransform: vi.fn(), fillRect, stroke,
    } as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}),
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { rafCallbacks.delete(id) }))
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn() })

  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('xyScope')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Sound Drawing XY engine selection', () => {
  it('enters as a standalone, preset-free engine with its own defaults', () => {
    const state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('xyScope')
    expect(state.activeReactPresetId).toBeNull()
    expect(state.xyScopeSettings.text).toBe('DRMVYZ')
    expect(state.xyScopeSettings.presetId).toBe('conversation')
  })
})

describe('Sound Drawing XY Design inspector standard', () => {
  it('shows Master Controls, Design, React and Palette in that order', async () => {
    await act(async () => root.render(<XyScopeDesignPanel />))
    const groups = container.querySelector('[data-xyscope-design-groups]')
    expect(groups?.getAttribute('data-xyscope-design-groups')).toBe('master-controls design react palette')
    const ids = [...container.querySelectorAll('[data-xyscope-parent-group]')].map(node => node.getAttribute('data-xyscope-parent-group'))
    expect(ids).toEqual(['master-controls', 'design', 'react', 'palette'])
    // The visible group headers, not control text, carry the four standard labels in order.
    const standard = ['Master Controls', 'Design', 'React', 'Palette']
    const headers = [...(groups?.querySelectorAll('button[aria-expanded]') ?? [])]
      .map(button => button.textContent?.trim() ?? '')
      .filter(label => standard.includes(label))
    expect(headers).toEqual(standard)
  })

  it('puts each control under its own group and every control carries a plain description', async () => {
    await act(async () => root.render(<XyScopeDesignPanel />))
    const group = (id: string) => container.querySelector(`[data-xyscope-parent-group="${id}"]`)?.textContent ?? ''
    expect(group('master-controls')).toContain('Master Intensity')
    expect(group('master-controls')).toContain('Audio Reactivity')
    expect(group('master-controls')).toContain('Motion Amount')
    expect(group('master-controls')).toContain('BPM Sync')
    expect(group('design')).toContain('Phosphor Trail')
    expect(group('design')).toContain('Ignore Small Pieces')
    expect(group('react')).toContain('Form Response')
    expect(group('react')).toContain('Snare Fray')
    expect(group('react')).toContain('Answer Delay')
    expect(group('react')).toContain('Line Vibration')
    expect(group('palette')).toContain('Beam Core')
    expect(group('palette')).toContain('Beam Glow')
    expect(group('palette')).toContain('Background')
    expect(container.querySelectorAll('.rv-ctrl-description').length).toBeGreaterThanOrEqual(14)
    // No label is a cryptic routing arrow.
    expect(container.textContent).not.toMatch(/→\s*(Scale|Twist|Jitter|Bloom)/)
  })

  it('nests Pattern, Letters and Beam inside Design, with Pattern first and its controls in the Cinema 2.0 order', async () => {
    await act(async () => root.render(<XyScopeDesignPanel />))
    const subgroups = [...container.querySelectorAll('[data-xyscope-parent-group="design"] [data-xyscope-subgroup]')].map(node => node.getAttribute('data-xyscope-subgroup'))
    expect(subgroups).toEqual(['Pattern', 'Letters', 'Beam'])
    const pattern = container.querySelector('[data-xyscope-subgroup="Pattern"]')!
    const text = pattern.textContent ?? ''
    const order = ['Pattern', 'Pattern Change', 'Trigger', 'Transition Length'].map(label => text.indexOf(label))
    expect(order.every(index => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(container.querySelector('#xyscope-parameter-patternChange')).not.toBeNull()
  })

  it('writes a slider change to the store and keeps the preset id', async () => {
    await act(async () => root.render(<XyScopeDesignPanel />))
    const slider = container.querySelector<HTMLInputElement>('#xyscope-parameter-dissolveDepth')!
    await act(async () => setInputValue(slider, '1.5'))
    const state = useReactStore.getState().xyScopeSettings
    expect(state.parameters.dissolveDepth).toBe(1.5)
    expect(state.presetId).toBe('conversation')
  })

  it('hides Trigger while Pattern Change is off, keeps its value, and brings it back', async () => {
    await act(async () => root.render(<XyScopeDesignPanel />))
    expect(container.querySelector('#xyscope-parameter-trigger')).not.toBeNull()
    await act(async () => container.querySelector<HTMLElement>('#xyscope-parameter-patternChange')?.click())
    expect(useReactStore.getState().xyScopeSettings.parameters.patternChange).toBe(false)
    expect(container.querySelector('#xyscope-parameter-trigger')).toBeNull()
    expect(useReactStore.getState().xyScopeSettings.parameters.trigger).toBe('bar')
    await act(async () => container.querySelector<HTMLElement>('#xyscope-parameter-patternChange')?.click())
    expect(container.querySelector('#xyscope-parameter-trigger')).not.toBeNull()
  })

  it('resets parameters to the active preset and leaves the word, font and preset alone', async () => {
    await act(async () => useReactStore.getState().setXyScopeSettings({ text: 'HELLO', fontId: 'font-1' }))
    await act(async () => root.render(<XyScopeDesignPanel />))
    const reset = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Reset Parameters') as HTMLButtonElement
    expect(reset().disabled).toBe(true)
    await act(async () => setInputValue(container.querySelector<HTMLInputElement>('#xyscope-parameter-vibration')!, '0.2'))
    expect(reset().disabled).toBe(false)
    await act(async () => reset().click())
    const state = useReactStore.getState().xyScopeSettings
    expect(state.parameters.vibration).toBe(1)
    expect(state.text).toBe('HELLO')
    expect(state.fontId).toBe('font-1')
    expect(state.presetId).toBe('conversation')
  })
})

describe('Sound Drawing XY source, presets and React tab', () => {
  it('edits the word and opens the font menu below the field even with more room above', async () => {
    container.className = 'vz-inspector'
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
      if (this.id === 'xyscope-font') return { left: 45, top: 500, right: 305, bottom: 530, width: 260, height: 30 } as DOMRect
      if (this === container) return { left: 20, top: 40, right: 340, bottom: 700, width: 320, height: 660 } as DOMRect
      return { left: 0, top: 0, right: 260, bottom: 420, width: 260, height: 420 } as DOMRect
    })
    await act(async () => root.render(<XyScopeEnginePanel />))
    // The word and font sit in one standard parent group named Input.
    const group = container.querySelector('[data-xyscope-input-group="true"]')!
    expect(container.textContent).toContain('Input')
    expect(group.querySelector('#xyscope-text')).not.toBeNull()
    expect(group.querySelector('#xyscope-font')).not.toBeNull()
    expect(container.textContent).toContain('Anton (default)')
    // Only the Font dropdown has a menu search; the word field is an ordinary text input.
    await act(async () => container.querySelector<HTMLElement>('#xyscope-font')!.click())
    expect(document.body.querySelector('.drm-dropdown__menu-search input[aria-label="Search fonts…"]')).not.toBeNull()
    const menu = document.body.querySelector<HTMLElement>('[role="listbox"]')!
    expect(menu.dataset.placement).toBe('below')
    expect(parseFloat(menu.style.top)).toBe(540)
    expect(parseFloat(menu.style.maxHeight)).toBe(148)
    expect(parseFloat(menu.style.width)).toBe(260)
    const text = container.querySelector<HTMLInputElement>('#xyscope-text')!
    await act(async () => setInputValue(text, 'WILDFLY'))
    expect(useReactStore.getState().xyScopeSettings.text).toBe('WILDFLY')
  })

  it('defaults to TEXT and preserves text settings while browsing source cards', async () => {
    await act(async () => root.render(<XyScopeEnginePanel />))
    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>('.rv-xyscope-source-grid button'))
    expect(cards.map(card => card.textContent)).toEqual(['TEXT', 'SVG', 'OSCILATOR'])
    expect(cards[0].getAttribute('aria-pressed')).toBe('true')
    const settings = useReactStore.getState().xyScopeSettings
    for (const card of cards.slice(1)) {
      await act(async () => card.click())
      expect(card.getAttribute('aria-pressed')).toBe('true')
      expect(container.querySelector('#xyscope-text')).toBeNull()
      expect(container.querySelector('#xyscope-font')).toBeNull()
      expect(useReactStore.getState().xyScopeSettings.text).toBe(settings.text)
      expect(useReactStore.getState().xyScopeSettings.fontId).toBe(settings.fontId)
      expect(useReactStore.getState().xyScopeSettings.sourceMode).toBe(card === cards[1] ? 'svg' : 'oscillator')
    }
    await act(async () => cards[0].click())
    expect(container.querySelector<HTMLInputElement>('#xyscope-text')?.value).toBe(settings.text)
    expect(container.querySelector('#xyscope-font')).not.toBeNull()
  })

  it('renders this engine in the left panel through the shared engine panel', async () => {
    await act(async () => root.render(<ReactEnginePanel />))
    expect(container.querySelector('[data-xyscope-engine-panel="true"]')).not.toBeNull()
  })

  it('lists the presets, loads one, and marks it Modified after a manual edit', async () => {
    await act(async () => root.render(<XyScopePresetsPanel />))
    const card = (id: string) => container.querySelector<HTMLElement>(`[data-xyscope-preset-id="${id}"]`)
    expect(['conversation', 'clean-scope', 'storm'].every(id => card(id) !== null)).toBe(true)
    await act(async () => card('storm')?.click())
    const settings = useReactStore.getState().xyScopeSettings
    expect(settings.presetId).toBe('storm')
    expect(settings.parameters.dissolveDepth).toBe(1.5)
    await act(async () => useReactStore.getState().setXyScopeSettings({ parameters: { ...settings.parameters, dissolveDepth: 0.4 } }))
    expect(useReactStore.getState().xyScopeSettings.presetId).toBe('storm')
  })

  it('keeps shared music analysis on the React tab and points to Design → React', async () => {
    await act(async () => root.render(<XyScopeReactivityPanel />))
    expect(container.querySelector('[data-xyscope-react-note="true"]')?.textContent).toContain('Design → React')
    expect(container.querySelector('[data-xyscope-shared-analysis="true"]')).not.toBeNull()
  })
})

describe('Sound Drawing XY audio ownership', () => {
  // Regression: in the app, music analysis is published by whichever surface is active. A surface that only reads
  // the shared audio bus sees an empty frame forever, so no kick, beat or bar ever reaches the choreography.
  function fakeAnalyser(): AnalyserNode {
    return {
      context: { sampleRate: 48000 },
      frequencyBinCount: 1024,
      fftSize: 2048,
      getByteFrequencyData: (data: Uint8Array) => { for (let i = 0; i < data.length; i += 1) data[i] = i < 12 ? 220 : 40 },
      getByteTimeDomainData: (data: Uint8Array) => { for (let i = 0; i < data.length; i += 1) data[i] = 128 + Math.round(60 * Math.sin(i * 0.3)) },
    } as unknown as AnalyserNode
  }

  it('pumps the analyser into the shared audio path under its own publisher id when nothing else does', async () => {
    const { AudioFeatureBus } = await import('../../../../features/musicIntelligence/AudioFeatureBus')
    const { musicIntelligenceEngine } = await import('../../../../features/musicIntelligence/MusicIntelligenceEngine')
    musicIntelligenceEngine.initialize({ sampleRate: 48000 })
    AudioFeatureBus.reset()
    const analyser = fakeAnalyser()
    let time = 5
    await act(async () => root.render(
      <XyScopeSurface analyser={analyser} isPlaying audio={{ trackIdentity: 'track-1', getAudioTime: () => time }} />,
    ))
    expect(AudioFeatureBus.getFrame().frameId).toBe(0)
    for (let i = 0; i < 4; i += 1) {
      time += 1 / 60
      const [id, callback] = rafCallbacks.entries().next().value as [number, FrameRequestCallback]
      rafCallbacks.delete(id)
      await act(async () => callback(16 * (i + 1)))
    }
    expect(AudioFeatureBus.getFrame().frameId).toBeGreaterThan(0)
    expect(AudioFeatureBus.getFramePublicationMeta().publisherId).toBe('react:xyScope')
    expect(AudioFeatureBus.getFrame().timeSec).toBeCloseTo(time, 1)
  })

  it('delivers playing audio to letter motion and automatic pattern choreography', async () => {
    const { AudioFeatureBus } = await import('../../../../features/musicIntelligence/AudioFeatureBus')
    const { musicIntelligenceEngine } = await import('../../../../features/musicIntelligence/MusicIntelligenceEngine')
    const { XyScopeRuntime } = await import('./XyScopeRuntime')
    const { XyScopeBeamRenderer } = await import('./XyScopeBeam')
    const positions: number[] = []
    const draw = XyScopeBeamRenderer.prototype.draw
    vi.spyOn(XyScopeBeamRenderer.prototype, 'draw').mockImplementation(function (this: InstanceType<typeof XyScopeBeamRenderer>, ...args) {
      positions.push(args[1][0]?.x[0] ?? 0)
      return draw.apply(this, args)
    })
    musicIntelligenceEngine.initialize({ sampleRate: 48000 })
    musicIntelligenceEngine.setEffectiveBpm(120, 1, 0, 60)
    AudioFeatureBus.setAuthoritativeFramePublisherId(null)
    AudioFeatureBus.reset()
    let time = 0
    vi.spyOn(performance, 'now').mockImplementation(() => time * 1000)
    const render = vi.spyOn(XyScopeRuntime.prototype, 'renderFrame')
    const status = vi.spyOn(XyScopeRuntime.prototype, 'getStatus')
    const analyser = fakeAnalyser()
    analyser.getByteFrequencyData = data => {
      const hit = time % 0.5 < 0.08
      for (let i = 0; i < data.length; i += 1) data[i] = hit && i < 12 ? 255 : 0
    }
    await act(async () => root.render(<XyScopeSurface analyser={analyser} isPlaying analysisActive audio={{ trackIdentity: 'track-motion', getAudioTime: () => time }} />))
    for (let i = 0; i < 480; i += 1) {
      time += 1 / 30
      const [id, callback] = rafCallbacks.entries().next().value as [number, FrameRequestCallback]
      rafCallbacks.delete(id)
      await act(async () => callback(time * 1000))
    }
    const frames = render.mock.calls.map(([input]) => input)
    expect(frames.some(input => input.context?.boundaries.barBoundary)).toBe(true)
    expect(frames.filter(input => input.context?.seekDetected)).toHaveLength(0)
    expect(new Set(status.mock.results.map(result => result.value.pattern))).toEqual(new Set(['word', 'waveform', 'scope', 'ring', 'rosette', 'weave', 'pinwheel']))
    expect(frames.some(input => input.context?.kick)).toBe(true)
    expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(10)
  })

  it('does not publish anything when it has no analyser, and still draws', async () => {
    const { AudioFeatureBus } = await import('../../../../features/musicIntelligence/AudioFeatureBus')
    AudioFeatureBus.reset()
    await act(async () => root.render(<XyScopeSurface audio={{ trackIdentity: 'track-1' }} />))
    const [id, callback] = rafCallbacks.entries().next().value as [number, FrameRequestCallback]
    rafCallbacks.delete(id)
    await act(async () => callback(16))
    expect(AudioFeatureBus.getFrame().frameId).toBe(0)
    expect(stroke).toHaveBeenCalled()
  })
})

describe('Sound Drawing XY surface', () => {
  it('draws to its own canvas, reports it for recording, and releases everything on unmount', async () => {
    const onCanvasReady = vi.fn()
    await act(async () => root.render(<XyScopeSurface onCanvasReady={onCanvasReady} onLiveFps={vi.fn()} />))
    const canvas = container.querySelector<HTMLCanvasElement>('[data-xyscope-output-canvas="true"]')
    expect(canvas).not.toBeNull()
    expect(onCanvasReady).toHaveBeenCalledWith(canvas)
    expect(rafCallbacks.size).toBe(1)

    const [id, callback] = rafCallbacks.entries().next().value as [number, FrameRequestCallback]
    rafCallbacks.delete(id)
    await act(async () => callback(16))
    expect(fillRect).toHaveBeenCalled()
    expect(stroke).toHaveBeenCalled()
    expect(rafCallbacks.size).toBe(1)

    await act(async () => root.render(null))
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
    expect(rafCallbacks.size).toBe(0)
  })

  it('keeps drawing the word while nothing is playing and reports the missing stereo signal honestly', async () => {
    await act(async () => root.render(<XyScopeSurface audio={{ trackIdentity: 'track-1' }} />))
    const [id, callback] = rafCallbacks.entries().next().value as [number, FrameRequestCallback]
    rafCallbacks.delete(id)
    await act(async () => callback(16))
    expect(stroke).toHaveBeenCalled()
    expect(container.textContent).toContain('No live stereo signal')
  })
})
