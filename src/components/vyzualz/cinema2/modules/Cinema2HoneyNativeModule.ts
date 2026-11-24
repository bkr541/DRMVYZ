import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleInstance, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { HONEY_PALETTE, HONEY_PALETTE_KEYS, type HoneyPalette } from './honey/Cinema2HoneyDomain'
import { buildHoneyLayout } from './honey/Cinema2HoneyLayout'
import { Cinema2HoneyRenderer } from './honey/Cinema2HoneyRenderer'

export const CINEMA2_HONEY_NATIVE_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('honey-native')
export interface Cinema2HoneyModuleInstance extends Cinema2ModuleInstance { inspect(): {cellCount:number;drawCalls:number;estimatedGpuBytes:number;static:boolean} }
type Renderer=Pick<Cinema2HoneyRenderer,'draw'|'dispose'|'estimateGpuBytes'>
export function createCinema2HoneyNativeModuleDefinition(createRenderer:(gl:WebGL2RenderingContext,cells:ReturnType<typeof buildHoneyLayout>)=>Renderer=(gl,cells)=>new Cinema2HoneyRenderer(gl,cells)):Readonly<Cinema2ModuleTypeDefinition>{
  return Object.freeze<Cinema2ModuleTypeDefinition>({
    typeId:CINEMA2_HONEY_NATIVE_MODULE_TYPE_ID,version:1,
    create(context):Cinema2HoneyModuleInstance{
      const cells=buildHoneyLayout();let renderer:Renderer|null=null,disposed=false
      function palette():HoneyPalette{
        const result={...HONEY_PALETTE} as HoneyPalette
        for(const key of HONEY_PALETTE_KEYS){const value=context.parameters.get(key);if(Array.isArray(value)&&value.length===4&&value.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))result[key]=value as unknown as Cinema2Color}
        return result
      }
      return {
        lifecycle:{update(){/* Static preview: no clocks, events, or procedural motion. */},dispose(){disposed=true;renderer=null}},
        render:{providers:[{id:`${context.module.id}:honey-world`,moduleId:context.module.id,intent:'world',execute(execution){
          if(disposed)return
          if(!execution.depthAvailable||!execution.camera)throw new Error('HONEY requires the engine world camera and depth target.')
          if(!renderer){renderer=context.resources.acquire('honey-renderer','Cinema2HoneyRenderer',gl=>createRenderer(gl,cells),value=>value.dispose());context.resources.reportGpuBytes(renderer.estimateGpuBytes())}
          renderer.draw(execution.camera.viewProjectionMatrix,palette())
        }}]},
        inspect:()=>({cellCount:cells.length,drawCalls:renderer?1:0,estimatedGpuBytes:renderer?.estimateGpuBytes()??0,static:true}),
      }
    },
  })
}
export const cinema2HoneyNativeModuleDefinition=createCinema2HoneyNativeModuleDefinition()
