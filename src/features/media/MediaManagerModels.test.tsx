// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ browser: {} as Record<string, unknown>, actions: { onSave: vi.fn(), onDelete: vi.fn(), saving: false, deleting: false }, import: vi.fn() }))
vi.mock('../../stores/mediaStore', () => ({ useMediaStore: Object.assign((selector: (state: unknown) => unknown) => selector({ items: [{ id: 'image-1', dbId: 'image-1', type: 'image', name: 'Logo' }], openImportMediaModal: mocks.import, openCollectionEditor: vi.fn() }), { getState: () => ({ items: [], ensureMediaSigned: vi.fn() }) }) }))
vi.mock('../../stores/audioStore', () => ({ useAudioStore: (selector: (state: unknown) => unknown) => selector({ savedTracks: [{ id: 'track-1' }] }) }))
vi.mock('../../components/vyzualz/media/MediaLibraryBrowser', () => ({ MediaLibraryBrowser: (props: Record<string, unknown>) => { mocks.browser = props; return <div /> } }))
vi.mock('../../components/vyzualz/media/MediaManagerStage', () => ({ MediaManagerStage: () => <div data-testid="image-stage" /> }))
vi.mock('../../components/vyzualz/media/ModelEditorStage', () => ({ ModelEditorStage: () => <div data-testid="model-stage" /> }))
vi.mock('../../components/vyzualz/media/MediaManagerInspector', () => ({ MediaManagerInspector: ({ onHeaderActions }: { onHeaderActions(actions: typeof mocks.actions): void }) => { React.useEffect(() => onHeaderActions(mocks.actions), [onHeaderActions]); return <div /> } }))
import { MediaManagerView } from './MediaManagerView'
import { useModelEditorStore } from '../models/state/modelEditorStore'
import { MEDIA_DECK_CAPABILITIES, MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'
import { useMediaEditStore } from '../../stores/mediaEditStore'
let container: HTMLDivElement, root: ReturnType<typeof createRoot>
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label)!
async function invoke(name: string, value: unknown) { await act(async () => { (mocks.browser[name] as (value: unknown) => void)(value) }) }
beforeEach(async () => {
  vi.clearAllMocks(); useMediaEditStore.getState().endSession(); useModelEditorStore.getState().reset()
  vi.spyOn(useModelEditorStore.getState(), 'begin').mockImplementation(media => { useModelEditorStore.setState({ id: 'draft-test', dirty: true, name: media.name }); return 'draft-test' })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<MediaManagerView onOpenLyricManager={() => {}} />))
})
afterEach(() => { act(() => root.unmount()); container.remove(); useModelEditorStore.getState().reset(); vi.restoreAllMocks() })
describe('model mode selection and guards', () => {
  it('exposes model authoring only in manager capabilities', () => {
    expect(MEDIA_MANAGER_CAPABILITIES).toContain('models')
    expect(MEDIA_DECK_CAPABILITIES).not.toContain('models')
  })
  it('routes an existing image into model mode and blocks stale image header actions', async () => {
    await invoke('onSelect', 'image-1')
    await act(async () => button('Create 3D Model').click())
    expect(container.querySelector('[data-testid="model-stage"]')).not.toBeNull()
    expect(mocks.browser.activeMediaId).toBeNull()
    expect(button('Save Changes').disabled).toBe(true)
    expect(button('Delete Media').disabled).toBe(true)
    expect(mocks.actions.onSave).not.toHaveBeenCalled()
  })
  it.each(['onSelect', 'onSelectTrack', 'onSelectFont', 'onSelectModel'])('guards an unsaved model on %s; Cancel keeps it and Discard proceeds', async callback => {
    await invoke('onSelect', 'image-1'); await act(async () => button('Create 3D Model').click())
    const value = callback === 'onSelect' ? 'image-1' : { id: callback === 'onSelectModel' ? 'image-1' : 'other', currentVersion: 0 }
    if (callback === 'onSelectModel') vi.spyOn(useModelEditorStore.getState(), 'load').mockImplementation(() => useModelEditorStore.setState({ id: 'image-1', dirty: false }))
    await invoke(callback, value)
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Unsaved model')
    expect(button('Save').disabled).toBe(true)
    await act(async () => button('Cancel').click())
    expect(useModelEditorStore.getState().dirty).toBe(true)
    await invoke(callback, value); await act(async () => button('Discard Changes').click())
    expect(useModelEditorStore.getState().dirty).toBe(false)
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })
  it('uses the existing upload entry and creates only from a verified image result', async () => {
    await act(async () => button('Import Image for 3D').click())
    expect(mocks.import).toHaveBeenCalledTimes(1)
    await invoke('onVisualUploaded', [{ id: 'new', dbId: 'new', type: 'image', name: 'New logo' }])
    expect(useModelEditorStore.getState().begin).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }))
    expect(container.querySelector('[data-testid="model-stage"]')).not.toBeNull()
  })
})
