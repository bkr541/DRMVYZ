import type { Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { CINEMA2_ARC_ANGEL_MODULE_TYPE_ID } from './arcAngel/ArcAngelDomain'
import { ArcAngelPerformance } from './arcAngel/ArcAngelPerformance'
import { ArcAngelScene } from './arcAngel/ArcAngelScene'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { Cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetRegistry'
import { cloneCinema2AssetScene } from './three/Cinema2ThreeAnimation'
import { describeCinema2LoadedModel } from './three/Cinema2ThreeAssetMetadata'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import type { Object3D } from 'three'

export const ARC_ANGEL_ASSET_ID='cinema2-arc-angel'
// The original has Sketchfab Standard terms, which the shipped-asset license gate does not accept.
// Do not register this as a shipped asset until rights and budgets have been cleared. The local preview uses an ignored source file.
const localRegistry=new Cinema2ThreeAssetRegistry()
if(import.meta.env.DEV)localRegistry.register({id:ARC_ANGEL_ASSET_ID,url:'/__stageless_arc_angel/angel.glb',compression:'none',license:'SKETCHFAB Standard',attribution:'Angel by Just8, https://sketchfab.com/3d-models/angel-17d22525b4124088a8827d9c45a2627f'})
const approved=cinema2ThreeAssetRegistry.has(ARC_ANGEL_ASSET_ID)
const assets=new Cinema2ThreeAssetCache(approved?cinema2ThreeAssetRegistry:localRegistry,{idleLimit:0})
export const ARC_ANGEL_AVAILABLE=approved||import.meta.env.DEV

export const cinema2ArcAngelNativeModuleDefinition:Readonly<Cinema2ModuleTypeDefinition>={
  typeId:CINEMA2_ARC_ANGEL_MODULE_TYPE_ID,version:1,
  validate:module=>module.config?.asset===ARC_ANGEL_ASSET_ID?[]:[{code:'ARC_ANGEL_ASSET_REQUIRED',message:'ARC ANGEL requires the authored Angel asset.',path:'$.config.asset'}],
  create(context){
    const performance=new ArcAngelPerformance(i=>context.randomness.sample('arc-angel-pattern-order',i))
    let disposed=false,starting=false,failed=false,reported=-1
    let asset:Cinema2ThreeLoadedAsset|null=null,library:Cinema2ThreeLibrary|null=null,model:Object3D|null=null
    let bridge:Cinema2ThreeSceneBridge|null=null,scene:ArcAngelScene|null=null
    const diagnostics:Cinema2ModuleDiagnostic[]=[]
    const release=()=>{if(asset){assets.release(asset);asset=null}model=null}
    const fail=(code:string,error:unknown)=>{failed=true;diagnostics.push({code,path:'$.config.asset',message:error instanceof Error?error.message:String(error)})}
    return {
      lifecycle:{update(update){performance.update(update)},dispose(){disposed=true;if(!bridge)release()}},
      render:{providers:[{id:`${context.module.id}:celestial`,moduleId:context.module.id,intent:'world',execute(execution){
        if(disposed||failed)return
        if(!starting){starting=true;void (async()=>{
          let acquired:Cinema2ThreeLoadedAsset|null=null
          try{
            const lib=await loadCinema2ThreeLibrary();if(disposed)return
            acquired=await assets.acquire(lib,ARC_ANGEL_ASSET_ID,execution.lightingEnvironment?.quality??'high')
            if(disposed){assets.release(acquired);return}
            // A plain Object3D.clone would bind the animated meshes to the template's bones.
            const clone=await cloneCinema2AssetScene(acquired.scene)
            if(disposed){assets.release(acquired);return}
            asset=acquired;model=clone;library=lib;acquired=null
          }catch(error){if(acquired)assets.release(acquired);if(!disposed)fail('ARC_ANGEL_ASSET_LOAD_FAILED',error)}
        })()}
        if(!bridge&&asset&&model&&library){const lib=library,held=asset,clone=model,root=new lib.THREE.Group()
          try{
            bridge=context.resources.acquire('arc-angel:scene','ArcAngelThreeScene',gl=>new Cinema2ThreeSceneBridge(gl,lib,[{asset:{id:'arc-angel-world',scene:root,animations:[],triangleCount:0,gpuBytes:0,metadata:describeCinema2LoadedModel(root)},node:null,preserveMaterials:true}],{
              hdr:true,modelController:{afterVisibility:true,attach:r=>{scene=new ArcAngelScene(lib,r,held,clone)},beforeDraw:quality=>scene?.apply(performance,quality),dispose:()=>scene?.dispose()},
            }),value=>{value.dispose();release()})
          }catch(error){scene?.dispose();release();fail('ARC_ANGEL_SCENE_BUILD_FAILED',error);return}
        }
        if(bridge){bridge.draw(execution,{...CINEMA2_THREE_DEFAULT_OVERRIDES,environmentIntensity:performance.n('reflection',.26)});if(bridge.ready&&reported<0){reported=bridge.estimateGpuBytes();context.resources.reportGpuBytes(reported)}}
      }}]},
      getDiagnostics:()=>[...diagnostics,...(bridge?.getDiagnostics().map(d=>({...d,path:'$.config.asset'}))??[])],
      inspect:()=>({...performance.inspect(),...scene?.inspect(),renderReady:bridge?.ready===true,asset:asset?.id}),
    }
  },
}
