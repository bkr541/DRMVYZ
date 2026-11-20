// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { explainModelSelection, formatModelBytes, isModelEntryUploadable, isModelUploadFile, type ModelQueueEntry } from './mediaUploadModels'

const mocks = vi.hoisted(() => ({
  uploadOscillatorFont: vi.fn(),
  describeFontFile: vi.fn(),
  fontUploadError: null as string | null,
  inspect: vi.fn(),
  importModel: vi.fn(),
  setModelState: vi.fn(),
  addFilesToUploadQueue: vi.fn(),
  queue: [] as unknown[],
  activeKey: null as string | null,
}))

vi.mock('../../stores/mediaStore', () => {
  const state = {
    get uploadQueue() { return mocks.queue }, uploadDrafts: {}, get activeUploadDraftKey() { return mocks.activeKey }, analyzingAudioTempIds: new Set(), collections: [], items: [],
    mutationStates: {}, loadError: null,
    addFilesToUploadQueue: mocks.addFilesToUploadQueue, removeUploadQueueItem: vi.fn(), clearUploadQueue: vi.fn(), setActiveUploadDraftKey: vi.fn(),
    applyUploadDraftToAllQueued: vi.fn(), setUploadDraftRole: vi.fn(), setUploadDraftTitle: vi.fn(), setUploadDraftDescription: vi.fn(),
    setUploadDraftTags: vi.fn(), setUploadDraftCollections: vi.fn(), setUploadDraftMetadata: vi.fn(), replaceUploadDraftMetadata: vi.fn(),
    setUploadDraftAudioArtist: vi.fn(), setUploadDraftAudioGenre: vi.fn(), setUploadDraftAudioBpm: vi.fn(), setUploadDraftAudioMusicalKey: vi.fn(),
    resetUploadDraft: vi.fn(), uploadQueuedMedia: vi.fn(), saveMediaEdits: vi.fn(), createCollection: vi.fn(), loadCollections: vi.fn(),
    clearLoadError: vi.fn(), retryMediaMutation: vi.fn(), reapplyMediaMutation: vi.fn(), clearMediaMutation: vi.fn(),
  }
  return {
    mediaMutationKey: (id: string, kind: string) => `${id}:${kind}`,
    DEFAULT_UPLOAD_DRAFT: { role: 'background_video', title: '', description: '', tags: [], collectionIds: [], metadata: {}, audioArtist: '', audioGenre: '', audioBpm: '', audioMusicalKey: '' },
    useMediaStore: Object.assign((selector: (value: unknown) => unknown) => selector(state), { getState: () => state }),
  }
})
vi.mock('../../stores/audioStore', () => ({
  useAudioStore: Object.assign((selector: (value: unknown) => unknown) => selector({ savedTracks: [] }), { getState: () => ({ savedTracks: [] }) }),
}))
vi.mock('../../stores/reactStore', () => ({
  useReactStore: Object.assign(() => undefined, {
    getState: () => ({ uploadOscillatorFont: mocks.uploadOscillatorFont, fontUploadError: mocks.fontUploadError }),
  }),
}))
vi.mock('./react/renderers/fontGlyphUtils', () => ({ describeFontFile: mocks.describeFontFile }))
vi.mock('../../features/models/import/glbImport', () => ({ inspectGlbFile: mocks.inspect, importGlbModel: mocks.importModel }))
vi.mock('../../features/models/state/modelEditorStore', () => ({ useModelEditorStore: { setState: mocks.setModelState } }))
vi.mock('./react/renderers/svgCapabilityAnalysis', () => ({ analyzeSvgCapabilities: () => ({ isValidSvg: true, hasVectorGeometry: true }) }))

import { MediaUploadModal } from './MediaUploadModal'
import { NotificationPageProvider, useNotificationStore } from '../../stores/notificationStore'
import { useMediaStore } from '../../stores/mediaStore'


const stats = { triangles: 14760, vertices: 7396, meshes: 9, materialCount: 3, glbBytes: 4_700_000, bounds: { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] }, imported: { fileName: 'DVYDRM_Pure_Diamond_3D.glb', imageCount: 2, maxImageSide: 4096 } }
const inspection = (fileName: string) => ({ fileName, bytes: new ArrayBuffer(8), stats, thumbnail: new Blob(['png'], { type: 'image/png' }), warnings: [] as string[] })

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.inspect.mockReset().mockImplementation(async (file: File) => inspection(file.name))
  mocks.importModel.mockReset().mockResolvedValue({ id: 'model-1' })
  mocks.setModelState.mockReset()
  mocks.addFilesToUploadQueue.mockReset()
  mocks.queue = []
  mocks.activeKey = null
  URL.createObjectURL = vi.fn(() => 'blob:thumb')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { act(() => root.unmount()); container.remove() })

async function chooseFiles(files: File[]) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve() })
}

const glbFile = (name = 'DVYDRM_Pure_Diamond_3D.glb') => new File([new Uint8Array(8)], name, { type: 'model/gltf-binary' })
const text = () => container.textContent ?? ''
const button = (label: RegExp) => [...container.querySelectorAll('button')].find(item => label.test(item.textContent ?? ''))!

describe('3D model helpers', () => {
  it('recognises GLB files and explains why a mixed selection cannot be queued', () => {
    expect(isModelUploadFile({ name: 'A.GLB', type: '' })).toBe(true)
    expect(isModelUploadFile({ name: 'a.gltf', type: 'model/gltf+json' })).toBe(false)
    const glb = { name: 'a.glb', type: '' }, png = { name: 'a.png', type: 'image/png' }
    const none = { mediaQueued: 0, fontsQueued: 0, modelsQueued: 0, audioOnly: false }
    expect(explainModelSelection({ files: [glb, glb], ...none })).toBeNull()
    expect(explainModelSelection({ files: [glb, png], ...none })).toMatch(/separate batch/)
    expect(explainModelSelection({ files: [glb], ...none, mediaQueued: 1 })).toMatch(/separate batch/)
    expect(explainModelSelection({ files: [glb], ...none, fontsQueued: 1 })).toMatch(/separate batch/)
    expect(explainModelSelection({ files: [glb], ...none, audioOnly: true })).toMatch(/audio/)
    expect(explainModelSelection({ files: [png], ...none, modelsQueued: 2 })).toMatch(/3D models are queued/)
    expect(explainModelSelection({ files: [png], ...none })).toBeNull()
    expect(formatModelBytes(4_700_000)).toBe('4.5 MB')
  })

  it('only allows importing a checked model that has a name', () => {
    const base: ModelQueueEntry = { id: 'a', file: glbFile(), inspection: inspection('a.glb'), fileError: null, thumbnailUrl: null, name: 'X', description: '', tags: [], collectionIds: [], status: 'ready' }
    expect(isModelEntryUploadable(base)).toBe(true)
    expect(isModelEntryUploadable({ ...base, name: '  ' })).toBe(false)
    expect(isModelEntryUploadable({ ...base, inspection: null })).toBe(false)
    expect(isModelEntryUploadable({ ...base, fileError: 'Needs Draco' })).toBe(false)
    expect(isModelEntryUploadable({ ...base, status: 'done' })).toBe(false)
  })
})

describe('media upload dialog with 3D models', () => {
  it('accepts .glb in the picker and switches to model fields once a GLB is chosen', async () => {
    await act(async () => { root.render(<MediaUploadModal onClose={() => undefined} />) })
    expect(container.querySelector<HTMLInputElement>('input[type="file"]')!.accept).toContain('.glb')
    expect(text()).toContain('3D models: .glb, up to 64 MB')
    await chooseFiles([glbFile()])
    expect(text()).toContain('3D MODEL IMPORT')
    expect(text()).toContain('MODEL NAME')
    expect(text()).toContain('MODEL DETAILS')
    expect(text()).not.toContain('MEDIA ROLE')
    expect(mocks.addFilesToUploadQueue).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLInputElement>('#mum-model-name')!.value).toBe('DVYDRM Pure Diamond 3D')
    const detail = (label: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)?.value
    expect(detail('TRIANGLES')).toBe('14,760'); expect(detail('MESHES')).toBe('9'); expect(detail('TEXTURES')).toBe('2 · up to 4096 px')
  })

  it('queues two GLBs in one batch and imports both, each with its own result, then closes', async () => {
    const onClose = vi.fn()
    await act(async () => { root.render(<MediaUploadModal onClose={onClose} />) })
    await chooseFiles([glbFile('DVYDRM_Logo_Pure_Diamond_3D.glb'), glbFile('DVYDRM_Pure_Diamond_3D.glb')])
    expect(text()).toContain('2 models selected')
    expect(mocks.inspect).toHaveBeenCalledTimes(2)
    await act(async () => { button(/Import 2 3D Models/).click() })
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
    expect(mocks.importModel).toHaveBeenCalledTimes(2)
    expect(mocks.importModel.mock.calls.map(call => call[1].name)).toEqual(['DVYDRM Logo Pure Diamond 3D', 'DVYDRM Pure Diamond 3D'])
    expect(mocks.setModelState).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('reports a file that cannot be imported and keeps the rest importable', async () => {
    mocks.inspect.mockImplementation(async (file: File) => { if (file.name.startsWith('bad')) throw new Error('This GLB uses Draco-compressed geometry (KHR_draco_mesh_compression).'); return inspection(file.name) })
    await act(async () => { root.render(<MediaUploadModal onClose={() => undefined} />) })
    await chooseFiles([glbFile('bad.glb'), glbFile('good.glb')])
    expect(text()).toContain('Draco-compressed geometry')
    expect(button(/Import 1 3D Model$/)).toBeTruthy()
    await act(async () => { button(/Import 1 3D Model$/).click() })
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
    expect(mocks.importModel).toHaveBeenCalledTimes(1)
    expect(mocks.importModel.mock.calls[0]![1].name).toBe('good')
  })

  it('keeps a failed model in the queue with its reason, and stays open for a retry', async () => {
    const onClose = vi.fn()
    mocks.importModel.mockRejectedValueOnce(new Error('Model version conflict')).mockResolvedValue({ id: 'model-1' })
    await act(async () => { root.render(<MediaUploadModal onClose={onClose} />) })
    await chooseFiles([glbFile('a.glb'), glbFile('b.glb')])
    await act(async () => { button(/Import 2 3D Models/).click() })
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
    expect(onClose).not.toHaveBeenCalled()
    expect(text()).toContain('1 model imported. 1 failed and can be retried.')
    expect(text()).toContain('Model version conflict')
    expect(mocks.setModelState).toHaveBeenCalledTimes(1)
    await act(async () => { button(/Import 1 3D Model$/).click() })
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
    expect(mocks.importModel).toHaveBeenCalledTimes(3)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('refuses a GLB mixed with images in one selection', async () => {
    await act(async () => { root.render(<MediaUploadModal onClose={() => undefined} />) })
    await chooseFiles([glbFile(), new File(['x'], 'photo.png', { type: 'image/png' })])
    expect(text()).toContain('separate batch')
    expect(mocks.inspect).not.toHaveBeenCalled()
  })

  it('requires a model name before it can be imported', async () => {
    await act(async () => { root.render(<MediaUploadModal onClose={() => undefined} />) })
    await chooseFiles([glbFile()])
    const input = container.querySelector<HTMLInputElement>('#mum-model-name')!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => { setter.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(text()).toContain('A model name is required.')
    expect((button(/Import/) as HTMLButtonElement).disabled).toBe(true)
  })
})
