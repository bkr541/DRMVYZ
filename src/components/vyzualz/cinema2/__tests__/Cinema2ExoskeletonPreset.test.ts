import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ExoskeletonScene, exoskeletonOriginalLighting } from '../modules/exoskeleton/ExoskeletonScene'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { EXOSKELETON_PALETTE } from '../modules/exoskeleton/ExoskeletonGeometry'
import { CINEMA2_EXOSKELETON_PRESET_MANIFEST as manifest } from '../presets/Cinema2ExoskeletonPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { EXOSKELETON_PATTERNS, armorBankCounts, armorHalfExtent, armorPose, type ArmorInput } from '../modules/exoskeleton/ExoskeletonGeometry'
import { ExoskeletonPerformance } from '../modules/exoskeleton/ExoskeletonPerformance'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import type { Cinema2LightingEnvironmentFrame, Cinema2ResolvedLightFrame } from '../spatial/Cinema2LightingEnvironmentRuntime'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
const param=(name:string)=>manifest.parameters!.find(p=>p.id===`exoskeleton-${name}`)!
const input:ArmorInput={pattern:'armor',phase:2.3,routePhase:.2,opening:.55,travel:.45,kick:0,snare:0,bass:0,mid:0,build:0,drop:0,vocal:0,safety:1}

describe('EXOSKELETON',()=>{
  it('compiles both authored and production coverage with canonical source, pattern and Inspector contracts',()=>{
    const covered=withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.exoskeleton})
    for(const m of [manifest,covered]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      expect(compileCinema2NativePreset(m).diagnostics).toEqual([])
      expect(new Set(m.parameters!.filter(p=>p.designParentGroup).map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
      expect(m.modules![0].config?.userModel).toMatchObject({node:null,neutralFloor:false})
      expect(m.modules![0].parameterBindings?.userModel.$ref).toBe('exoskeleton-model')
      expect(m.choreography!.rules!.filter(r=>String(r.id).includes('mood')||String(r.id).includes('cover')).flatMap(r=>r.actions).some(a=>a.target.kind==='module'&&/^model-(scale|x|y|z|yaw|pitch|roll)$/.test(a.target.property))).toBe(false)
    }
    expect(param('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(param('pattern').options).toEqual(EXOSKELETON_PATTERNS)
    expect(param('pattern-change').metadata?.moodPolicy).toBe('patternChange')
    expect(param('model')).toMatchObject({exposure:'hidden',metadata:{editor:'user-model-selector'}})
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(5)
  })
  it('uses exact plate counts and at least 12% fit-relative clearance for each bound',()=>{
    for(const count of [12,18,24])expect(armorBankCounts(count).reduce((a,b)=>a+b,0)).toBe(count)
    for(const bounds of [[1.8,.12,.08],[.12,1.8,.5],[.3,.4,1.8],[1,1,1]])for(const clearance of [.12,.2,.4]){
      const largest=Math.max(...bounds)
      for(const half of bounds)expect(armorHalfExtent(half,largest,clearance)-half).toBeGreaterThanOrEqual(largest*clearance)
    }
  })
  it('has six distinct poses with bounded outward hinge/travel, drop release and motion lock',()=>{
    const signatures=EXOSKELETON_PATTERNS.map(({value})=>JSON.stringify([0,1,2,3,4].map(i=>armorPose(i,i,{...input,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    for(const {value} of EXOSKELETON_PATTERNS)for(let bank=0;bank<5;bank++)for(let i=0;i<6;i++)for(let phase=0;phase<16;phase+=.5){
      const p=armorPose(i,bank,{...input,pattern:value,phase,kick:1,bass:1,mid:1,drop:1,build:1})
      expect(p.angle).toBeGreaterThanOrEqual(0);expect(p.angle).toBeLessThanOrEqual(65*Math.PI/180)
      expect(p.travel).toBeGreaterThanOrEqual(0);expect(p.travel).toBeLessThanOrEqual(.60)
      expect(p.pulse).toBeGreaterThanOrEqual(0);expect(p.pulse).toBeLessThanOrEqual(1)
    }
    const p=armorPose(0,0,input),drop=armorPose(0,0,{...input,drop:1});expect(drop.travel).toBeGreaterThan(p.travel)
    const locked=armorPose(0,0,{...input,safety:0});const other=armorPose(0,0,{...input,safety:0,pattern:'deployment',phase:10,kick:1});expect(locked.angle).toBe(other.angle);expect(locked.travel).toBe(other.travel)
  })
  it('keeps actual instanced armor clear of transformed tall/wide heroes, preserves material and resets source',()=>{
    const root=new THREE.Group(),scene=new ExoskeletonScene({THREE} as Cinema2ThreeLibrary,root)
    const values:Record<string,number|string|boolean>={'plate-count':'24','model-scale':1.2,'model-yaw':48,'model-pitch':25,'model-roll':20,'model-x':.2,'model-y':-.2,'shell-clearance':.12,'plate-thickness':.12,'front-aperture':.5}
    const read={n:(key:string,fallback:number)=>typeof values[key]==='number'?values[key] as number:fallback,text:(key:string,fallback:string)=>typeof values[key]==='string'?values[key] as string:fallback,on:(key:string)=>values[key]!==false,color:(key:keyof typeof EXOSKELETON_PALETTE)=>EXOSKELETON_PALETTE[key]}
    const shell=root.getObjectByName('exoskeleton-adaptive-armor')!
    const blade=shell.getObjectByName('exoskeleton-blade') as THREE.InstancedMesh
    const fastener=shell.getObjectByName('exoskeleton-fastener') as THREE.InstancedMesh
    const assertClear=(hero:THREE.Object3D)=>{
      root.updateMatrixWorld(true);hero.updateMatrixWorld(true)
      const heroBox=new THREE.Box3().setFromObject(hero),matrix=new THREE.Matrix4(),bounds=new THREE.Box3()
      shell.traverse(node=>{
        if(!(node instanceof THREE.InstancedMesh))return
        node.geometry.computeBoundingBox()
        for(let i=0;i<node.count;i++){
          node.getMatrixAt(i,matrix);matrix.premultiply(node.matrixWorld)
          bounds.copy(node.geometry.boundingBox!).applyMatrix4(matrix)
          expect(bounds.intersectsBox(heroBox),`${node.name} instance ${i}`).toBe(false)
        }
      })
    }
    const defaultHero=root.children.find(child=>child.type==='Group'&&child!==shell)!
    try{
      scene.apply(read,input,0,0,'high');expect(blade.count).toBe(48);expect(fastener.count).toBe(96);assertClear(defaultHero)
      const initial=blade.instanceMatrix.array.slice()
      scene.apply(read,{...input,pattern:'deployment',drop:1},5,.4,'low')
      expect(blade.instanceMatrix.array).not.toEqual(initial);expect(fastener.count).toBe(0);assertClear(defaultHero)
      for(const size of [[.12,9,.4],[8,.15,.5],[.5,.25,9]] as const){
        const material=new THREE.MeshStandardMaterial({color:0xff3366,transparent:true,opacity:.62,metalness:.15,roughness:.72})
        const model=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material);model.position.set(2,-1,4)
        scene.attachModel(model)
        for(const {value} of EXOSKELETON_PATTERNS)for(const phase of [0,2,5,9]){
          scene.apply(read,{...input,pattern:value,drop:phase===5?1:0},phase,.3,'medium');assertClear(model)
          expect(defaultHero.visible).toBe(false);expect(model.visible).toBe(true)
        }
        expect(material.color.getHex()).toBe(0xff3366);expect(material.opacity).toBe(.62);expect(material.transparent).toBe(true);expect(material.roughness).toBe(.72)
        scene.detachModel(model);model.geometry.dispose();material.dispose()
      }
      values['plate-count']='12';scene.apply(read,input,0,0,'low');expect(blade.count).toBe(24);expect(defaultHero.visible).toBe(true);assertClear(defaultHero)
      expect(scene.estimateAdditionalGpuBytes()).toBeGreaterThan(0)
    }finally{scene.dispose()}
  })
  it('neutralizes the resolved long-range rig only in the imported Original draw, without mutating the shared frame',()=>{
    const lights: Cinema2LightingEnvironmentFrame['lights']=manifest.lighting!.lights!.map((light):Cinema2ResolvedLightFrame=>({
      id:light.id,type:light.type,color:light.color!,intensity:light.intensity!,position:[0,0,0],targetPosition:null,direction:[0,0,-1],spot:null,range:30,threeShadow:light.type==='spot',
    }))
    const frame: Cinema2LightingEnvironmentFrame={quality:'high',lights,omittedLightCount:0,environment:{authored:true,backgroundColor:[0,0,0,1],exposure:1,fog:null}}
    const before=JSON.stringify(frame),original=exoskeletonOriginalLighting(frame)
    expect(JSON.stringify(frame)).toBe(before);expect(original.environment).toBe(frame.environment)
    expect(original.lights.map(l=>l.color)).toEqual([[1,1,1,1],[1,1,1,1],[1,1,1,1]])
    expect(original.lights.map(l=>l.intensity)).toEqual([lights[0]!.intensity*.8,lights[1]!.intensity*.22,lights[2]!.intensity*.16])
    expect(original.lights[1]).toMatchObject({id:lights[1]!.id,range:30,threeShadow:true})
  })
  it('keeps red metallic and blue glass fixtures distinct at idle/drop, neutralizes spill, and restores authored surfaces after stylization',()=>{
    const root=new THREE.Group(),scene=new ExoskeletonScene({THREE} as Cinema2ThreeLibrary,root)
    const values:Record<string,number|string|boolean>={'material-mode':'original','spill':1,'intensity':1,'hero-emission':1,'energy':0}
    let palette:Record<keyof typeof EXOSKELETON_PALETTE,readonly number[]>={...EXOSKELETON_PALETTE,primary:[1,0,0,1],secondary:[0,1,0,1],accent:[0,0,1,1]}
    const read={n:(key:string,fallback:number)=>typeof values[key]==='number'?values[key] as number:fallback,text:(key:string,fallback:string)=>typeof values[key]==='string'?values[key] as string:fallback,on:(key:string)=>values[key]!==false,color:(key:keyof typeof EXOSKELETON_PALETTE)=>palette[key]}
    const texture=new THREE.DataTexture(new Uint8Array([255,90,40,255]),1,1)
    const red=new THREE.MeshStandardMaterial({color:0xef3020,map:texture,metalness:.6,roughness:.7,emissive:0x201000,emissiveIntensity:.12})
    const blue=new THREE.MeshPhysicalMaterial({color:0x2040f0,transparent:true,opacity:.48,depthWrite:false,transmission:.35,clearcoat:.6,metalness:.1,roughness:.24})
    const geometry=new THREE.BoxGeometry(1,2,.6),first=new THREE.Mesh(geometry,red.clone()),second=new THREE.Mesh(geometry,blue.clone())
    const heroLight=root.getObjectByName('exoskeleton-hero-light') as THREE.PointLight
    const spill=root.getObjectByName('exoskeleton-spill-left') as THREE.PointLight
    const energyMesh=root.getObjectByName('exoskeleton-energy') as THREE.InstancedMesh
    const apply=(drop=0)=>scene.apply(read,{...input,drop},drop*5,.3,'high')
    const assertOriginal=(material:THREE.MeshStandardMaterial,source:THREE.MeshStandardMaterial)=>{
      expect(material.color.equals(source.color)).toBe(true);expect(material.emissive.equals(source.emissive)).toBe(true)
      expect(material).toMatchObject({metalness:source.metalness,roughness:source.roughness,emissiveIntensity:source.emissiveIntensity,opacity:source.opacity,transparent:source.transparent,depthWrite:source.depthWrite,map:source.map})
      expect(heroLight.color.getHex()).toBe(0xffffff);expect(heroLight.intensity).toBe(4);expect(spill.color.getHex()).toBe(0xffffff);expect(spill.intensity).toBeLessThanOrEqual(2.4)
    }
    try{
      expect(scene.usesOriginalImportedLighting('original')).toBe(false)
      scene.attachModel(first);expect(scene.usesOriginalImportedLighting('original')).toBe(true);expect(first.castShadow).toBe(true)
      apply();assertOriginal(first.material,red);const armorColors=energyMesh.instanceColor!.array.slice()
      palette={...palette,primary:[0,0,1,1],secondary:[1,0,0,1],accent:[1,0,1,1]};values.energy=1
      apply(1);assertOriginal(first.material,red);expect(energyMesh.instanceColor!.array).not.toEqual(armorColors)
      values['material-mode']='brushed';apply();expect(first.material.metalness).toBe(.8);expect(first.material.roughness).toBe(.32);expect(spill.color.getHex()).toBe(0x0000ff)
      values['material-mode']='edge';apply();expect(first.material.emissive.getHex()).toBe(0xff00ff);expect(first.material.emissiveIntensity).toBe(.25)
      values['material-mode']='integrated';apply();expect(first.material.emissive.equals(red.emissive)).toBe(true);expect(heroLight.color.getHex()).toBe(0xff00ff)
      values['material-mode']='original';apply();assertOriginal(first.material,red)
      scene.detachModel(first);scene.attachModel(second);expect(second.castShadow).toBe(false)
      for(const drop of [0,1]){apply(drop);assertOriginal(second.material,blue);expect(second.material).toMatchObject({transmission:.35,clearcoat:.6});expect(second.material.color.equals(red.color)).toBe(false)}
      values['material-mode']='brushed';apply();values['material-mode']='original';apply();assertOriginal(second.material,blue)
      values['model-visible']=false;apply();expect(second.visible).toBe(false);expect(heroLight.visible).toBe(false)
      values['model-visible']=true;scene.detachModel(second);apply();expect(scene.usesOriginalImportedLighting('original')).toBe(false);expect(heroLight.color.getHex()).toBe(0xff00ff)
      expect(red.metalness).toBe(.6);expect(red.emissive.getHex()).toBe(0x201000);expect(blue.transmission).toBe(.35);expect(blue.roughness).toBe(.24)
    }finally{scene.dispose();geometry.dispose();first.material.dispose();second.material.dispose();red.dispose();blue.dispose();texture.dispose()}
  })
  it('reloads all existing saved presentation modes and the pinned source, and resets to authored defaults',()=>{
    const compiled=compileCinema2NativePreset(manifest);if(!compiled.ok)throw new Error(JSON.stringify(compiled.diagnostics))
    const state=new Cinema2ParameterState(compiled.plan.parameters),mode=param('material-mode').id,model=param('model').id
    const pinned='user-model:00000000-0000-4000-8000-000000000001:2'
    expect(state.setPersistentValue(model,pinned).ok).toBe(true)
    for(const value of ['original','integrated','brushed','edge']){
      expect(state.setPersistentValue(mode,value).ok).toBe(true)
      const restored=new Cinema2ParameterState(compiled.plan.parameters);expect(restored.restore(state.serialize()).ok).toBe(true)
      expect(restored.getValue(mode)).toBe(value);expect(restored.getValue(model)).toBe(pinned)
      restored.reset(mode);restored.reset(model);expect(restored.getValue(mode)).toBe('original');expect(restored.getValue(model)).toBe('default-model')
    }
  })
  it('applies manual pattern edits, pauses phase and resets on track replacement',()=>{
    const perf=new ExoskeletonPerformance(i=>(i%7)/7),values:Record<string,unknown>={pattern:'armor','bpm-sync':true,'pattern-change':false,'auto-performance':false}
    const update=(time:number,paused=false,trackId='track')=>perf.update({parameters:{get:(key:string)=>values[key]},frame:{contextGeneration:1,frameId:Math.round(time*60),timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:.05,audio:null,director:null,mood:null,transport:{trackId,timeSec:time,playing:!paused,paused,animationActive:!paused,bpmSync:true,bpm:120,sourcePresent:true}}} as unknown as Cinema2ModuleUpdateContext)
    update(0);update(.05);expect(perf.phase).toBeGreaterThan(0)
    values.pattern='retraction';update(.1);expect(perf.pattern).toBe('retraction');expect(perf.patternBlend).toBe(1)
    const phase=perf.phase;update(.15,true);expect(perf.phase).toBe(phase)
    update(.2,false,'new');expect(perf.phase).toBe(0)
  })
})
