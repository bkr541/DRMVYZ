// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cinema2TextLibraryPanel } from './Cinema2TextLibraryPanel'
import { Cinema2InspectorPanel } from './Cinema2InspectorPanel'
import { cinema2NativePresetRegistry } from '../cinema2/presets/Cinema2PresetRegistry'
import { Cinema2ParameterState } from '../cinema2/parameters/Cinema2ParameterState'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import type { Cinema2PresetId } from '../cinema2/contracts/Cinema2NativePresetManifest'
import { emptyTextLibrary, type Cinema2TextPresetId } from '../cinema2/text/Cinema2TextConfiguration'
import { useCinema2TextLibraryStore } from '../../../features/cinema2Text/cinema2TextStore'
import { requestTextSceneNavigation, useTextSceneNavigation } from '../../../features/cinema2Text/textSceneNavigation'
import { useReactStore } from '../../../stores/reactStore'

let host: HTMLDivElement, root: Root
const testStorage = globalThis.localStorage
const originalLibrary = useCinema2TextLibraryStore.getState()
const originalWorkspace = useReactStore.getState().cinema2Workspace
beforeEach(() => {
  vi.stubGlobal('localStorage', testStorage)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  useCinema2TextLibraryStore.setState({ userId: 'alice', data: emptyTextLibrary(), pending: emptyTextLibrary(), syncing: false, error: null, sync: vi.fn(async () => {}) })
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  useTextSceneNavigation.setState({ session: null, pending: null, error: null })
  useCinema2TextLibraryStore.setState(originalLibrary)
  useReactStore.setState({ cinema2Workspace: originalWorkspace })
  vi.unstubAllGlobals()
})
function runtimeFor(presetId: Cinema2TextPresetId) {
  const compiled = cinema2NativePresetRegistry.compile(presetId as Cinema2PresetId)
  if (!compiled.ok) throw new Error('Expected text preset')
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  return { state, runtime: {
    getCompiledPresetPlan: () => compiled.plan, getParameterState: () => state,
    getMediaSlotRuntimeSnapshot: () => ({ slots: [] }), serializeParameterState: () => state.serialize(),
  } as unknown as Cinema2Runtime }
}
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find(element => element.getAttribute('aria-label') === text || element.textContent === text)
  if (!button) throw new Error(`Missing button: ${text}`)
  expect(button.disabled, `${text} should be enabled`).toBe(false)
  await act(async () => button.click())
}
async function input(selector: string, value: string) {
  const element = host.querySelector<HTMLInputElement>(selector)!
  expect(element).toBeTruthy()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Cinema 2.0 text scene library UI', () => {
  it('uses the canonical dialog for dirty Back navigation and preserves edits on Cancel', async () => {
    const { runtime } = runtimeFor('drmvyz.cinema2.say-it')
    await act(async () => root.render(<Cinema2TextLibraryPanel runtime={runtime} />))
    await click('Add Text Scene')
    await input('form input:not([id^="cinema2-text-draft-"])', 'Unsaved opening')
    await input('#cinema2-text-draft-say-it-text', 'HELLO')
    await click('Back to Text Scenes')
    const dialog = document.querySelector('[role="alertdialog"]')!
    expect(dialog.classList.contains('dv-confirm-dialog')).toBe(true)
    expect([...dialog.querySelectorAll('.dv-confirm-actions button')].map(button => button.textContent)).toEqual(['Cancel', 'Discard Changes', 'Save'])
    await act(async () => (dialog.querySelector('button') as HTMLButtonElement).click())
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(host.querySelector<HTMLInputElement>('#cinema2-text-draft-say-it-text')?.value).toBe('HELLO')
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await click('Back to Text Scenes')
    const discard = [...document.querySelectorAll('.dv-confirm-actions button')].find(button => button.textContent === 'Discard Changes') as HTMLButtonElement
    await act(async () => discard.click())
    expect(host.querySelector('[aria-label="Search text scenes"]')).toBeTruthy()
    expect(useCinema2TextLibraryStore.getState().data.records).toHaveLength(0)
  })

  it.each(['Add Text Scene', 'Capture Current'])('leaves untouched and fully reverted %s drafts without a prompt', async action => {
    const { runtime } = runtimeFor('drmvyz.cinema2.say-it')
    await act(async () => root.render(<Cinema2TextLibraryPanel runtime={runtime} />))
    await click(action)
    expect(useTextSceneNavigation.getState().session?.isDirty()).toBe(false)
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(false)
    await click('Back to Text Scenes')
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(host.querySelector('[aria-label="Search text scenes"]')).toBeTruthy()
    await click(action)
    await input('form input:not([id^="cinema2-text-draft-"])', 'Changed')
    expect(useTextSceneNavigation.getState().session?.isDirty()).toBe(true)
    await input('form input:not([id^="cinema2-text-draft-"])', '')
    const field = '#cinema2-text-draft-say-it-text'
    const initialText = host.querySelector<HTMLInputElement>(field)!.value
    await input(field, 'EDITED')
    expect(useTextSceneNavigation.getState().session?.isDirty()).toBe(true)
    await input(field, initialText)
    expect(useTextSceneNavigation.getState().session?.isDirty()).toBe(false)
    const navigate = vi.fn()
    await act(async () => requestTextSceneNavigation(navigate))
    expect(navigate).toHaveBeenCalledOnce()
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('blocks navigation after a failed dialog Save and continues only after a successful save', async () => {
    const { runtime } = runtimeFor('drmvyz.cinema2.say-it')
    const navigate = vi.fn()
    await act(async () => root.render(<Cinema2TextLibraryPanel runtime={runtime} />))
    await click('Capture Current')
    await input('#cinema2-text-draft-say-it-text', 'EDITED')
    await act(async () => requestTextSceneNavigation(navigate))
    const dialogSave = () => [...document.querySelectorAll<HTMLButtonElement>('.dv-confirm-actions button')].find(button => button.textContent === 'Save')!
    await act(async () => dialogSave().click())
    expect(navigate).not.toHaveBeenCalled()
    expect(document.querySelector('.dv-confirm-dialog')?.textContent).toContain('Enter a name')
    const cancel = document.querySelector<HTMLButtonElement>('.dv-confirm-actions button')!
    await act(async () => cancel.click())
    await input('form input:not([id^="cinema2-text-draft-"])', 'Saved before leaving')
    await act(async () => requestTextSceneNavigation(navigate))
    await act(async () => dialogSave().click())
    expect(navigate).toHaveBeenCalledOnce()
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(useCinema2TextLibraryStore.getState().data.records[0].name).toBe('Saved before leaving')
    expect(host.querySelector('[aria-label="Search text scenes"]')).toBeTruthy()
  })

  it.each([
    ['drmvyz.cinema2.say-it', 'say-it-text'], ['drmvyz.cinema2.marquee', 'marquee-front-text'], ['drmvyz.cinema2.nightshift', 'nightshift-sign-text'],
  ] as const)('captures %s into an isolated named draft and recalls it through the existing runtime', async (presetId, field) => {
    const { state, runtime } = runtimeFor(presetId)
    state.setPersistentValues({ [field]: 'CURRENT' })
    const before = state.serialize()
    await act(async () => root.render(<><Cinema2TextLibraryPanel runtime={runtime} /><Cinema2InspectorPanel runtime={runtime} surface="design" sharedAudioAnalysis={false} /></>))
    for (const label of ['Capture Current', 'Add Text Scene']) {
      const action = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
      expect(action.closest('.drc-group')?.querySelector('.drc-header')?.textContent).toBe('Text Scenes')
      expect(action.classList.contains('vz-header-icon-key')).toBe(true)
      expect(action.closest('.drc-body')?.classList.contains('dv-library-body')).toBe(true)
      const toolbar = action.closest('[role="toolbar"]')!
      expect(toolbar.getAttribute('aria-label')).toBe('Text scene actions')
      expect(toolbar.parentElement?.classList.contains('dv-library-search-row')).toBe(true)
      expect(toolbar.previousElementSibling?.classList.contains('vz-md-view-toggles')).toBe(true)
      expect(action.querySelector('svg')?.getAttribute('width')).toBe('12')
    }
    await click('Capture Current')
    expect(host.querySelector('[aria-label="Search text scenes"]')).toBeNull()
    expect(host.querySelector('[aria-label="Back to Text Scenes"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Capture Current"]')).toBeNull()
    expect(host.querySelector('[aria-label="Add Text Scene"]')).toBeNull()
    expect(host.querySelectorAll('.drc-header')[0]?.textContent).toBe('New Text Scene')
    expect(host.querySelector<HTMLInputElement>(`#cinema2-text-draft-${field}`)?.value).toBe('CURRENT')
    const inputIds = [...host.querySelectorAll('input[id]')].map(element => element.id)
    expect(new Set(inputIds).size).toBe(inputIds.length)
    await input('input[id="cinema2-text-draft-' + field + '"]', 'SAVED')
    await input('form input:not([id^="cinema2-text-draft-"])', 'Opening')
    expect(state.serialize()).toBe(before)
    await click('Save')
    expect(state.serialize()).toBe(before)
    expect(host.querySelector('[role="alert"]')?.textContent).toBeUndefined()
    expect(useCinema2TextLibraryStore.getState().data.records[0]?.name).toBe('Opening')
    await click('Opening actions')
    await click('Make Active')
    expect(state.getValue(field as Parameters<Cinema2ParameterState['getValue']>[0])).toBe('SAVED')
    expect(host.querySelector<HTMLInputElement>(`#cinema2-parameter-${field}`)?.value ?? 'SAVED').toBe('SAVED')
    expect(host.textContent).toContain('Active')
  })

  it('adds blank text, cancels safely, searches, toggles view, and manages pool membership', async () => {
    const { state, runtime } = runtimeFor('drmvyz.cinema2.say-it')
    state.setPersistentValues({ 'say-it-line-mode': 'one', 'say-it-line-2-text': 'BACKUP' })
    const before = state.serialize()
    await act(async () => root.render(<Cinema2TextLibraryPanel runtime={runtime} />))
    await click('Add Text Scene')
    expect(host.querySelector<HTMLInputElement>('#cinema2-text-draft-say-it-text')?.value).toBe('')
    await click('Back to Text Scenes')
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(host.querySelector('[aria-label="Search text scenes"]')).toBeTruthy()
    expect(state.serialize()).toBe(before)
    await click('Capture Current')
    await input('form input:not([id^="cinema2-text-draft-"])', 'Opening')
    await click('Save')
    await input('[aria-label="Search text scenes"]', 'BACKUP')
    expect(host.querySelectorAll('[role="listitem"]')).toHaveLength(1)
    await input('[aria-label="Search text scenes"]', 'unmatched')
    expect(host.querySelectorAll('[role="listitem"]')).toHaveLength(0)
    await click('Clear search')
    expect(host.querySelectorAll('.dv-library-view-toggle button')).toHaveLength(1)
    await click('List view')
    expect(host.querySelector('.rv-cinema2-text-records.is-list')).toBeTruthy()
    expect(host.querySelector('[aria-label="List view"]')).toBeNull()
    await click('Grid view')
    expect(host.querySelector('.rv-cinema2-text-records.is-grid')).toBeTruthy()
    await act(async () => root.render(<Cinema2TextLibraryPanel runtime={runtime} mode="pool" />))
    await input('[aria-label="New pool name"]', 'Set one')
    const form = host.querySelector('form')!
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(useCinema2TextLibraryStore.getState().data.pools[0].name).toBe('Set one')
    await act(async () => root.render(<Cinema2TextLibraryPanel runtime={runtime} />))
    const card = host.querySelector('[aria-label="Opening actions"]')!
    await act(async () => card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })))
    await click('Add to Pool')
    await click('Set one')
    expect(useCinema2TextLibraryStore.getState().data.memberships).toHaveLength(1)
    await act(async () => root.render(<Cinema2TextLibraryPanel runtime={runtime} mode="pool" />))
    expect(host.querySelector('[aria-label="Opening actions"]')).toBeTruthy()
  })
})
