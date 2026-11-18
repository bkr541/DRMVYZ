import {afterEach,expect,it,vi} from 'vitest'
import {Group} from 'three'
const load=vi.hoisted(()=>vi.fn())
vi.mock('../data/loadModelPreview',()=>({loadBuiltinModelPreview:load}))
import {BUILTIN_MODELS} from '../domain/builtinModels'
import {useModelEditorStore,selectModelCanSave,selectModelCanGenerate} from './modelEditorStore'
const model=()=>({group:new Group(),stats:{triangles:1,vertices:3,meshes:1,bounds:{min:[0,0,0],max:[1,1,1]}},dispose:vi.fn()})
afterEach(()=>{useModelEditorStore.getState().reset();vi.resetAllMocks()})
it('loads the original shipped artifact as a clean view-only model and disposes it on leaving',async()=>{
 const preview=model();load.mockResolvedValue(preview)
 useModelEditorStore.getState().loadBuiltin(BUILTIN_MODELS[0])
 await vi.waitFor(()=>expect(useModelEditorStore.getState().status).toBe('ready'))
 const state=useModelEditorStore.getState();expect(state.model).toBe(preview);expect(state.asset).toBeNull();expect(state.dirty).toBe(false)
 expect(selectModelCanSave(state)).toBe(false);expect(selectModelCanGenerate(state)).toBe(false)
 useModelEditorStore.getState().reset();expect(preview.dispose).toHaveBeenCalledOnce()
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
