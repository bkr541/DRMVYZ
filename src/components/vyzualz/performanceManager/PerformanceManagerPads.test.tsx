// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { useNotificationStore } from '../../../stores/notificationStore'
import { WithNotificationDrawer, drawerText } from '../../../test/WithNotificationDrawer'
import { usePerformanceManagerPads, PERFORMANCE_PRESET_MIME } from './usePerformanceManagerPads'
import { ReactPerformancePads } from '../react/ReactPerformancePads'
import { cinema2NativePresetRegistry } from '../cinema2/presets/Cinema2PresetRegistry'
import { PRESET_MANAGER_PRESETS } from '../presetManager/presetManagerCatalog'
import { XY_SCOPE_PRESETS } from '../react/xyScope/XyScopeSettings'
import type { ReactLiveEngineId } from '../react/reactEngineCatalog'
const preset = cinema2NativePresetRegistry.list().find(p => !p.metadata.tags?.includes('internal'))!
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
function Harness() {
  const tools = usePerformanceManagerPads('cinema2', [{ id: preset.id, name: preset.metadata.name }], preset.id)
  return <WithNotificationDrawer page="performance-manager"><div role="toolbar">{tools.toolbar}</div><div onDrop={tools.onDrop} onDragOver={tools.onDragOver}><ReactPerformancePads embedded mirror presentation="expanded" editor={tools.editor} /></div>{tools.dialog}</WithNotificationDrawer>
}
beforeEach(async () => {
  useReactStore.getState().resetReactView()
  useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, 'performance-manager': [] } })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const button = (label: string) => [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label || b.textContent === label)!
const click = async (target: HTMLElement) => { await act(async () => target.click()) }
async function drop(padId: string, value: string = JSON.stringify({ engineId: 'cinema2', presetId: preset.id })) {
  const pad = host.querySelector<HTMLElement>(`[data-performance-pad-id="${padId}"]`)!
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { types: [PERFORMANCE_PRESET_MIME], getData: () => value } })
  await act(async () => pad.dispatchEvent(event))
}
describe('Performance Manager shared pad workflow', () => {
  it('cancels a drop on an empty slot without changing assignments, and reports it in Notifications', async () => {
    const before = useReactStore.getState().performancePads
    await drop('pad-17')
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain(preset.metadata.name)
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('performance pad 5')
    expect(drawerText()).toContain('Pad link awaiting confirmation')
    await click(button('Cancel'))
    expect(useReactStore.getState().performancePads).toEqual(before)
    expect(drawerText()).toContain('Pad link canceled')
  })
  it('only links on confirmation, persists the shared assignment and activates it from React', async () => {
    const engine = useReactStore.getState().activeReactEngineId
    await drop('pad-17')
    expect(useReactStore.getState().performancePads.find(p => p.id === 'pad-17')?.destination).toBeFalsy()
    await click(button('Link'))
    expect(useReactStore.getState().activeReactEngineId).toBe(engine)
    expect(useReactStore.getState().performancePads.find(p => p.id === 'pad-17')).toMatchObject({ label: preset.metadata.name, assignmentOverridesAction: true, destination: { engineId: 'cinema2', presetId: preset.id } })
    expect(drawerText()).toContain('Preset linked to pad')
    await act(async () => root.render(<ReactPerformancePads embedded />))
    await click(host.querySelector<HTMLElement>('[data-performance-pad-id="pad-17"]')!)
    expect(useReactStore.getState().activePadId).toBe('pad-17')
    expect(useReactStore.getState().cinema2Workspace.activePresetId).toBe(preset.id)
  })
  it('rejects invalid drops without a dialog or assignment changes', async () => {
    const before = useReactStore.getState().performancePads
    await drop('pad-1', '{invalid')
    expect(host.querySelector('[role="alertdialog"]')).toBeNull()
    expect(useReactStore.getState().performancePads).toEqual(before)
    expect(drawerText()).toContain('Preset could not be dropped')
  })
  it('selects without performing and supports clear, confirmed clear-all, delete, add and reset', async () => {
    const engine = useReactStore.getState().activeReactEngineId
    await click(host.querySelector<HTMLElement>('[data-performance-pad-id="pad-1"]')!)
    expect(useReactStore.getState().activeReactEngineId).toBe(engine)
    await click(button('Clear pad'))
    expect(useReactStore.getState().performancePads.find(p => p.id === 'pad-1')?.presetId).toBeNull()
    await click(button('Clear all pads')); await click(button('Clear all'))
    expect(useReactStore.getState().performancePads.every(p => !p.presetId && !p.destination)).toBe(true)
    await click(button('Delete pad')); await click(button('Delete'))
    expect(useReactStore.getState().performancePads).toHaveLength(19)
    await click(button('Reset pads')); await click(button('Reset'))
    expect(useReactStore.getState().performancePads).toHaveLength(20)
    await click(button('Add pad link'))
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('Link preset')
  })
  for (const engine of ['canvas', 'headliner', 'xyScope', 'laserDmx'] as const satisfies readonly ReactLiveEngineId[]) {
    it(`links and performs native ${engine} presets without silently clearing the assignment`, async () => {
      const artwork = engine === 'xyScope' ? null : engine
      const entry = engine === 'xyScope' ? XY_SCOPE_PRESETS[0] : PRESET_MANAGER_PRESETS.find(p => p.artwork === artwork)!
      const id = 'sourceId' in entry ? entry.sourceId : entry.id
      await act(async () => {
        useReactStore.getState().updatePerformancePad('pad-17', { presetId: null, destination: { schemaVersion: 1, engineId: engine, presetId: id }, assignmentOverridesAction: true })
      })
      expect(useReactStore.getState().performancePads.find(p => p.id === 'pad-17')?.destination?.presetId).toBe(id)
      await act(async () => useReactStore.getState().setActivePadId('pad-17'))
      expect(useReactStore.getState().activeReactEngineId).toBe(engine)
      expect(useReactStore.getState().activePadId).toBe('pad-17')
    })
  }
})
