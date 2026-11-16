// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, XY_SCOPE_PRESETS, type XyScopeSourceMode } from './XyScopeSettings'
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
  it.each(['text', 'textV2'] as const)('adds and edits up to five text inputs in %s with a centered plus below the font', async sourceMode => {
    useReactStore.getState().setXyScopeSettings({ sourceMode })
    await act(async () => root.render(<XyScopeEnginePanel />))
    const add = container.querySelector<HTMLButtonElement>('button[aria-label="Add text input"]')!
    expect(add.parentElement?.style.justifyContent).toBe('center')
    expect(container.querySelector('#xyscope-font')!.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (let i = 2; i <= 5; i += 1) {
      await act(async () => add.click())
      const input = container.querySelector<HTMLInputElement>(`#xyscope-text-${i}`)!
      expect(input).not.toBeNull()
      await act(async () => setInputValue(input, `WORD ${i}`))
    }
    expect(useReactStore.getState().xyScopeSettings.additionalTexts).toEqual(['WORD 2', 'WORD 3', 'WORD 4', 'WORD 5'])
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(5)
    expect(add.disabled).toBe(true)
    await act(async () => add.click())
    expect(useReactStore.getState().xyScopeSettings.additionalTexts).toHaveLength(4)
  })

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
    expect(cards.map(card => card.textContent)).toEqual(['TEXT', 'SVG', 'OSCILATOR', 'WIREFRAME'])
    expect(cards[0].getAttribute('aria-pressed')).toBe('true')
    const settings = useReactStore.getState().xyScopeSettings
    for (const card of cards.slice(1)) {
      await act(async () => card.click())
      expect(card.getAttribute('aria-pressed')).toBe('true')
      expect(container.querySelector('#xyscope-text')).toBeNull()
      expect(container.querySelector('#xyscope-font')).toBeNull()
      expect(useReactStore.getState().xyScopeSettings.text).toBe(settings.text)
      expect(useReactStore.getState().xyScopeSettings.fontId).toBe(settings.fontId)
      expect(useReactStore.getState().xyScopeSettings.sourceMode).toBe(card === cards[1] ? 'svg' : card === cards[3] ? 'wire' : 'oscillator')
    }
    await act(async () => cards[0].click())
    expect(container.querySelector<HTMLInputElement>('#xyscope-text')?.value).toBe(settings.text)
    expect(container.querySelector('#xyscope-font')).not.toBeNull()
  })

  it('offers compact Text V2 performance controls and restores manual audio style when Auto is off', async () => {
    useReactStore.getState().setXyScopeSettings({ sourceMode: 'textV2' })
    const manualParameters = { ...useReactStore.getState().xyScopeSettings.parameters }
    await act(async () => root.render(<XyScopeDesignPanel />))
    expect(container.querySelector('[data-text-v2-design]')).not.toBeNull()
    expect(container.querySelector('#xyscope-v2-auto')).not.toBeNull()
    expect(container.querySelector('#xyscope-v2-grouping')?.textContent).toContain('Both')
    expect(container.querySelector('#xyscope-v2-style')).toBeNull()
    expect(container.querySelector('#xyscope-parameter-pattern')).toBeNull()
    expect(container.querySelector('#xyscope-parameter-dissolveDepth')).toBeNull()
    expect(container.querySelectorAll('input[type="range"]').length).toBe(5)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-v2-auto')!.click())
    expect(useReactStore.getState().xyScopeSettings.textV2.autoPerformance).toBe(false)
    expect(container.querySelector('#xyscope-v2-style')).not.toBeNull()
    await act(async () => container.querySelector<HTMLElement>('#xyscope-v2-grouping')!.click())
    const option = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]')).find(element => element.textContent?.trim() === 'Individual Letter Oscillators')!
    await act(async () => option.click())
    expect(useReactStore.getState().xyScopeSettings.textV2.grouping).toBe('letters')
    expect(useReactStore.getState().xyScopeSettings.parameters).toEqual(manualParameters)
  })

  it('selects Text V2 as a TEXT preset with the same text, font, add button and letter controls', async () => {
    await act(async () => root.render(<><XyScopeEnginePanel /><XyScopePresetsPanel /><XyScopeDesignPanel /></>))
    const card = container.querySelector<HTMLElement>('[data-xyscope-preset-id="textV2"]')!
    await act(async () => card.click())
    const textCard = Array.from(container.querySelectorAll<HTMLButtonElement>('.rv-xyscope-source-grid button')).find(button => button.textContent === 'TEXT')!
    expect(textCard.getAttribute('aria-pressed')).toBe('true')
    expect(useReactStore.getState().xyScopeSettings.sourceMode).toBe('textV2')
    expect(useReactStore.getState().xyScopeSettings.presetId).toBe('textV2')
    expect(container.querySelector('[data-text-v2-design]')).not.toBeNull()
    expect(container.querySelector('#xyscope-font')).not.toBeNull()
    expect(container.querySelector('[aria-label="Add text input"]')).not.toBeNull()
    expect(container.querySelector('#xyscope-parameter-letterSpacing')).not.toBeNull()
    await act(async () => setInputValue(container.querySelector<HTMLInputElement>('#xyscope-text')!, 'VERSION TWO'))
    expect(useReactStore.getState().xyScopeSettings.text).toBe('VERSION TWO')
    await act(async () => textCard.click())
    expect(useReactStore.getState().xyScopeSettings.sourceMode).toBe('textV2')
    await act(async () => container.querySelector<HTMLElement>('[data-xyscope-preset-id="conversation"]')!.click())
    expect(useReactStore.getState().xyScopeSettings.sourceMode).toBe('text')
    expect(container.querySelector('[data-text-v2-design]')).toBeNull()
  })

  it('offers OSC 1 as a preset that keeps the same text input and font dropdown and shows the Text Lab controls', async () => {
    await act(async () => root.render(<><XyScopeEnginePanel /><XyScopePresetsPanel /><XyScopeDesignPanel /></>))
    const card = container.querySelector<HTMLElement>('[data-xyscope-preset-id="osc1"]')!
    expect(card).not.toBeNull()
    expect(card.textContent).toContain('OSC 1')
    await act(async () => card.click())
    const settings = useReactStore.getState().xyScopeSettings
    expect(settings.sourceMode).toBe('osc1')
    expect(settings.presetId).toBe('osc1')
    expect(container.querySelector('.rv-xyscope-source-grid [aria-pressed="true"]')?.textContent).toBe('TEXT')
    // Left window: the same Input group with the text field and font dropdown.
    expect(container.querySelector('#xyscope-text')).not.toBeNull()
    expect(container.querySelector('#xyscope-font')).not.toBeNull()
    // Inspector: four parent groups holding the lab's sixteen sliders (plus letter channels).
    expect(container.querySelector('[data-osc1-design]')).not.toBeNull()
    for (const group of ['master-controls', 'design', 'react', 'palette']) expect(container.querySelector(`[data-xyscope-parent-group="${group}"]`)).not.toBeNull()
    for (const id of ['motion', 'readability', 'depth', 'attack', 'release', 'sensitivity', 'rotation', 'correlation', 'axisX', 'axisY', 'shear', 'harmonics', 'intensity', 'persistence', 'width', 'scan']) {
      expect(container.querySelector(`#xyscope-osc1-${id}`), id).not.toBeNull()
    }
    // Auto Performance starts off, locks the sliders when on and restores them when off.
    expect(container.querySelector<HTMLInputElement>('#xyscope-osc1-motion')!.disabled).toBe(false)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-osc1-auto')!.click())
    expect(useReactStore.getState().xyScopeSettings.osc1.autoPerformance).toBe(true)
    expect(container.querySelector<HTMLInputElement>('#xyscope-osc1-motion')!.disabled).toBe(true)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-osc1-auto')!.click())
    expect(useReactStore.getState().xyScopeSettings.osc1.presets[0].motion).toBe(88)
    // Leaving the preset returns to the standard text source.
    await act(async () => container.querySelector<HTMLElement>('[data-xyscope-preset-id="storm"]')!.click())
    expect(useReactStore.getState().xyScopeSettings.sourceMode).toBe('text')
  })

  it('offers OSC 2 as a preset with the same text input and font dropdown and its own 3D controls', async () => {
    await act(async () => root.render(<><XyScopeEnginePanel /><XyScopePresetsPanel /><XyScopeDesignPanel /></>))
    const card = container.querySelector<HTMLElement>('[data-xyscope-preset-id="osc2"]')!
    expect(card.textContent).toContain('OSC 2')
    await act(async () => card.click())
    expect(useReactStore.getState().xyScopeSettings.sourceMode).toBe('osc2')
    expect(container.querySelector('.rv-xyscope-source-grid [aria-pressed="true"]')?.textContent).toBe('TEXT')
    expect(container.querySelector('#xyscope-text')).not.toBeNull()
    expect(container.querySelector('#xyscope-font')).not.toBeNull()
    expect(container.querySelector('[data-osc2-design]')).not.toBeNull()
    for (const group of ['master-controls', 'design', 'react', 'palette']) expect(container.querySelector(`[data-xyscope-parent-group="${group}"]`)).not.toBeNull()
    for (const id of ['depth', 'layers', 'terrain', 'distance', 'elevation', 'orbitRange', 'orbitSpeed', 'audioDepth', 'kickDolly', 'intensity', 'persistence', 'width', 'scan']) {
      expect(container.querySelector(`#xyscope-osc2-${id}`), id).not.toBeNull()
    }
    await act(async () => container.querySelector<HTMLElement>('#xyscope-osc2-auto')!.click())
    expect(useReactStore.getState().xyScopeSettings.osc2.autoPerformance).toBe(true)
    expect(container.querySelector<HTMLInputElement>('#xyscope-osc2-orbitRange')!.disabled).toBe(true)
  })

  it('offers INIT under the OSCILATOR source with an Input group, the four standard groups and its own controls', async () => {
    await act(async () => root.render(<><XyScopeEnginePanel /><XyScopePresetsPanel /><XyScopeDesignPanel /></>))
    const sourceCard = [...container.querySelectorAll<HTMLElement>('.rv-sound-source-card')].find(el => el.textContent === 'OSCILATOR')!
    await act(async () => sourceCard.click())
    const card = container.querySelector<HTMLElement>('[data-xyscope-preset-id="init"]')!
    expect(card.textContent).toContain('INIT')
    expect(container.querySelector('[data-xyscope-input-group="init"]')).toBeNull()
    await act(async () => card.click())
    const state = () => useReactStore.getState().xyScopeSettings
    expect(state().sourceMode).toBe('init')
    expect(state().presetId).toBe('init')
    // The OSCILATOR source card stays lit; INIT is a preset of it.
    expect(sourceCard.getAttribute('aria-pressed')).toBe('true')
    // Source tab: an Input group with the oscillator count, below the source cards.
    const input = container.querySelector('[data-xyscope-input-group="init"]')!
    expect(input).not.toBeNull()
    expect(container.querySelector('.rv-xyscope-source-grid')!.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('#xyscope-text')).toBeNull()
    expect(input.textContent).toContain('Oscillators')
    // Design: the four standard parent groups, with Master Controls holding BPM Sync and Auto Performance.
    expect(container.querySelector('[data-init-design]')).not.toBeNull()
    const groups = [...container.querySelectorAll('[data-xyscope-parent-group]')].map(el => el.getAttribute('data-xyscope-parent-group'))
    expect(groups).toEqual(['master-controls', 'design', 'react', 'palette'])
    const master = container.querySelector('[data-xyscope-parent-group="master-controls"]')!
    expect(master.querySelector('#xyscope-init-bpm-sync')).not.toBeNull()
    expect(master.querySelector('#xyscope-init-auto')).not.toBeNull()
    const design = container.querySelector('[data-xyscope-parent-group="design"]')!
    for (const id of ['layout', 'signal', 'free-endpoints', 'change-every', 'waveHeight', 'span', 'window', 'glide', 'width', 'glow', 'trail']) {
      expect(design.querySelector(`#xyscope-init-${id}`), id).not.toBeNull()
    }
    for (const id of ['waveResponse', 'kickResponse', 'snareResponse']) expect(container.querySelector(`[data-xyscope-parent-group="react"] #xyscope-init-${id}`), id).not.toBeNull()
    expect(container.querySelector('[data-xyscope-parent-group="palette"] #xyscope-init-color1')).not.toBeNull()
    expect(container.querySelector('#xyscope-init-color2')).toBeNull()
    // The toggles and the count are persisted.
    expect(state().init.values.freeEndpoints).toBe(false)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-init-free-endpoints')!.click())
    expect(state().init.values.freeEndpoints).toBe(true)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-init-bpm-sync')!.click())
    expect(state().init.bpmSync).toBe(false)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-init-auto')!.click())
    expect(state().init.autoPerformance).toBe(true)
    expect(container.querySelector<HTMLInputElement>('#xyscope-init-waveHeight')!.disabled).toBe(true)
    await act(async () => useReactStore.getState().setXyScopeSettings({ init: { ...state().init, oscillators: 3 } }))
    for (const id of ['color1', 'color2', 'color3']) expect(container.querySelector(`#xyscope-init-${id}`), id).not.toBeNull()
    // Selecting the active source keeps its instrument; a standard preset returns to its base source.
    await act(async () => sourceCard.click())
    expect(state().sourceMode).toBe('init')
    await act(async () => container.querySelector<HTMLElement>('[data-xyscope-preset-id="storm"]')!.click())
    expect(state().sourceMode).toBe('oscillator')
    expect(state().presetId).not.toBe('init')
  })

  it('offers OCTA under the OSCILATOR source with the four standard groups and its own controls', async () => {
    await act(async () => root.render(<><XyScopeEnginePanel /><XyScopePresetsPanel /><XyScopeDesignPanel /></>))
    const sourceCard = [...container.querySelectorAll<HTMLElement>('.rv-sound-source-card')].find(el => el.textContent === 'OSCILATOR')!
    await act(async () => sourceCard.click())
    const card = container.querySelector<HTMLElement>('[data-xyscope-preset-id="octa"]')!
    expect(card.textContent).toContain('OCTA')
    await act(async () => card.click())
    const state = () => useReactStore.getState().xyScopeSettings
    expect(state().sourceMode).toBe('octa')
    expect(state().presetId).toBe('octa')
    expect(sourceCard.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[data-octa-design]')).not.toBeNull()
    const groups = [...container.querySelectorAll('[data-xyscope-parent-group]')].map(el => el.getAttribute('data-xyscope-parent-group'))
    expect(groups).toEqual(['master-controls', 'design', 'react', 'palette'])
    const group = (name: string) => container.querySelector(`[data-xyscope-parent-group="${name}"]`)!
    for (const id of ['intensity', 'audioReactivity', 'distortion', 'auto']) expect(group('master-controls').querySelector(`#xyscope-octa-${id}`), id).not.toBeNull()
    for (const id of ['size', 'spread', 'tilt', 'spin', 'axes', 'width', 'glow', 'trail', 'scan']) expect(group('design').querySelector(`#xyscope-octa-${id}`), id).not.toBeNull()
    for (const id of ['energyResponse', 'tumble', 'slew', 'dots', 'wiggle']) expect(group('react').querySelector(`#xyscope-octa-${id}`), id).not.toBeNull()
    for (const id of ['color', 'glow-color', 'background']) expect(group('palette').querySelector(`#xyscope-octa-${id}`), id).not.toBeNull()
    await act(async () => container.querySelector<HTMLElement>('#xyscope-octa-auto')!.click())
    expect(state().octa.autoPerformance).toBe(true)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-octa-axes')!.click())
    expect(state().octa.values.axes).toBe(false)
    await act(async () => sourceCard.click())
    expect(state().sourceMode).toBe('octa')
    await act(async () => container.querySelector<HTMLElement>('[data-xyscope-preset-id="storm"]')!.click())
    expect(state().sourceMode).toBe('oscillator')
  })

  it('offers WIREFRAME as its own source with the CUBES preset, the four standard groups and its own controls', async () => {
    await act(async () => root.render(<><XyScopeEnginePanel /><XyScopePresetsPanel /><XyScopeDesignPanel /></>))
    const state = () => useReactStore.getState().xyScopeSettings
    const cards = [...container.querySelectorAll<HTMLElement>('.rv-sound-source-card')].map(el => el.textContent)
    expect(cards).toEqual(['TEXT', 'SVG', 'OSCILATOR', 'WIREFRAME'])
    const sourceCard = [...container.querySelectorAll<HTMLElement>('.rv-sound-source-card')].find(el => el.textContent === 'WIREFRAME')!
    await act(async () => sourceCard.click())
    // Choosing the source switches the engine, and only its own preset is offered (the lettering presets do not apply to cubes).
    expect(state().sourceMode).toBe('wire')
    expect(state().presetId).toBe('cubes')
    expect(sourceCard.getAttribute('aria-pressed')).toBe('true')
    expect([...container.querySelectorAll('[data-xyscope-preset-id]')].map(el => el.getAttribute('data-xyscope-preset-id'))).toEqual(['cubes', 'solids', 'tesseract'])
    expect(container.querySelector('[data-xyscope-preset-id="cubes"]')!.textContent).toContain('CUBES')
    expect(container.querySelector('[data-wire-design]')).not.toBeNull()
    expect([...container.querySelectorAll('[data-xyscope-parent-group]')].map(el => el.getAttribute('data-xyscope-parent-group'))).toEqual(['master-controls', 'design', 'react', 'palette'])
    const group = (name: string) => container.querySelector(`[data-xyscope-parent-group="${name}"]`)!
    for (const id of ['intensity', 'audioReactivity', 'bpmSync', 'auto', 'flashLimit', 'hold']) expect(group('master-controls').querySelector(`#xyscope-wire-${id}`), id).not.toBeNull()
    for (const id of ['figure', 'backgroundShapes', 'backgroundAmount', 'satellites', 'size', 'spread', 'perspective', 'tilt', 'spin', 'depthCue', 'duplicates', 'hiddenEdges', 'outline', 'width', 'glow', 'trail', 'scan', 'travel']) expect(group('design').querySelector(`#xyscope-wire-${id}`), id).not.toBeNull()
    for (const id of ['waveAmount', 'waveDepth', 'waveDetail', 'waveOscillator', 'chaos', 'readableFloor', 'maxDisplacement', 'minReadable', 'attack', 'release', 'bassResponse', 'midResponse', 'lowMidResponse', 'airResponse', 'kickResponse', 'snareResponse', 'sceneEvery', 'transition', 'seed']) expect(group('react').querySelector(`#xyscope-wire-${id}`), id).not.toBeNull()
    // The live performance readouts are information, not controls: they live in the REACT tab's Wireframe Performance group, never in Master Controls.
    expect(group('master-controls').querySelector('.vz-mi-kv-row, .vz-mi-kv-label')).toBeNull()
    for (const text of ['Feel', 'Mood', 'Texture', 'Readability', 'Last Event', 'Evidence']) expect(group('master-controls').textContent, text).not.toContain(text)
    expect(group('react').querySelector('[data-wire-reactions]')).not.toBeNull()
    expect(group('react').querySelectorAll('[data-wire-rule]').length).toBeGreaterThan(0)
    for (const id of ['color', 'glow-color', 'background']) expect(group('palette').querySelector(`#xyscope-wire-${id}`), id).not.toBeNull()
    await act(async () => container.querySelector<HTMLElement>('#xyscope-wire-auto')!.click())
    expect(state().wire.autoPerformance).toBe(true)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-wire-flashLimit')!.click())
    expect(state().wire.values.flashLimit).toBe(false)
    await act(async () => container.querySelector<HTMLElement>('#xyscope-wire-outline')!.click())
    expect(state().wire.values.outline).toBe(false)
    // Leaving for another source and coming back keeps the settings.
    const oscillator = [...container.querySelectorAll<HTMLElement>('.rv-sound-source-card')].find(el => el.textContent === 'OSCILATOR')!
    await act(async () => oscillator.click())
    expect(state().sourceMode).toBe('oscillator')
    await act(async () => sourceCard.click())
    expect(state().sourceMode).toBe('wire')
    expect(state().wire.autoPerformance).toBe(true)
  })

  it('gives every preset and option, in every source, both an Auto Performance and a BPM Sync toggle in Master Controls', async () => {
    const audited: string[] = []
    // The instrument presets each own their engine; the standard presets (Converse, Clean Scope, Storm) work in the TEXT, SVG and OSCILATOR sources.
    const cases: { label: string; presetId: string; source?: XyScopeSourceMode }[] = []
    for (const preset of XY_SCOPE_PRESETS) {
      if (preset.parameters && Object.keys(preset.parameters).length > 0) for (const source of ['text', 'svg', 'oscillator'] as const) cases.push({ label: `${preset.name} in ${source}`, presetId: preset.id, source })
      else cases.push({ label: preset.name, presetId: preset.id })
    }
    expect(cases.length).toBeGreaterThanOrEqual(11 + 6)
    for (const { label, presetId, source } of cases) {
      const base = source ? { ...DEFAULT_XY_SCOPE_SETTINGS, sourceMode: source } : DEFAULT_XY_SCOPE_SETTINGS
      await act(async () => useReactStore.getState().setXyScopeSettings(applyXyScopePreset(base, presetId)))
      await act(async () => root.render(<XyScopeDesignPanel />))
      const master = container.querySelector('[data-xyscope-parent-group="master-controls"]')!
      expect(master, label).not.toBeNull()
      const labels = [...master.querySelectorAll('label, [class*="label"], span')].map(el => el.textContent?.trim())
      expect(labels, `${label}: BPM Sync`).toContain('BPM Sync')
      expect(labels, `${label}: Auto Performance`).toContain('Auto Performance')
      audited.push(label)
    }
    expect(audited).toContain('Text V2'); expect(audited).toContain('OCTA'); expect(audited).toContain('CUBES'); expect(audited).toContain('Storm in svg')
  })

  it('turns BPM Sync and Auto Performance on and off from Master Controls, for the engines that gained them', async () => {
    const state = () => useReactStore.getState().xyScopeSettings
    const flip = async (id: string) => { await act(async () => container.querySelector<HTMLElement>(`#${id}`)!.click()) }
    const show = async (presetId: string, source?: XyScopeSourceMode) => {
      await act(async () => useReactStore.getState().setXyScopeSettings(applyXyScopePreset(source ? { ...DEFAULT_XY_SCOPE_SETTINGS, sourceMode: source } : DEFAULT_XY_SCOPE_SETTINGS, presetId)))
      await act(async () => root.render(<XyScopeDesignPanel />))
    }
    await show('textV2'); expect(state().textV2.bpmSync).toBe(true); await flip('xyscope-v2-bpm-sync'); expect(state().textV2.bpmSync).toBe(false)
    await show('osc1'); expect(state().osc1.bpmSync).toBe(true); await flip('xyscope-osc1-bpm-sync'); expect(state().osc1.bpmSync).toBe(false)
    await show('osc2'); expect(state().osc2.bpmSync).toBe(true); await flip('xyscope-osc2-bpm-sync'); expect(state().osc2.bpmSync).toBe(false)
    await show('octa'); expect(state().octa.bpmSync).toBe(true); await flip('xyscope-octa-bpm-sync'); expect(state().octa.bpmSync).toBe(false)
    for (const source of ['text', 'svg', 'oscillator'] as const) {
      await show('storm', source)
      expect(state().parameters.autoPerformance).toBe(false)
      await flip('xyscope-parameter-autoPerformance'); expect(state().parameters.autoPerformance).toBe(true)
      await flip('xyscope-parameter-autoPerformance'); expect(state().parameters.autoPerformance).toBe(false)
    }
  })

  it('filters instrument presets by source and searches within that source', async () => {
    await act(async () => root.render(<><XyScopeEnginePanel /><XyScopePresetsPanel /></>))
    const ids = () => [...container.querySelectorAll('[data-xyscope-preset-id]')].map(el => el.getAttribute('data-xyscope-preset-id'))
    expect(ids()).toEqual(['textV2', 'conversation', 'clean-scope', 'storm', 'osc1', 'osc2'])
    const source = (label: string) => [...container.querySelectorAll<HTMLElement>('.rv-sound-source-card')].find(el => el.textContent === label)!
    await act(async () => source('OSCILATOR').click())
    expect(ids()).toEqual(['conversation', 'clean-scope', 'storm', 'init', 'octa'])
    await act(async () => source('SVG').click())
    expect(ids()).toEqual(['conversation', 'clean-scope', 'storm'])
    await act(async () => source('TEXT').click())
    await act(async () => setInputValue(container.querySelector<HTMLInputElement>('input[aria-label="Search Sound Drawing XY presets"]')!, 'OSC'))
    expect(ids()).toEqual(['textV2', 'osc1', 'osc2'])
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

  it('keeps drawing the word while nothing is playing, and shows no stereo-signal notice (a DJ never has one to act on)', async () => {
    await act(async () => root.render(<XyScopeSurface audio={{ trackIdentity: 'track-1' }} />))
    const [id, callback] = rafCallbacks.entries().next().value as [number, FrameRequestCallback]
    rafCallbacks.delete(id)
    await act(async () => callback(16))
    expect(stroke).toHaveBeenCalled()
    expect(container.textContent).not.toMatch(/stereo/i)
    expect(container.querySelector('.rv-xyscope-note')).toBeNull()
  })
})
