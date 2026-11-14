// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { ReactPerformancePads } from '../react/ReactPerformancePads'
import { usePerformancePadActions } from './usePerformancePadActions'
import { PerformancePadEditor } from './PerformancePadEditor'
import { assignPerformancePreset, getAllPerformancePresets, getPerformanceManagerPresets, isPadPreset } from './performanceManagerPresets'
import { REACT_ENGINE_IDS } from '../react/reactEngineCatalog'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
function Harness() {
  const [selected, selectPad] = useState<string | null>(null)
  const [tab, showTab] = useState<'presets' | 'edit'>('presets')
  const actions = usePerformancePadActions({ selectPad, showTab })
  const preset = getPerformanceManagerPresets('cinema2', useReactStore.getState().reactPresets)[0]
  return <div className="pfm-root">
    <button onClick={() => showTab('edit')}>Outside control</button>
    <div onContextMenu={actions.onContextMenu}><ReactPerformancePads embedded mirror editor={{ selectedPadId: selected, onSelect: selectPad }} /></div>
    <aside className="vz-inspector--right">{tab === 'edit' ? <PerformancePadEditor padId={selected} /> : <div data-performance-preset={preset.id}><button className="rv-preset-card" onClick={() => actions.selectPreset(preset)}>Preset card</button></div>}</aside>
    {actions.linkPad && <p>Linking pad {actions.linkPad.id}</p>}{actions.popover}{actions.cancelDialog}
  </div>
}
const click = async (target: HTMLElement) => { await act(async () => target.click()) }
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text)!
const pad = (id = 'pad-17') => host.querySelector<HTMLButtonElement>(`[data-performance-pad-id="${id}"]`)!
async function menu(id = 'pad-17') { await act(async () => pad(id).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 40 }))) }
const saved = (id = 'pad-17') => useReactStore.getState().performancePads.find(p => p.id === id)!
beforeEach(async () => {
  useReactStore.getState().resetReactView()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
describe('Performance pad context actions', () => {
  it('uses the shared context menu with disabled Clear on an empty pad, and Edit identifies the target', async () => {
    await menu()
    expect(document.querySelector('[role="menu"]')?.className).toContain('rv-show-director-context-menu')
    expect([...document.querySelectorAll('[role="menuitem"]')].map(n => n.textContent)).toEqual(['Edit', 'Link', 'Random', 'Clear'])
    expect(button('Clear').disabled).toBe(true)
    await click(button('Edit'))
    expect(host.querySelector('dl')?.textContent).toContain('Number / letter5')
    expect(host.querySelector('dl')?.textContent).toContain('Assigned presetEmpty')
  })
  it('links by a preset card without performing or a second confirmation', async () => {
    const before = useReactStore.getState().activeReactEngineId
    await menu(); await click(button('Link')); await click(button('Preset card'))
    const preset = getPerformanceManagerPresets('cinema2', useReactStore.getState().reactPresets)[0]
    expect(isPadPreset(saved(), preset)).toBe(true)
    expect(useReactStore.getState().activeReactEngineId).toBe(before)
    expect(host.textContent).not.toContain('Linking pad')
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })
  it('blocks outside controls until cancel is confirmed; Keep linking and Escape preserve the assignment', async () => {
    const before = { ...saved() }
    await menu(); await click(button('Link')); await click(button('Outside control'))
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Cancel pad link?')
    expect(host.querySelector('dl')).toBeNull()
    await click(button('Keep linking'))
    expect(host.textContent).toContain('Linking pad pad-17')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    await click(button('Cancel link'))
    expect(saved()).toEqual(before)
    expect(host.textContent).not.toContain('Linking pad')
    await click(button('Outside control'))
    expect(host.querySelector('dl')).not.toBeNull()
  })
  it('clears only the target assignment, retains its color and disables Clear afterward', async () => {
    const preset = getPerformanceManagerPresets('cinema2', useReactStore.getState().reactPresets)[0]
    await act(async () => {
      assignPerformancePreset('pad-17', preset)
      useReactStore.getState().updatePerformancePad('pad-17', { color: '#123456', colorAssigned: true })
    })
    const other = { ...saved('pad-1') }
    await menu(); expect(button('Clear').disabled).toBe(false); await click(button('Clear'))
    expect(saved()).toMatchObject({ presetId: null, destination: null, label: 'Empty', color: '#123456', colorAssigned: true })
    expect(saved('pad-1')).toEqual(other)
    await menu(); expect(button('Clear').disabled).toBe(true)
  })
  it('allows repeated colors and reflects them in manager and React pads', async () => {
    for (const id of ['pad-17', 'pad-6']) {
      await menu(id); await click(button('Edit'))
      const trigger = host.querySelector<HTMLButtonElement>('.rv-ctrl-palette-hdr')!
      await click(trigger)
      const input = document.querySelector<HTMLInputElement>('.rv-ctrl-palette-hex-input')!
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '#abcdef')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(saved(id)).toMatchObject({ color: '#abcdef', colorAssigned: true })
      expect(pad(id).style.getPropertyValue('--pad-color')).toBe('#abcdef')
      await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
    }
    await act(async () => root.render(<ReactPerformancePads embedded />))
    // Assigned pads show the chosen color on the shared live surface too.
    await act(async () => assignPerformancePreset('pad-17', getPerformanceManagerPresets('cinema2', useReactStore.getState().reactPresets)[0]))
    expect(pad().style.getPropertyValue('--pad-color')).toBe('#abcdef')
  })
  it('every random candidate can be assigned by the shared store', async () => {
    const all = getAllPerformancePresets(useReactStore.getState().reactPresets)
    await act(async () => {
      for (const preset of all) expect(assignPerformancePreset('pad-17', preset), `${preset.engineId}:${preset.id}`).toBe(true)
    })
  })
  it('random includes every engine and excludes the current assignment even at random zero', async () => {
    const all = getAllPerformancePresets(useReactStore.getState().reactPresets)
    expect(new Set(all.map(p => p.engineId))).toEqual(new Set(REACT_ENGINE_IDS))
    await act(async () => assignPerformancePreset('pad-17', all[0]))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    await menu(); await click(button('Random'))
    expect(isPadPreset(saved(), all[0])).toBe(false)
    expect(isPadPreset(saved(), all[1])).toBe(true)
    // Force a choice outside the currently browsed engine.
    const choices = all.filter(p => !isPadPreset(saved(), p))
    const otherIndex = choices.findIndex(p => p.engineId === 'xyScope')
    vi.mocked(Math.random).mockReturnValue((otherIndex + .1) / choices.length)
    await menu(); await click(button('Random'))
    expect(saved().destination?.engineId).toBe('xyScope')
  })
})
