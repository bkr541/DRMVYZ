import { strict as assert } from 'node:assert'
import { Cinema2AudioIntelligenceBridge } from '../../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2MoodConductor } from '../../conductor/Cinema2MoodConductor'
import { Cinema2VisualDirector } from '../../director/Cinema2VisualDirector'
import { Cinema2CameraRuntime } from '../../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../../spatial/Cinema2SpatialRuntime'
import { cinema2StableId, type Cinema2ParameterId } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleUpdateContext } from '../../modules/Cinema2ModuleContracts'
import { COLOSSUS_CAMERA, COLOSSUS_PATTERNS, colossusArmPose, colossusPatternWeights, type ArmInput, type Point } from '../../modules/colossus/ColossusGeometry'
import { ColossusPerformance } from '../../modules/colossus/ColossusPerformance'
import { CINEMA2_COLOSSUS_PRESET_MANIFEST as manifest } from '../../presets/Cinema2ColossusPreset'
import { humMusicFrame } from './Cinema2HumNFrameFactory'
import { moodStage } from './MoodMigrationHarness'

const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
const input:ArmInput={pattern:'assembly',phase:0,routePhase:.2,reach:.5,articulation:.5,piston:.4,jaw:.4,release:0,kick:0,snare:0,bass:0,mid:0,build:0,vocal:0,safety:.45}
const pid=(name:string)=>cinema2StableId<Cinema2ParameterId>(`colossus-${name}`)

export function checkColossusProgramSeparation(){
  // Measure actual geometry, not pattern strings, colors or lighting alone.
  let minimum=Infinity
  for(const [i,a] of COLOSSUS_PATTERNS.entries())for(const b of COLOSSUS_PATTERNS.slice(i+1)){
    let peak=0
    for(let phase=0;phase<8;phase+=.25)for(let arm=0;arm<4;arm++){
      const x=colossusArmPose(arm,{...input,pattern:a.value,phase}),y=colossusArmPose(arm,{...input,pattern:b.value,phase})
      peak=Math.max(peak,distance(x.tip,y.tip),distance(x.elbow,y.elbow))
    }
    minimum=Math.min(minimum,peak)
    assert.ok(peak>.45,`${a.value} and ${b.value}: ${peak}`)
  }
  const a={...input,pattern:'impact' as const,previousPattern:'assembly' as const,blend:.43}
  const from=colossusPatternWeights(a.pattern,a.previousPattern,a.blend)
  for(let arm=0;arm<4;arm++){
    const before=colossusArmPose(arm,a),after=colossusArmPose(arm,{...a,pattern:'separation',previousPattern:'impact',fromWeights:from,blend:0})
    assert.ok(distance(before.tip,after.tip)<1e-9);assert.ok(distance(before.elbow,after.elbow)<1e-9)
    assert.ok(Math.abs(before.jaw-after.jaw)<1e-9);assert.ok(Math.abs(before.piston-after.piston)<1e-9)
    assert.ok(Math.abs(before.pulse-after.pulse)<1e-9);assert.ok(Math.abs(before.charge-after.charge)<1e-9)
  }
  return minimum
}

function music(){
  let serial=0,source=humMusicFrame({frameId:0,timeSec:0})
  const bridge=new Cinema2AudioIntelligenceBridge({getFrame:()=>source,getPublicationMeta:()=>({sequence:serial,publishedAtMs:source.timeSec*1000,publisherId:'colossus-test',kind:'frame' as const})})
  const director=new Cinema2VisualDirector(),mood=new Cinema2MoodConductor()
  const drops=[{id:'drop-1',timeSec:2},{id:'drop-2',timeSec:8}]
  return (timeSec:number,build=0,paused=false)=>{
    source=humMusicFrame({frameId:++serial,timeSec,energy:.6,buildProgress:build,buildConfidence:build,dropMoments:drops,beat:true})
    const audio=bridge.capture(serial),d=director.capture(audio)
    return {frameId:serial,timestampMs:serial*1000/30,elapsedTimeSec:timeSec,deltaTimeSec:1/30,contextGeneration:1,viewport:{width:1280,height:720,dpr:1},audio,director:d,mood:mood.capture(audio,d,1/30),transport:{sourcePresent:true,trackId:source.trackId,timeSec,playing:!paused,paused,animationActive:!paused,bpm:120,bpmSync:true}} as unknown as Cinema2ModuleFrameReadContext
  }
}

export function checkColossusCamera(){
  function sample(mode:string,enabled=true,amount=.65){
    const stage=moodStage(manifest),next=music(),{plan,state,resolver,choreography}=stage
    state.setPersistentValue(pid('motion-safety'),mode);state.setPersistentValue(pid('camera-motion'),enabled);state.setPersistentValue(pid('camera-amount'),amount)
    const camera=new Cinema2CameraRuntime(plan,state,resolver,new Cinema2SpatialRuntime(plan.scene,plan.targets.targets,resolver))
    let maxX=0,peak=0,minZ=Infinity,preDropZ=0,dropZ=0,pullbackZ=0,atDropFov=0
    for(let i=0;i<=180;i++){
      const t=i/30,frame=next(t,t<2?.7:0);choreography.update(frame);const pose=camera.update(frame)
      maxX=Math.max(maxX,Math.abs(pose.position[0]));peak=Math.max(peak,distance(pose.position,COLOSSUS_CAMERA.position));minZ=Math.min(minZ,pose.position[2])
      if(i===59)preDropZ=pose.position[2];if(i===80){dropZ=pose.position[2];atDropFov=pose.fovDegrees}if(i===175)pullbackZ=pose.position[2]
      assert.ok(pose.position.every((v,k)=>v>=COLOSSUS_CAMERA.minPosition[k]!-1e-8&&v<=COLOSSUS_CAMERA.maxPosition[k]!+1e-8))
      assert.ok(pose.viewMatrix.every(Number.isFinite))
      if(!enabled||mode==='lockoff'){assert.deepEqual(pose.position,COLOSSUS_CAMERA.position);assert.equal(pose.fovDegrees,COLOSSUS_CAMERA.fovDegrees)}
    }
    assert.deepEqual(choreography.getSnapshot().diagnostics,[])
    return {maxX,peak,minZ,preDropZ,dropZ,pullbackZ,atDropFov}
  }
  const full=sample('full'),reduced=sample('reduced'),off=sample('full',false),lock=sample('lockoff'),zero=sample('full',true,0)
  assert.ok(full.maxX>1,JSON.stringify(full));assert.ok(reduced.maxX>.25&&reduced.peak<full.peak,JSON.stringify({full,reduced}))
  assert.ok(full.dropZ<full.pullbackZ-.2,JSON.stringify(full));assert.ok(full.atDropFov<COLOSSUS_CAMERA.fovDegrees,JSON.stringify(full))
  assert.equal(off.peak,0);assert.equal(lock.peak,0);assert.equal(zero.peak,0)
  return {full,reduced,off,lock,zero}
}

export function checkColossusTriggerAuthority(){
  const perf=new ColossusPerformance(i=>(i%7)/7),next=music()
  const values:Record<string,unknown>={pattern:'assembly','pattern-change':true,trigger:'drop','auto-performance':false,'bpm-sync':true}
  const step=(t:number,paused=false)=>perf.update({frame:next(t,0,paused),parameters:{get:(key:string)=>values[key]}} as unknown as Cinema2ModuleUpdateContext)
  for(let i=0;i<60;i++)step(i/30)
  step(2);const first=perf.basePattern;assert.notEqual(first,'assembly')
  step(2+1/30);assert.equal(perf.basePattern,first)
  values.pattern='separation';step(2+2/30);assert.equal(perf.basePattern,'separation');assert.equal(values['pattern-change'],true)
  const phase=perf.phase;step(2+3/30,true);assert.equal(perf.phase,phase)
  for(let i=64;i<240;i++)step(i/30)
  assert.equal(perf.basePattern,'separation');step(8);assert.notEqual(perf.basePattern,'separation')
  const second=perf.basePattern;step(8+1/30);assert.equal(perf.basePattern,second)
  step(.5);assert.equal(perf.basePattern,'separation');assert.equal(perf.phase,0)
  assert.equal(values.pattern,'separation');assert.equal(values.trigger,'drop')
}

export function checkColossusAutoPerformance(){
  const stage=moodStage(manifest),next=music(),perf=new ColossusPerformance(i=>(i%7)/7)
  stage.state.setPersistentValue(pid('auto-performance'),true)
  stage.state.setPersistentValue(pid('pattern'),'articulation')
  stage.state.setPersistentValue(pid('pattern-change'),false)
  stage.state.setPersistentValue(pid('trigger'),'bar4')
  const step=(t:number,build=0)=>{
    const frame=next(t,build);stage.choreography.update(frame)
    perf.update({frame,parameters:{get:(key:string)=>stage.resolver.resolve(stage.target('colossus-machine',key).id).value}} as unknown as Cinema2ModuleUpdateContext)
  }
  // Start before the build so the shared auto helper observes a new episode.
  for(let i=0;i<60;i++)step(i/30,i<10?0:.95)
  assert.equal(perf.pattern,'suspension')
  step(2);assert.equal(perf.pattern,'impact')
  for(let i=61;i<120;i++)step(i/30)
  assert.equal(perf.pattern,'impact')
  // Auto OFF immediately releases authority; the saved controls were never rewritten.
  stage.state.setPersistentValue(pid('auto-performance'),false);step(4)
  assert.equal(perf.pattern,'articulation');assert.equal(stage.state.getValue(pid('pattern-change')),false);assert.equal(stage.state.getValue(pid('trigger')),'bar4')
  for(let i=121;i<240;i++)step(i/30)
  step(8);assert.equal(perf.pattern,'articulation')
  assert.equal(stage.state.getValue(pid('pattern')),'articulation')
}
