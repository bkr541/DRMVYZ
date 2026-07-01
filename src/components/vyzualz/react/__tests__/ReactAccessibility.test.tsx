// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Collapsible,
  SelectRow,
  SliderRow,
  TextInputRow,
  ToggleRow,
} from '../ReactControlRows'
import { ReactFxPanel } from '../ReactFxPanel'
import { ReactModulationPanel } from '../ReactModulationPanel'
import { ReactPresetsPanel } from '../ReactPresetsPanel'
import { ReactPlaceholderCanvas } from '../ReactPlaceholderCanvas'
import { ReactShaderCanvas } from '../ReactShaderCanvas'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import { useReactStore } from '../../../../stores/reactStore'
import { useShaderPanelStore } from '../shaders/ui/shaderPanelStore'
import { DEFAULT_SHADER_SCENE_ID } from '../shaders/scenes'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('React-view control accessibility', () => {
  it('associates visible labels with unique control IDs and exposes disabled state', async () => {
    await act(async () => {
      root.render(
        <>
          <SliderRow label="Intensity" value={0.5} onChange={vi.fn()} />
          <SliderRow label="Intensity" value={0.7} onChange={vi.fn()} />
          <SelectRow
            label="Mode"
            value="one"
            onChange={vi.fn()}
            options={[{ value: 'one', label: 'One' }]}
            disabled
          />
          <TextInputRow label="Layer name" value="Title" onChange={vi.fn()} />
          <ToggleRow label="Enabled" value={false} onChange={vi.fn()} disabled />
          <Collapsible label="Advanced"><span>Content</span></Collapsible>
        </>,
      )
    })

    const intensityLabels = [...container.querySelectorAll('label')]
      .filter(label => label.textContent === 'Intensity') as HTMLLabelElement[]
    expect(intensityLabels).toHaveLength(2)
    expect(intensityLabels[0].htmlFor).not.toBe('')
    expect(intensityLabels[0].htmlFor).not.toBe(intensityLabels[1].htmlFor)
    expect(intensityLabels[0].control?.getAttribute('type')).toBe('range')
    expect(intensityLabels[1].control?.getAttribute('type')).toBe('range')

    const modeLabel = [...container.querySelectorAll('label')]
      .find(label => label.textContent === 'Mode') as HTMLLabelElement
    expect(modeLabel.control).toBeInstanceOf(HTMLSelectElement)
    expect((modeLabel.control as HTMLSelectElement).disabled).toBe(true)

    const textLabel = [...container.querySelectorAll('label')]
      .find(label => label.textContent === 'Layer name') as HTMLLabelElement
    expect(textLabel.control?.getAttribute('type')).toBe('text')

    const toggle = container.querySelector('button[aria-pressed]') as HTMLButtonElement
    const toggleLabel = document.getElementById(toggle.getAttribute('aria-labelledby') ?? '')
    expect(toggleLabel?.textContent).toBe('Enabled')
    expect(toggle.disabled).toBe(true)

    const collapsible = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Advanced')) as HTMLButtonElement
    expect(collapsible.getAttribute('aria-expanded')).toBe('true')
    const controlledId = collapsible.getAttribute('aria-controls') ?? ''
    expect(document.getElementById(controlledId)).not.toBeNull()

    await act(async () => collapsible.click())
    expect(collapsible.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(controlledId)).toBeNull()
    expect(collapsible.closest('.rv-ctrl-collapsible')?.classList.contains('rv-ctrl-collapsible--closed')).toBe(true)
  })
})

describe('React right-rail groups', () => {
  it('renders FX and MOD child sections as independent disclosure controls', async () => {
    const state = useReactStore.getState()
    useReactStore.setState({
      activeReactEngineId: 'oscilloscope',
      oscillatorSettings: { ...state.oscillatorSettings, sourceType: 'classic' },
    })

    await act(async () => root.render(<ReactFxPanel />))
    const fxGroups = [...container.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())
    expect(fxGroups).toContain('Master▾')
    expect(fxGroups).toContain('Sound Drawing▾')

    await act(async () => root.render(<ReactModulationPanel />))
    const modGroups = [...container.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .map(button => button.textContent?.trim())
    expect(modGroups).toContain('Audio Reactivity▾')
    expect(modGroups).toContain('Frequency Response▾')
  })
})

describe('React preset accessibility', () => {
  it('exposes the selected preset in button semantics and visible text', async () => {
    const state = useReactStore.getState()
    const activeId = state.activeReactPresetId ?? state.reactPresets[0]?.id
    expect(activeId).toBeTruthy()
    const activePreset = state.reactPresets.find(p => p.id === activeId)
    useReactStore.setState({
      activeReactPresetId: activeId,
      activeReactEngineId: activePreset?.engine ?? state.activeReactEngineId,
    })

    await act(async () => root.render(<ReactPresetsPanel />))

    const activeButton = container.querySelector('button[aria-pressed="true"]') as HTMLButtonElement
    expect(activeButton).not.toBeNull()
    expect(activeButton.textContent).toContain('Selected')
    expect(activeButton.querySelector('.rv-preset-active-dot')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('button[aria-pressed="false"]')).not.toBeNull()

    const layout = activeButton.querySelector('.rv-preset-card-layout')
    expect(layout?.firstElementChild?.classList.contains('rv-preset-thumb')).toBe(true)
    expect(layout?.lastElementChild?.classList.contains('rv-preset-card-content')).toBe(true)
  })
})

describe('React visualization canvas accessibility', () => {
  it('names the active non-shader visual and includes static fallback text', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.engine === 'oscilloscope')
      ?? DEFAULT_REACT_PRESETS[0]
    const markup = renderToStaticMarkup(
      <ReactPlaceholderCanvas
        analyser={null}
        activePreset={preset}
        intensity={1}
        motion={1}
        glow={0.5}
        bassReactivity={0.7}
        isPlaying={false}
      />,
    )
    container.innerHTML = markup
    const canvas = container.querySelector('canvas') as HTMLCanvasElement

    expect(canvas.getAttribute('role')).toBe('img')
    expect(canvas.getAttribute('aria-label')).toContain(preset.name)
    expect(canvas.textContent).toContain('not described frame by frame')
    expect(canvas.hasAttribute('aria-live')).toBe(false)
  })

  it('names the active shader scene and includes static fallback text', () => {
    useShaderPanelStore.getState().setActiveShaderId(DEFAULT_SHADER_SCENE_ID)
    const markup = renderToStaticMarkup(
      <ReactShaderCanvas analyser={null} isPlaying={false} />,
    )
    container.innerHTML = markup
    const canvas = container.querySelector('canvas') as HTMLCanvasElement

    expect(canvas.getAttribute('role')).toBe('img')
    expect(canvas.getAttribute('aria-label')).toMatch(/^Shader Engine visualization: /)
    expect(canvas.textContent).toContain('not described frame by frame')
    expect(canvas.hasAttribute('aria-live')).toBe(false)
  })
})
