import {expect,it} from 'vitest'
import {MOIRE_ORB_PATTERN_IDS,reactorCellPattern} from '../modules/moireOrb/MoireOrbPatterns'
import {describeMoodMigration} from './support/describeMoodMigration'
import {moodStage,moodMusic} from './support/MoodMigrationHarness'
import {CINEMA2_MOIRE_ORB_PRESET_MANIFEST as manifest,moireOrbParameterId as pid} from '../presets/Cinema2MoireOrbPreset'
import {CINEMA2_AFTERHOURS_TRIGGER_OPTIONS} from '../presets/Cinema2AfterhoursPreset'
import {cinema2NativePresetRegistry} from '../presets/Cinema2PresetRegistry'
describeMoodMigration('Moire Orb',[{name:'Resonance Reactor',manifest,auto:pid('autoPerformance'),strength:pid('reactivity'),pattern:{patternChange:pid('patternChange'),trigger:pid('trigger')},up:[['moire-orb-reactor','motionRate'],['moire-orb-reactor','ringTravel'],['moire-orb-reactor','coreGlow'],['moire-orb-bloom','intensity']],down:[['moire-orb-reactor','motionRate'],['moire-orb-reactor','fixtureLighting']],shock:[['moire-orb-reactor','ringLighting']]}])
it('reuses all eleven canonical Triggers and compiles each advertised pattern and camera mode',()=>{
 expect(manifest.parameters!.find(p=>p.label==='Trigger')!.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
 expect(cinema2NativePresetRegistry.compile(manifest.id).ok).toBe(true)
 expect(Object.keys(manifest.cameras![0].rigVariants!)).toEqual(['manual','horizontal','omnidirectional'])
})
it('delivers independent shared audio facts and keeps lighting zeros authoritative',()=>{
 const stage=moodStage(manifest),music=moodMusic();stage.state.setPersistentValue(pid('reactivity'),1)
 const saved=stage.state.serialize();for(let i=0;i<40;i++)stage.choreography.update(music.next({energy:1,bass:1,high:1,vocal:1}))
 expect(stage.read('moire-orb-reactor','coreScale')).toBeLessThan(1);expect(stage.read('moire-orb-reactor','motionRate')).toBeGreaterThan(1)
 expect(stage.state.serialize()).toBe(saved)
 for(const name of ['ringLighting','fixtureLighting','chamberLighting','coreDetailLighting','coreGlow','haze'])stage.state.setPersistentValue(pid(name),0)
 stage.state.setPersistentValue(pid('autoPerformance'),true)
 for(let i=0;i<20;i++)stage.choreography.update(music.next({energy:1,bass:1,event:'drop',eventId:i,section:'drop'}))
 // The core still follows the music (the bass compresses it, a drop pushes it back out); it is no longer gated by a motion switch.
 expect(stage.read('moire-orb-reactor','coreScale')).toBeGreaterThan(0.5)
 for(const name of ['ringLighting','fixtureLighting','chamberLighting','coreDetailLighting','coreGlow','haze'])expect(stage.read('moire-orb-reactor',name)).toBe(0)
 stage.choreography.dispose()
})

it('gives every wall, deck and core lighting cell its own temporal choreography address',()=>{
 for(const [domain,start,count]of [['core',0,48],['wall',0,96],['deck',96,48]] as const){
  const scores=Array.from({length:count},(_,i)=>JSON.stringify(MOIRE_ORB_PATTERN_IDS.flatMap(pattern=>[.13,.9,2.7].map(phase=>Number(reactorCellPattern(pattern,phase,domain,start+i).toFixed(4))))))
  expect(new Set(scores).size,domain).toBe(count)
 }
})
