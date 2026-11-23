// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../models/domain/builtinModels', () => ({ BUILTIN_MODELS: [{ id: 'builtin-test-model', name: 'Test Model', description: 'A shipped model used by these tests.', url: '/cinema2/models/test-model.glb', thumbnailUrl: '/cinema2/models/test-model-thumbnail.webp' }] }))
const mocks = vi.hoisted(() => ({ browser: {} as Record<string, unknown>, actions: { onSave: vi.fn(), onDelete: vi.fn(), saving: false, deleting: false }, import: vi.fn(), collections: [], items: [] as Array<Record<string, unknown>> }))
vi.mock('../../stores/mediaStore', () => ({ useMediaStore: Object.assign((selector: (state: unknown) => unknown) => selector({ items: mocks.items, openImportMediaModal: mocks.import, openCollectionEditor: vi.fn(), collections: mocks.collections }), { getState: () => ({ items: mocks.items, ensureMediaSigned: vi.fn() }) }) }))
vi.mock('../../stores/audioStore', () => ({ useAudioStore: (selector: (state: unknown) => unknown) => selector({ savedTracks: [{ id: 'track-1' }] }) }))
vi.mock('../../components/vyzualz/media/MediaLibraryBrowser', () => ({ MediaLibraryBrowser: (props: Record<string, unknown>) => { mocks.browser = props; return <div /> } }))
vi.mock('../../components/vyzualz/media/MediaManagerStage', () => ({ MediaManagerStage: () => <div data-testid="image-stage" /> }))
vi.mock('../../components/vyzualz/media/ModelEditorStage', () => ({ ModelEditorStage: () => <div data-testid="model-stage" /> }))
vi.mock('../../components/vyzualz/media/MediaManagerInspector', async importOriginal => ({
  ...await importOriginal<typeof import('../../components/vyzualz/media/MediaManagerInspector')>(),
  MediaManagerInspector: ({ onHeaderActions }: { onHeaderActions(actions: typeof mocks.actions): void }) => { React.useEffect(() => onHeaderActions(mocks.actions), [onHeaderActions]); return <div data-testid="inspector" /> },
}))
import { MediaManagerView } from './MediaManagerView'
import { useModelEditorStore } from '../models/state/modelEditorStore'
import { registerModelViewport } from '../models/state/modelViewportBridge'
import { MEDIA_DECK_CAPABILITIES, MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'
import { useMediaEditStore } from '../../stores/mediaEditStore'
import { BUILTIN_MODELS } from '../models/domain/builtinModels'
import type { ModelAsset } from '../models/domain/modelAssetTypes'
import { createBuiltinModelEdit } from '../models/geometry/builtinModelEdits'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
let container: HTMLDivElement, root: ReturnType<typeof createRoot>
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label)!
async function invoke(name: string, value: unknown) { await act(async () => { (mocks.browser[name] as (value: unknown) => void)(value) }) }
beforeEach(async () => {
  vi.clearAllMocks(); mocks.items = [{ id: 'image-1', dbId: 'image-1', type: 'image', name: 'Logo.png', mimeType: 'image/png' }]; useMediaEditStore.getState().endSession(); useModelEditorStore.getState().reset()
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
  it('puts Generate 3D Model in the header while a model is open: off until the source is prepared, then it generates', async () => {
    expect(button('Generate 3D Model')).toBeUndefined()
    await invoke('onSelect', 'image-1'); await act(async () => button('Create 3D Model').click())
    expect(button('Generate 3D Model').disabled).toBe(true)
    // The inspector shows the prepared preview through an object URL, which jsdom does not provide. It stays stubbed so the inspector's cleanup on unmount can revoke it.
    URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn()
    const generate = vi.spyOn(useModelEditorStore.getState(), 'generate').mockResolvedValue(undefined)
    await act(async () => { useModelEditorStore.setState({ source: new Blob(['x']) as never, preview: new Blob(['y']) as never, needsConfirmation: true, confirmed: false, status: 'idle' }) })
    // An opaque raster needs its foreground confirmed first.
    expect(button('Generate 3D Model').disabled).toBe(true)
    await act(async () => { useModelEditorStore.setState({ confirmed: true }) })
    expect(button('Generate 3D Model').disabled).toBe(false)
    await act(async () => button('Generate 3D Model').click())
    expect(generate).toHaveBeenCalledTimes(1)
    // Once a model exists the same key regenerates it.
    await act(async () => { useModelEditorStore.setState({ model: { group: {}, dispose: vi.fn(), stats: { triangles: 1, vertices: 1, meshes: 1, bounds: { min: [0, 0, 0], max: [1, 1, 1] } } } as never }) })
    expect(button('Regenerate 3D Model')).toBeDefined()
    expect(button('Generate 3D Model')).toBeUndefined()
    await act(async () => { useModelEditorStore.setState({ model: null }) })
  })
  it('puts Fit Model and Reset Camera in the header only while a model is open, and they drive the viewport', async () => {
    expect(button('Fit Model')).toBeUndefined()
    expect(button('Reset Camera')).toBeUndefined()
    await invoke('onSelect', 'image-1'); await act(async () => button('Create 3D Model').click())
    expect(button('Fit Model').disabled).toBe(true)
    expect(button('Reset Camera').disabled).toBe(true)
    const fit = vi.fn(), resetCamera = vi.fn()
    const unregister = registerModelViewport({ group: {} as never, capture: vi.fn(), fit, resetCamera })
    const model = { group: {}, dispose: vi.fn(), stats: { triangles: 1, vertices: 1, meshes: 1, bounds: { min: [0, 0, 0], max: [1, 1, 1] } } } as never
    await act(async () => { useModelEditorStore.setState({ model }) })
    expect(button('Fit Model').disabled).toBe(false)
    await act(async () => button('Fit Model').click())
    await act(async () => button('Reset Camera').click())
    expect(fit).toHaveBeenCalledTimes(1)
    expect(resetCamera).toHaveBeenCalledTimes(1)
    unregister()
    await act(async () => { useModelEditorStore.setState({ model: null }) })
  })
  it('keeps imported-model downloads in the toolbar and shows a disabled media role in Details', async () => {
    const asset: ModelAsset = {
      id: 'imported-model', userId: 'owner', kind: 'imported', sourceMediaId: null, name: 'Imported model',
      description: null, favorite: true, currentVersion: 1, status: 'ready',
      createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z',
    }
    const download = vi.spyOn(useModelEditorStore.getState(), 'download').mockResolvedValue(undefined)
    vi.spyOn(useModelEditorStore.getState(), 'load').mockImplementation(() => {
      useModelEditorStore.setState({ id: asset.id, asset, name: asset.name, favorite: asset.favorite, status: 'loading-model' })
    })

    expect(button('Download Original GLB')).toBeUndefined()
    expect(button('Download Preview PNG')).toBeUndefined()
    await invoke('onSelectModel', asset)

    const role = button('Media Role')
    expect(role.disabled).toBe(true)
    expect(role.textContent).toContain('3D Model · Imported GLB')
    expect(container.querySelector('.mm-model-inspector')?.textContent).not.toContain('Favorite model')

    const toolbar = container.querySelector('[role="toolbar"][aria-label="Media Manager controls"]')
    const glb = button('Download Original GLB'), png = button('Download Preview PNG')
    for (const action of [glb, png]) {
      expect(toolbar?.contains(action)).toBe(true)
      expect(action.textContent).toBe('')
      expect(action.title).toBe(action.getAttribute('aria-label'))
      expect(action.disabled).toBe(true)
    }

    await act(async () => {
      useModelEditorStore.setState({
        status: 'ready',
        model: { group: new Group(), dispose: vi.fn(), stats: { triangles: 1, vertices: 3, meshes: 1, bounds: { min: [0, 0, 0], max: [1, 1, 1] } } },
      })
    })
    await act(async () => glb.click())
    await act(async () => button('Output').click())
    await act(async () => png.click())
    expect(download.mock.calls).toEqual([['glb'], ['png']])
    expect(container.querySelector('.mm-model-inspector')?.textContent).toContain('Model Output')
    expect(container.querySelector('.mm-model-inspector')?.textContent).not.toMatch(/Download (Original GLB|Preview PNG)/)
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
  it('has one plus in the header, and no separate image import for 3D', async () => {
    expect(button('Import Image for 3D')).toBeUndefined()
    expect(button('New Media')).toBeDefined()
    await act(async () => button('New Media').click())
    expect(mocks.import).toHaveBeenCalledTimes(1)
    // The upload dialog no longer carries anything into model creation: no callback is handed to the library.
    expect(mocks.browser.onVisualUploaded).toBeUndefined()
    expect(useModelEditorStore.getState().begin).not.toHaveBeenCalled()
  })
  it('starts model creation only from an image already in the library, via the header toolbar', async () => {
    expect(button('Create 3D Model')).toBeUndefined()
    await invoke('onSelect', 'image-1')
    const create = button('Create 3D Model')
    const toolbar = container.querySelector('[role="toolbar"][aria-label="Media Manager controls"]')
    expect(toolbar?.contains(create)).toBe(true)
    expect(create.textContent).toBe('')
    expect(create.querySelector('svg')).not.toBeNull()
    expect(create.title).toBe('Create a 3D model from this image')
    expect(create.disabled).toBe(false)
    expect(container.querySelector('[data-testid="inspector"] [aria-label="Create 3D Model"]')).toBeNull()
    await act(async () => create.click())
    expect(useModelEditorStore.getState().begin).toHaveBeenCalledWith(expect.objectContaining({ id: 'image-1' }))
    expect(container.querySelector('[data-testid="model-stage"]')).not.toBeNull()
  })

  it.each([
    ['PNG', { name: 'logo.png', mimeType: 'image/png' }],
    ['JPEG', { name: 'logo.jpg', mimeType: 'image/jpeg' }],
    ['WebP', { name: 'logo.webp', mimeType: 'image/webp' }],
    ['SVG', { name: 'logo.svg', mimeType: 'image/svg+xml' }],
  ])('offers the header action for saved %s images', async (_format, fields) => {
    mocks.items = [{ id: 'image-1', dbId: 'image-1', type: 'image', ...fields }]
    await invoke('onSelect', 'image-1')
    expect(button('Create 3D Model').disabled).toBe(false)
  })

  it.each([
    ['uploading', { dbId: 'image-1', uploading: true }],
    ['failed upload', { dbId: 'image-1', uploadError: 'Failed' }],
    ['no saved record', { dbId: undefined }],
  ])('disables creation for an image with %s', async (_reason, fields) => {
    mocks.items = [{ id: 'image-1', type: 'image', name: 'Logo.png', mimeType: 'image/png', ...fields }]
    await invoke('onSelect', 'image-1')
    const create = button('Create 3D Model')
    expect(create.disabled).toBe(true)
    expect(create.title).toBe('Available once the image has finished uploading')
    await act(async () => create.click())
    expect(useModelEditorStore.getState().begin).not.toHaveBeenCalled()
  })

  it.each([
    ['GIF', { type: 'image', name: 'animation.gif', mimeType: 'image/gif' }],
    ['video', { type: 'video', name: 'clip.mp4', mimeType: 'video/mp4' }],
  ])('does not offer model creation for a %s', async (_kind, fields) => {
    mocks.items = [{ id: 'image-1', dbId: 'image-1', ...fields }]
    await invoke('onSelect', 'image-1')
    expect(button('Create 3D Model')).toBeUndefined()
  })
})


it('opens the wordmark with organization fields and editing controls for the loaded mesh',async()=>{
 const builtin=BUILTIN_MODELS[0]
 const group = new Group(), geometry = new BoxGeometry(), material = new MeshStandardMaterial()
 group.add(new Mesh(geometry, material))
 const stats = { triangles: 12, vertices: 24, meshes: 1, bounds: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] } } as const
 const model = { group, stats: { ...stats, bounds: { min: [...stats.bounds.min], max: [...stats.bounds.max] } }, dispose: () => { geometry.dispose(); material.dispose() } } satisfies NonNullable<ReturnType<typeof useModelEditorStore.getState>['model']>
 const edit = createBuiltinModelEdit(group, model.stats)
 const load=vi.spyOn(useModelEditorStore.getState(),'loadBuiltin').mockImplementation(builtin=>useModelEditorStore.setState({
   id:builtin.id,builtinModel:builtin,name:builtin.name,dirty:false,model,status:'ready',
   builtinEdit:{...edit,values:edit.original,exported:null},
   savedMetadata:{name:builtin.name,description:builtin.description,favorite:false,tags:[],collectionIds:[]},
 }))
 await invoke('onSelectBuiltinModel',builtin)
 expect(load).toHaveBeenCalledWith(builtin);expect(container.querySelector('[data-testid="model-stage"]')).not.toBeNull()
 expect(button('Generate 3D Model')).toBeUndefined();expect(button('Regenerate 3D Model')).toBeUndefined()
 expect(button('Save Changes').disabled).toBe(true);expect(button('Delete Media').disabled).toBe(true)
 expect(button('Fit Model')).toBeDefined();expect(button('Reset Camera')).toBeDefined()
 const toolbar = container.querySelector('[role="toolbar"][aria-label="Media Manager controls"]')
 const download = button('Download Edited GLB'), restore = button('Restore Original')
 for (const action of [download, restore]) {
   expect(toolbar?.contains(action)).toBe(true)
   expect(action.textContent).toBe('')
   expect(action.disabled).toBe(true)
 }
 expect(button('Info').getAttribute('aria-selected')).toBe('true')
 expect(container.textContent).toContain('Media Details')
 expect(button('Media Role').disabled).toBe(true)
 expect(Array.from(container.querySelectorAll('.mm-model-inspector .drc-header')).map(header => header.textContent)).toEqual(['Details', 'Tags & Collections', 'Additional Info'])
 expect(container.querySelector<HTMLInputElement>('#model-tags')?.disabled).toBe(false)
 await act(async () => button('Edit').click())
 expect(Array.from(container.querySelectorAll('.mm-model-inspector .drc-header')).map(header => header.textContent)).toEqual(['Transform', 'Sides', 'Materials'])
 expect(container.querySelectorAll('.mm-model-inspector input[type="range"]')).toHaveLength(6)
 expect(button('Download Edited GLB').disabled).toBe(true)
 await act(async () => useModelEditorStore.getState().editBuiltin({ scale: 1.4 }))
 expect(button('Download Edited GLB').disabled).toBe(false)
 expect(button('Save Changes').disabled).toBe(true)
 await invoke('onSelect', 'image-1')
 expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Download your edited model before continuing?')
 await act(async () => button('Cancel').click())
 await act(async () => button('Output').click())
 expect(container.querySelector('.mm-model-inspector')).toBeNull()
 expect(restore.disabled).toBe(false)
 await act(async () => restore.click())
 expect(download.disabled).toBe(true)
 expect(restore.disabled).toBe(true)
})

describe('3D model Save, Save As and Revert are toolbar keys', () => {
  const asset: ModelAsset = {
    id: 'imported-model', userId: 'owner', kind: 'imported', sourceMediaId: null, name: 'DVYDRM', description: null, favorite: false,
    currentVersion: 2, status: 'ready', createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z',
  }
  const model = () => ({ group: new Group(), dispose: vi.fn(), stats: { triangles: 1, vertices: 3, meshes: 1, bounds: { min: [0, 0, 0], max: [1, 1, 1] } } }) as never
  async function openModel(extra: Record<string, unknown> = {}) {
    vi.spyOn(useModelEditorStore.getState(), 'load').mockImplementation(() => {
      useModelEditorStore.setState({ id: asset.id, asset, name: asset.name, tags: ['logo'], collectionIds: ['collection-1'], model: model(), status: 'ready', ...extra })
    })
    await invoke('onSelectModel', asset)
  }
  const popover = () => document.querySelector<HTMLElement>('.dv-confirm-dialog')
  const popoverButton = (label: string) => [...popover()!.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === label)!

  it('puts Save Changes, Save As and Revert in the toolbar, in that order, as icon-only keys', async () => {
    await openModel()
    const labels = [...container.querySelectorAll('.mmv-header .vz-header-group button')].map(b => b.getAttribute('aria-label'))
    expect(labels.filter(label => ['Save Changes', 'Save As', 'Revert'].includes(label ?? ''))).toEqual(['Save Changes', 'Save As', 'Revert'])
    for (const label of ['Save As', 'Revert']) {
      expect(button(label).textContent?.trim()).toBe('')
      expect(button(label).querySelector('svg')).not.toBeNull()
    }
    expect(button('Restore Original')).toBeUndefined()
  })

  it('Save As opens a popover with Title, Tags and Collections starting from the model, and saves a separate model with them', async () => {
    await openModel()
    const save = vi.spyOn(useModelEditorStore.getState(), 'save').mockResolvedValue({ ok: true, id: 'new', version: 1 })
    expect(button('Save As').disabled).toBe(false)
    await act(async () => button('Save As').click())
    expect(popover()).not.toBeNull()
    const title = popover()!.querySelector<HTMLInputElement>('input')!
    expect(title.value).toBe('DVYDRM copy')
    expect(popover()!.textContent).toContain('Tags')
    expect(popover()!.textContent).toContain('Collections')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, 'DVYDRM (two-sided)')
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { popoverButton('Save As').click(); await Promise.resolve() })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('DVYDRM (two-sided)', { tags: ['logo'], collectionIds: ['collection-1'] })
    expect(popover()).toBeNull()
  })

  it('a blank name is refused and the popover stays open', async () => {
    await openModel()
    const save = vi.spyOn(useModelEditorStore.getState(), 'save').mockResolvedValue({ ok: true, id: 'new', version: 1 })
    await act(async () => button('Save As').click())
    const title = popover()!.querySelector<HTMLInputElement>('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, '  ')
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { popoverButton('Save As').click() })
    expect(save).not.toHaveBeenCalled()
    expect(popover()!.textContent).toContain('Enter a name for the new model.')
  })

  it('stays open and shows the model error when the copy cannot be saved, and Cancel closes it', async () => {
    await openModel({ error: 'The new model could not be created.' })
    vi.spyOn(useModelEditorStore.getState(), 'save').mockResolvedValue({ ok: false })
    await act(async () => button('Save As').click())
    await act(async () => { popoverButton('Save As').click(); await Promise.resolve() })
    expect(popover()).not.toBeNull()
    expect(popover()!.textContent).toContain('The new model could not be created.')
    await act(async () => popoverButton('Cancel').click())
    expect(popover()).toBeNull()
  })

  it('Save As is disabled while the model is not ready', async () => {
    await openModel({ status: 'loading-model' })
    expect(button('Save As').disabled).toBe(true)
  })

  it('Revert is disabled until there are unsaved changes, then asks before discarding them and reverts', async () => {
    await openModel()
    const revert = vi.spyOn(useModelEditorStore.getState(), 'revert').mockImplementation(() => undefined)
    expect(button('Revert').disabled).toBe(true)
    await act(async () => { useModelEditorStore.setState({ dirty: true }) })
    expect(button('Revert').disabled).toBe(false)
    await act(async () => button('Revert').click())
    expect(document.querySelector('.dv-confirm-dialog')?.textContent).toContain('Revert to saved version?')
    expect(revert).not.toHaveBeenCalled()
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>('.dv-confirm-dialog button')].find(b => b.textContent?.trim() === 'Revert')!.click() })
    expect(revert).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
  })

  it('the Output tab no longer holds Save, Save As or Revert', async () => {
    await openModel({ dirty: true, versions: [{ version: 2, geometryStats: {} }, { version: 1, geometryStats: {} }], activeVersion: 2 })
    await act(async () => { [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(tab => tab.textContent?.trim() === 'Output')!.click() })
    const output = container.querySelector('.mm-model-inspector')!
    expect(output.textContent).toContain('Viewing version 2')
    for (const label of ['Save', 'Save Model', 'Save New Version', 'Save Metadata', 'Save As New Model', 'Revert to Saved Version', 'Reset Model']) {
      expect([...output.querySelectorAll('button')].some(b => b.textContent?.trim() === label), label).toBe(false)
    }
  })
})
