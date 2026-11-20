import { expect, it } from 'vitest'
import { CINEMA2_BASS_SIGIL_PRESET_MANIFEST as manifest, bassSigilParameterId as pid } from '../presets/Cinema2BassSigilPreset'
import { describeMoodMigration } from './support/describeMoodMigration'
import { moodMusic, moodStage } from './support/MoodMigrationHarness'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { Cinema2PatternAutoPerformance } from '../modules/mainframe/Cinema2PatternAutoPerformance'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

describeMoodMigration('Bass Sigil', [{
 name:'Bass Sigil',manifest,auto:pid('autoPerformance'),strength:pid('reactivity'),
 pattern:{patternChange:pid('patternChange'),trigger:pid('trigger')},
 up:[['bass-sigil-core','geometryExtent'],['bass-sigil-core','coreTravel'],['bass-sigil-core','glow'],['bass-sigil-bloom','intensity']],
 down:[['bass-sigil-core','intensity'],['bass-sigil-core','coreTravel']],
 shock:[['bass-sigil-flares','mix']],
}])

it('rejects partial Mood policy tags and keeps effects connected to original scene depth',()=>{
 const partial={...manifest,parameters:manifest.parameters!.map(p=>p.id===pid('trigger')?{...p,metadata:undefined}:p)}
 expect(compileCinema2NativePreset(partial).ok).toBe(false)
 const scene=manifest.render!.passes[0]
 for(const name of ['focus','trails']) {
  const pass=manifest.render!.passes.find(p=>String(p.id)===`bass-sigil-${name}-pass`)!
  expect(pass.inputs!.find(i=>i.attachment==='depth')!.source.pass.$ref).toBe(scene.id)
 }
})

it('scores a kick cue onto the model, respects hard off, and clears a delayed cue on a seek',()=>{
 const stage=moodStage(manifest),music=moodMusic();stage.state.setPersistentValue(pid('reactivity'),1)
 const step=(options={})=>stage.choreography.update(music.next(options))
 const read=(p:string)=>stage.read('bass-sigil-core',p)
 step();step({event:'kick',eventId:1});step()
 expect(read('modelPulse')).toBeGreaterThan(0)
 for(let i=0;i<30;i++)step();expect(read('modelPulse')).toBe(0)
 stage.state.setPersistentValue(pid('scoreAmount'),0);step({event:'kick',eventId:2});for(let i=0;i<6;i++)step()
 expect(read('modelPulse')).toBe(0)
 stage.state.setPersistentValue(pid('scoreAmount'),.5);step({event:'kick',eventId:3})
 const next=music.next();stage.choreography.update({...next,transport:{...next.transport!,timeSec:0}})
 expect(read('modelPulse')).toBe(0);stage.choreography.dispose()
})

it('resolves saved policy without mood and holds silent patterns while allowing a drop override and bounded restoration',()=>{
 const controls=new Cinema2PatternControlResolver(),music=moodMusic()
 expect(controls.update({saved:{patternChange:false,trigger:'bar4'},mood:null,autoPerformance:true})).toEqual({patternChange:false,trigger:'bar4',automatic:false})
 const mood=music.next({energy:1,section:'drop'}).mood!
 expect(controls.update({saved:{patternChange:false,trigger:'bar4'},mood,autoPerformance:true}).automatic).toBe(true)
 const silent={...mood,silence:1,pattern:{...mood.pattern!,patternChange:false}}
 expect(controls.update({saved:{patternChange:true,trigger:'beat'},mood:silent,autoPerformance:true}).patternChange).toBe(false)
 const auto=new Cinema2PatternAutoPerformance<string>({buildPattern:'lens-collapse',dropPattern:'shock-bloom',dropBeats:8})
 const input={enabled:true,absoluteBeat:0,buildCharge:0,dropEventId:null,patternEdited:false,reset:false,basePattern:'reference-vortex',patternChange:false}
 auto.update(input)
 expect(auto.update({...input,absoluteBeat:1,dropEventId:'drop-1'}).reason).toBe('drop')
 expect(auto.update({...input,absoluteBeat:9,dropEventId:'drop-1'}).pattern).toBeNull()
 auto.reset();expect(auto.update({...input,enabled:false,dropEventId:'drop-2'}).pattern).toBeNull()
})


it('keeps focus on the camera target during manual zoom and full 3D orbit',async()=>{
 const {resolveCinema2FocusDistance:distance}=await import('../effects/Cinema2DepthOfFieldEffect')
 const camera={position:[0,0,30],target:[0,0,0]} as never
 expect(distance({focusCameraTarget:true},camera)).toBe(30)
 expect(distance({focusCameraTarget:false,focusDistance:11.2},camera)).toBe(11.2)
 expect(distance({focusCameraTarget:true,focusDistance:11.2})).toBe(11.2)
})
