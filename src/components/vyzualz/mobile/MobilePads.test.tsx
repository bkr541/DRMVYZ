// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useReactStore } from '../../../stores/reactStore'
import { DEFAULT_PERFORMANCE_PADS, type ReactPerformancePad } from '../react/ReactTypes'
import { ReactPerformancePads } from '../react/ReactPerformancePads'
import { ReactEngineBrowser } from '../react/ReactEngineBrowser'
import { isMobileUsablePad } from '../../../features/performancePads/performancePadSets'
import { MOBILE_DISABLED_ENGINES, MOBILE_ENGINE_ID } from './mobilePages'
import { MobilePadsPage, MOBILE_PADS_PER_BANK } from './MobilePadsPage'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

const cinema2Pad = (id: string, label: string, presetId: string): ReactPerformancePad =>
  ({ ...DEFAULT_PERFORMANCE_PADS[0], id, label, presetId: null, destination: { schemaVersion: 1, engineId: 'cinema2', presetId } })

beforeEach(() => {
  // jsdom has no Popover API or ResizeObserver; the engine dropdown's menu uses both.
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>
  proto.hidePopover = () => {}
  proto.showPopover = () => {}
  ;(globalThis as Record<string, unknown>).ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} }
  useReactStore.getState().resetReactView()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

const padButtons = () => [...container.querySelectorAll<HTMLButtonElement>('[data-performance-pad-id]')]

describe('mobile pads', () => {
  it('shows twelve pads in Pads 1 and the remaining eight in Pads 2', async () => {
    await act(async () => root.render(<MobilePadsPage />))
    expect(padButtons()).toHaveLength(MOBILE_PADS_PER_BANK)
    expect(padButtons()[0].getAttribute('data-performance-pad-id')).toBe('pad-1')
    const pads2 = [...container.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === 'Pads 2') as HTMLElement
    await act(async () => pads2.click())
    expect(padButtons()).toHaveLength(useReactStore.getState().performancePads.length - MOBILE_PADS_PER_BANK)
    expect(padButtons()[0].getAttribute('data-performance-pad-id')).toBe(useReactStore.getState().performancePads[MOBILE_PADS_PER_BANK].id)
  })

  it('fires a Cinema 2.0 pad, which changes the loaded preset, and leaves other engines\' pads inert', async () => {
    const presetId = 'drmvyz.cinema2.afterhours'
    useReactStore.setState({
      performancePads: [
        cinema2Pad('pad-1', 'Afterhours', presetId),
        { ...DEFAULT_PERFORMANCE_PADS[1], id: 'pad-2', label: 'Canvas pad', presetId: null, destination: { schemaVersion: 1, engineId: 'canvas', presetId: 'x' } },
      ],
    })
    await act(async () => root.render(<ReactPerformancePads embedded presentation="expanded" isPadUsable={isMobileUsablePad} />))
    const [cinema, other] = padButtons()
    expect(cinema.disabled).toBe(false)
    expect(other.disabled).toBe(true)

    await act(async () => other.click())
    expect(useReactStore.getState().activePadId).toBeNull()

    await act(async () => cinema.click())
    expect(useReactStore.getState().activePadId).toBe('pad-1')
    expect(useReactStore.getState().activeReactEngineId).toBe('cinema2')
    expect(useReactStore.getState().cinema2Workspace.activePresetId).toBe(presetId)
  })

  it('does not fire an unusable pad from its keyboard shortcut', async () => {
    useReactStore.setState({
      performancePads: [{ ...DEFAULT_PERFORMANCE_PADS[0], id: 'pad-1', keyBinding: '1', presetId: null, destination: { schemaVersion: 1, engineId: 'canvas', presetId: 'x' } }],
    })
    await act(async () => root.render(<ReactPerformancePads embedded presentation="expanded" isPadUsable={isMobileUsablePad} />))
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true })) })
    expect(useReactStore.getState().activePadId).toBeNull()
  })
})

describe('mobile engine dropdown', () => {
  it('lists every engine but only Cinema 2.0 can be chosen', async () => {
    const onEngineChange = vi.fn()
    await act(async () => root.render(<ReactEngineBrowser engineId={MOBILE_ENGINE_ID} onEngineChange={onEngineChange} disabledEngines={MOBILE_DISABLED_ENGINES} />))
    const options = [...container.querySelectorAll<HTMLButtonElement>('.rv-engine-dropdown-option')]
    expect(options.map(option => option.getAttribute('data-engine')).sort()).toEqual([...MOBILE_DISABLED_ENGINES].sort())
    expect(options.every(option => option.disabled && option.getAttribute('aria-disabled') === 'true')).toBe(true)
    await act(async () => options[0].click())
    expect(onEngineChange).not.toHaveBeenCalled()
  })

  it('leaves options selectable when nothing is disabled', async () => {
    const onEngineChange = vi.fn()
    await act(async () => root.render(<ReactEngineBrowser engineId="cinema2" onEngineChange={onEngineChange} />))
    const option = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-option')!
    expect(option.disabled).toBe(false)
    await act(async () => option.click())
    expect(onEngineChange).toHaveBeenCalledTimes(1)
  })
})
