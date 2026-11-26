import { useModelEditorStore } from '../../../../features/models/state/modelEditorStore'
import { Cinema2UserModelSlot } from '../model/Cinema2UserModelSlot'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import { describeCinema2LoadedModel } from './three/Cinema2ThreeAssetMetadata'
import { MonumentScene } from './monument/MonumentScene'
import { CINEMA2_MONUMENT_MODULE_TYPE_ID } from './monument/MonumentGeometry'
import { MonumentPerformance } from './monument/MonumentPerformance'

export const cinema2MonumentNativeModuleDefinition:Readonly<Cinema2ModuleTypeDefinition>={
  typeId:CINEMA2_MONUMENT_MODULE_TYPE_ID,version:1,
  create(context:Cinema2ModuleCreateContext){
    const performance=new MonumentPerformance(i=>context.randomness.sample('monument-pattern-order',i));let library:Cinema2ThreeLibrary|null=null,scene:MonumentScene|null=null,bridge:Cinema2ThreeSceneBridge|null=null,slot:Cinema2UserModelSlot|null=null
    let starting=false,disposed=false,reported=-1
    const unsubscribeLibrary=useModelEditorStore.subscribe((next,previous)=>{
      if(next.libraryRevision!==previous.libraryRevision)slot?.revalidate()
    })
    const diagnostics:Cinema2ModuleDiagnostic[]=[]
    const report=(error:unknown)=>diagnostics.push({code:'CINEMA2_MONUMENT_FAILED',message:error instanceof Error?error.message:String(error),path:'$.modules'})
    return {lifecycle:{update(update:Cinema2ModuleUpdateContext){performance.update(update);slot?.select(performance.model)},dispose(){disposed=true;unsubscribeLibrary();slot?.stop()}},render:{providers:[{id:`${context.module.id}:hall`,moduleId:context.module.id,intent:'world' as const,execute(execution){
      if(disposed||diagnostics.length)return
      if(!starting){starting=true;void loadCinema2ThreeLibrary().then(value=>{if(!disposed)library=value}).catch(e=>{if(!disposed)report(e)})}
      if(library&&!bridge){const lib=library,root=new lib.THREE.Group();try{
        bridge=context.resources.acquire('monument:scene','MonumentThreeScene',gl=>new Cinema2ThreeSceneBridge(gl,lib,[{asset:{id:'monument-procedural',scene:root,animations:[],triangleCount:0,gpuBytes:0,metadata:describeCinema2LoadedModel(root)},node:null,preserveMaterials:true}],{hdr:true,modelController:{afterVisibility:true,attach:(r,user)=>{if(user)scene?.attachModel(r);else scene=new MonumentScene(lib,r)},detach:r=>scene?.detachModel(r),beforeDraw:quality=>scene?.apply(performance,quality),dispose:()=>scene?.dispose()}}),value=>{value.dispose();slot?.dispose();slot=null})
        slot=new Cinema2UserModelSlot(lib,asset=>bridge?.replaceUserModel(asset?{asset,node:null,preserveMaterials:true,userModel:true}:null));slot.select(performance.model)
      }catch(error){scene?.dispose();report(error);return}}
      if(bridge){bridge.setUserModelPresentation(performance.text('material-mode','original'));bridge.draw(execution,{...CINEMA2_THREE_DEFAULT_OVERRIDES,environmentIntensity:performance.n('reflection',.25)});if(bridge.ready){const bytes=bridge.estimateGpuBytes();if(bytes!==reported){reported=bytes;context.resources.reportGpuBytes(bytes)}}}
    }}]},getDiagnostics:()=>{const snapshot=slot?.getSnapshot();return snapshot&&snapshot.status!=='ready'?[...diagnostics,{code:`CINEMA2_USER_MODEL_${snapshot.status.toUpperCase()}`,path:`module.${context.module.id}.userModel`,message:snapshot.message??'Loading the pinned private model…'}]:diagnostics},inspect:()=>({...performance.inspect(),renderReady:bridge?.ready===true,userModel:slot?.getSnapshot()})}
  },
}
