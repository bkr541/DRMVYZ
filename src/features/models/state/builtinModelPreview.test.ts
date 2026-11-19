import {afterEach,expect,it,vi} from 'vitest'
import {BoxGeometry, Group, Mesh, MeshStandardMaterial} from 'three'
const load=vi.hoisted(()=>vi.fn())
vi.mock('../data/loadModelPreview',()=>({loadBuiltinModelPreview:load}))
import {BUILTIN_MODELS} from '../domain/builtinModels'
import {useModelEditorStore,selectBuiltinModelNeedsExport,selectModelCanSave,selectModelCanGenerate,selectModelEditorNeedsGuard} from './modelEditorStore'
import {modelAssetRepository} from '../data/modelAssetRepository'
const model=()=>({group:new Group(),stats:{triangles:1,vertices:3,meshes:1,bounds:{min:[0,0,0],max:[1,1,1]}},dispose:vi.fn()})
afterEach(()=>{useModelEditorStore.getState().reset();vi.resetAllMocks();vi.restoreAllMocks()})
it('loads the original shipped artifact without edits and disposes it on leaving',async()=>{
 const preview=model();load.mockResolvedValue(preview)
 useModelEditorStore.getState().loadBuiltin(BUILTIN_MODELS[0])
 await vi.waitFor(()=>expect(useModelEditorStore.getState().status).toBe('ready'))
 const state=useModelEditorStore.getState();expect(state.model).toBe(preview);expect(state.asset).toBeNull();expect(state.dirty).toBe(false)
 expect(selectModelCanSave(state)).toBe(false);expect(selectModelCanGenerate(state)).toBe(false)
 useModelEditorStore.getState().reset();expect(preview.dispose).toHaveBeenCalledOnce()
})

it('applies built-in transforms and material edits without marking organization dirty, and restores the original', async () => {
  const preview = model()
  const geometry = new BoxGeometry(3, 1, 0.5)
  const material = new MeshStandardMaterial({ name: 'Letters', color: '#e7dcc8', metalness: 0.2, roughness: 0.4 })
  preview.group.add(new Mesh(geometry, material))
  load.mockResolvedValue(preview)
  const state = useModelEditorStore.getState
  try {
    state().loadBuiltin(BUILTIN_MODELS[0])
    await vi.waitFor(() => expect(state().status).toBe('ready'))
    const original = state().builtinEdit!.original
    state().editBuiltin({ scale: 2, rotation: [0, 0, 90], materials: [{ ...original.materials[0], color: '#12abef', roughness: 0.65 }] })
    expect(state().model?.group).toBe(preview.group)
    expect(state().model?.stats.bounds.max[1]).toBeCloseTo(3)
    expect(material.color.getHexString()).toBe('12abef')
    expect(material.roughness).toBe(0.65)
    expect(selectBuiltinModelNeedsExport(state())).toBe(true)
    expect(selectModelEditorNeedsGuard(state())).toBe(true)
    expect(selectModelCanSave(state())).toBe(false)
    state().resetBuiltinEdits()
    expect(preview.group.rotation.z).toBe(0)
    expect(preview.group.scale.toArray()).toEqual([1, 1, 1])
    expect(material.color.getHexString()).toBe('e7dcc8')
    expect(material.roughness).toBe(0.4)
    expect(selectModelEditorNeedsGuard(state())).toBe(false)
  } finally {
    geometry.dispose()
    material.dispose()
  }
})
it('disposes a late response after the viewer selection has been replaced',async()=>{
 let finish!:(m:ReturnType<typeof model>)=>void
 load.mockReturnValue(new Promise(resolve=>{finish=resolve}))
 useModelEditorStore.getState().loadBuiltin(BUILTIN_MODELS[0]);await vi.waitFor(()=>expect(load).toHaveBeenCalled())
 useModelEditorStore.getState().reset();const preview=model();finish(preview)
 await vi.waitFor(()=>expect(preview.dispose).toHaveBeenCalledOnce());expect(useModelEditorStore.getState().model).toBeNull()
})
it('reports a failed load and allows a new selection to retry',async()=>{
 load.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(model())
 useModelEditorStore.getState().loadBuiltin(BUILTIN_MODELS[0]);await vi.waitFor(()=>expect(useModelEditorStore.getState().error).toBe('Unavailable'))
 useModelEditorStore.getState().loadBuiltin(BUILTIN_MODELS[0]);await vi.waitFor(()=>expect(useModelEditorStore.getState().status).toBe('ready'))
})

it('loads and saves only the built-in organization without creating geometry versions', async () => {
  const builtin = BUILTIN_MODELS[0]
  const collectionIds = ['10000000-0000-4000-8000-000000000001']
  const read = vi.spyOn(modelAssetRepository, 'getBuiltinOrganization').mockResolvedValue({ tags: ['logo'], collectionIds: [] })
  const save = vi.spyOn(modelAssetRepository, 'updateBuiltinOrganization').mockRejectedValueOnce(new Error('Retry save'))
    .mockResolvedValueOnce({ tags: ['wordmark'], collectionIds })
  const publish = vi.spyOn(modelAssetRepository, 'saveVersion')
  load.mockResolvedValue(model())
  const state = () => useModelEditorStore.getState()
  state().loadBuiltin(builtin)
  await vi.waitFor(() => expect(state()).toMatchObject({ status: 'ready', tags: ['logo'], dirty: false }))
  expect(read).toHaveBeenCalledWith(builtin.id)

  state().setMetadata({ tags: ['wordmark'], collectionIds, name: 'Ignored' })
  expect(selectModelCanSave(state())).toBe(true)
  expect(await state().save()).toEqual({ ok: false })
  expect(state()).toMatchObject({ dirty: true, builtinOrganizationError: 'Retry save' })
  expect(await state().save()).toMatchObject({ ok: true, id: builtin.id })
  expect(save).toHaveBeenLastCalledWith(builtin.id, { tags: ['wordmark'], collectionIds })
  expect(state()).toMatchObject({ name: builtin.name, dirty: false, tags: ['wordmark'], collectionIds, asset: null })
  expect(publish).not.toHaveBeenCalled()
})
