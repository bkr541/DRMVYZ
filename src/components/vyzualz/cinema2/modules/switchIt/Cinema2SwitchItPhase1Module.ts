import { Cinema2SwitchItPerformance } from './Cinema2SwitchItPerformance'
import { Cinema2SwitchItAudio,applySwitchItAudio } from './Cinema2SwitchItAudio'
import { Cinema2SwitchItMotion, readSwitchItVisualControls, SWITCH_IT_VISUAL_DEFAULTS, switchItNumber } from './Cinema2SwitchItMotion'
import type * as Three from 'three'
import { SWITCH_IT_MASK_URL, disposeSwitchItMaskSource } from './Cinema2SwitchItMask'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleTypeDefinition, Cinema2ModuleDiagnostic, Cinema2ModuleCreateContext } from '../Cinema2ModuleContracts'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { Cinema2SwitchItRenderer } from './Cinema2SwitchItRenderer'
import { SWITCH_IT_STATIC_STATES, type SwitchItStaticState } from './Cinema2SwitchItGeometry'

export const SWITCH_IT_PHASE1_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('switch-it-phase1-study')
function createSwitchItModule(context: Cinema2ModuleCreateContext, animated: boolean,withAudio=false,production=false): ReturnType<Cinema2ModuleTypeDefinition['create']> {
    const motion=new Cinema2SwitchItMotion(),audio=new Cinema2SwitchItAudio(),performance=new Cinema2SwitchItPerformance()
    let controls=SWITCH_IT_VISUAL_DEFAULTS
    let library: Cinema2ThreeLibrary | null = null, maskSource: Three.Object3D | null = null, disposed = false
    const abort=new AbortController()
    const diagnostics: Cinema2ModuleDiagnostic[] = []
    let state: SwitchItStaticState = 'human'
    void Promise.all([loadCinema2ThreeLibrary(),fetch(SWITCH_IT_MASK_URL,{signal:abort.signal}).then(response=>{
      if(!response.ok)throw new Error(`Mask asset failed: ${response.status}`)
      return response.arrayBuffer()
    })]).then(async([loaded,bytes])=>{
      const mask=await new loaded.GLTFLoader().parseAsync(bytes,'')
      if(disposed){disposeSwitchItMaskSource(mask.scene);return}
      maskSource=mask.scene;library=loaded
    }).catch(error => {
      if (!disposed) diagnostics.push({ code: 'SWITCH_IT_MASK_FAILED', message: String(error), path: '$.modules' })
    })
    return {
      lifecycle: {
        update(update) {
          const {parameters}=update
          if(animated){motion.update(update);controls=readSwitchItVisualControls(parameters);const drive=withAudio?audio.update(update):null;if(drive)controls=applySwitchItAudio(controls,drive,switchItNumber(parameters,'response',.8));if(production&&drive)controls=performance.update(update,motion,drive,controls)}
          const value = parameters.get('previewState')
          if (SWITCH_IT_STATIC_STATES.includes(value as SwitchItStaticState)) state = value as SwitchItStaticState
        },
        dispose() { disposed = true; abort.abort(); library = null; if(maskSource)disposeSwitchItMaskSource(maskSource);maskSource=null },
      },
      render: { providers: [{
        id: `${context.module.id}:world`, moduleId: context.module.id, intent: 'world',
        execute(exec) {
          if (!library || !maskSource || disposed) return
          const loaded = library, mask=maskSource
          const renderer = context.resources.acquire('static-study', 'three-scene', gl => new Cinema2SwitchItRenderer(gl, loaded,mask), value => value.dispose())
          context.resources.reportGpuBytes(renderer.estimateGpuBytes())
          renderer.draw(exec, animated?(production?performance.pose:motion.pose):state, controls)
        },
      }] },
      getDiagnostics: () => diagnostics,
    }
  }

export const SWITCH_IT_PHASE2_MODULE_TYPE=cinema2StableId<Cinema2ModuleTypeId>('switch-it-phase2-study')
export const cinema2SwitchItPhase1Module: Cinema2ModuleTypeDefinition={typeId:SWITCH_IT_PHASE1_MODULE_TYPE,version:1,create:context=>createSwitchItModule(context,false)}
export const cinema2SwitchItPhase2Module: Cinema2ModuleTypeDefinition={typeId:SWITCH_IT_PHASE2_MODULE_TYPE,version:1,create:context=>createSwitchItModule(context,true)}

export const SWITCH_IT_PHASE3_MODULE_TYPE=cinema2StableId<Cinema2ModuleTypeId>('switch-it-phase3-study')
export const cinema2SwitchItPhase3Module: Cinema2ModuleTypeDefinition={typeId:SWITCH_IT_PHASE3_MODULE_TYPE,version:1,create:context=>createSwitchItModule(context,true,true)}

export const SWITCH_IT_MODULE_TYPE=cinema2StableId<Cinema2ModuleTypeId>('switch-it-native')
export const cinema2SwitchItNativeModuleDefinition: Cinema2ModuleTypeDefinition={typeId:SWITCH_IT_MODULE_TYPE,version:1,create:context=>createSwitchItModule(context,true,true,true)}
