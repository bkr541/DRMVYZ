// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({ source: 'file', liveInputActive: false, liveInputSensitivity: 1, setLiveInputSensitivity: vi.fn(), liveInputNoiseGate: 0.02, setLiveInputNoiseGate: vi.fn() }),
}))

import { useReactStore } from '../../../../stores/reactStore'
import { DEFAULT_XY_SCOPE_SETTINGS } from './XyScopeSettings'
import { ReactAudioPanel } from '../ReactAudioPanel'
import { XyScopeInitDesignPanel } from './XyScopeInitDesignPanel'
import { XyScopeInstrumentIntelligencePanel } from './XyScopeInstrumentIntelligencePanel'
import { publishInitLive } from './XyScopeInitLive'
import { XyScopeOctaDesignPanel } from './XyScopeOctaDesignPanel'
import { publishOctaLive } from './XyScopeOctaLive'
import { XyScopeOsc1DesignPanel } from './XyScopeOsc1DesignPanel'
import { publishOsc1Live } from './XyScopeOsc1Live'
import { XyScopeOsc2DesignPanel } from './XyScopeOsc2DesignPanel'
import { publishOsc2Live } from './XyScopeOsc2Live'

let container: HTMLElement
let root: ReturnType<typeof createRoot>
const initial = useReactStore.getState().xyScopeSettings
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(() => {
  act(() => root.unmount()); container.remove()
  for (const publish of [publishInitLive, publishOctaLive, publishOsc1Live, publishOsc2Live]) publish(null)
  useReactStore.setState({ xyScopeSettings: initial, activeReactEngineId: useReactStore.getInitialState().activeReactEngineId })
})

const setInstrument = (sourceMode: 'init' | 'osc1' | 'osc2' | 'octa', auto: boolean) => {
  const settings = DEFAULT_XY_SCOPE_SETTINGS
  useReactStore.setState({ xyScopeSettings: { ...settings, sourceMode, [sourceMode]: { ...settings[sourceMode], autoPerformance: auto } } })
}
const group = () => container.querySelector('[data-xyscope-instrument-intelligence]')!
const pairs = () => [...group().querySelectorAll('.vz-mi-summary-metric')].map(cell => [cell.querySelector('.vz-mi-kv-label')?.textContent, cell.querySelector('.vz-mi-kv-val')?.textContent])

describe('the REACT-tab performance group of each Sound Drawing XY instrument', () => {
  it('shows OCTA’s distortion, energy and signal in the Audio Intelligence style, and its conductor and evidence only with Auto Performance on', async () => {
    setInstrument('octa', true)
    await act(async () => root.render(<XyScopeInstrumentIntelligencePanel />))
    await act(async () => publishOctaLive({ state: 'LOOPS', energy: 0.42, conductor: 'BUILDING', confidence: 0.8, mapped: true, values: {} as never, source: 'stereo' } as never))
    expect(group().classList.contains('vz-mi-panel')).toBe(true)
    expect(container.textContent).toContain('OCTA Performance')
    expect(group().querySelector('.vz-mi-section-label')?.textContent).toBe('Performance')
    expect(pairs()).toEqual([['Distortion', 'LOOPS'], ['Energy', '42%'], ['Conductor', 'BUILDING'], ['Evidence', 'TRACK + LIVE · 80%'], ['Signal', 'LIVE STEREO']])
    // The same cells Audio Intelligence's Beat Grid uses: a label with its value stacked beneath, two to a row, plain values.
    expect(group().querySelector('.vz-mi-beat-grid-summary > .vz-mi-summary-metric > .vz-mi-kv-label + .vz-mi-kv-val')).not.toBeNull()
    expect(group().querySelector('.vz-mi-kv-val--tag, .vz-mi-kv-row')).toBeNull()
    await act(async () => { setInstrument('octa', false) })
    expect(pairs()).toEqual([['Distortion', 'LOOPS'], ['Energy', '42%'], ['Signal', 'LIVE STEREO']])
  })

  it('shows OCTA’s idle values before it is drawing', async () => {
    setInstrument('octa', false)
    await act(async () => root.render(<XyScopeInstrumentIntelligencePanel />))
    expect(pairs()).toEqual([['Distortion', 'CLEAN'], ['Energy', '0%'], ['Signal', 'NO SIGNAL']])
  })

  it('shows INIT, OSC 1 and OSC 2 their state, evidence and signal while Auto Performance is on, and says when it is off', async () => {
    const snapshot = { state: 'DROP', confidence: 0.5, mapped: false, source: 'mono' } as never
    setInstrument('init', true)
    await act(async () => root.render(<XyScopeInstrumentIntelligencePanel />))
    await act(async () => publishInitLive({ ...(snapshot as object), values: {}, repicks: 0 } as never))
    expect(container.textContent).toContain('INIT Performance')
    expect(pairs()).toEqual([['State', 'DROP'], ['Evidence', 'LIVE · 50%'], ['Signal', 'LIVE MONO']])
    await act(async () => { setInstrument('init', false) })
    expect(pairs()).toEqual([])
    expect(group().textContent).toContain('Appears while Auto Performance is on')

    setInstrument('osc1', true)
    await act(async () => publishOsc1Live({ ...(snapshot as object), dominant: 'BASS', settings: {}, letters: [] } as never))
    expect(container.textContent).toContain('OSC 1 Performance')
    expect(pairs()).toEqual([['State', 'DROP'], ['Dominant', 'BASS'], ['Evidence', 'LIVE · 50%'], ['Signal', 'LIVE MONO']])

    setInstrument('osc2', true)
    await act(async () => publishOsc2Live({ ...(snapshot as object), settings: {} } as never))
    expect(container.textContent).toContain('OSC 2 Performance')
    expect(pairs()).toEqual([['State', 'DROP'], ['Evidence', 'LIVE · 50%'], ['Signal', 'LIVE MONO']])
  })

  it('shows nothing for an instrument without live readouts', async () => {
    useReactStore.setState({ xyScopeSettings: { ...DEFAULT_XY_SCOPE_SETTINGS, sourceMode: 'text' } })
    await act(async () => root.render(<XyScopeInstrumentIntelligencePanel />))
    expect(container.textContent).toBe('')
  })

  it('is part of the REACT tab’s audio panel for Sound Drawing XY, and for no other engine', async () => {
    setInstrument('octa', true)
    useReactStore.setState({ activeReactEngineId: 'xyScope' })
    await act(async () => root.render(<ReactAudioPanel />))
    expect(container.querySelector('[data-xyscope-instrument-intelligence="OCTA"]')).not.toBeNull()
    useReactStore.setState({ activeReactEngineId: 'oscilloscope' })
    await act(async () => root.render(<ReactAudioPanel />))
    expect(container.querySelector('[data-xyscope-instrument-intelligence]')).toBeNull()
  })

  it('and these readouts are no longer in any instrument’s Master Controls', async () => {
    for (const [mode, Panel] of [['init', XyScopeInitDesignPanel], ['osc1', XyScopeOsc1DesignPanel], ['osc2', XyScopeOsc2DesignPanel], ['octa', XyScopeOctaDesignPanel]] as const) {
      setInstrument(mode, true)
      await act(async () => root.render(<Panel />))
      const master = container.querySelector('[data-xyscope-parent-group="master-controls"]')!
      expect(master, mode).not.toBeNull()
      expect(master.querySelector('.vz-mi-kv-row, .vz-mi-kv-label, .vz-mi-kv-val'), mode).toBeNull()
      for (const text of ['Evidence', 'Conductor', 'NO SIGNAL', 'LIVE STEREO', 'LISTENING', 'CLEAN']) expect(master.textContent, `${mode} ${text}`).not.toContain(text)
      expect(master.textContent, mode).toContain('Auto Performance')
      await act(async () => root.render(<></>))
    }
  })
})
