import {expect,it} from 'vitest'
import {describeMoodMigration} from './support/describeMoodMigration'
import {moodStage,moodMusic} from './support/MoodMigrationHarness'
import {CINEMA2_CRATE_PRESET_MANIFESTS} from '../presets/Cinema2CratePresets'
import {beamLatticeParameterId as pid} from '../presets/Cinema2BeamLatticePerformance'
const manifest=CINEMA2_CRATE_PRESET_MANIFESTS.find(m=>m.id==='drmvyz.cinema2.crate-beam-lattice')!
describeMoodMigration('Beam Lattice',[{name:'Reference laser performance',manifest,auto:pid('autoPerformance'),strength:pid('reactivity'),pattern:{patternChange:pid('patternChange'),trigger:pid('trigger')},up:[['crate-beam-lattice-scene','motionRate'],['crate-beam-lattice-scene','bankTravel'],['crate-beam-lattice-scene','upperLighting'],['beam-lattice-reference-bloom','intensity']],down:[['crate-beam-lattice-scene','motionRate'],['crate-beam-lattice-scene','lowerLighting']],shock:[['crate-beam-lattice-scene','leftLighting']]}])
it('delivers independent audio targets without rewriting saved controls or bypassing motion/lighting permissions',()=>{
 const stage=moodStage(manifest),music=moodMusic();stage.state.setPersistentValue(pid('reactivity'),1);const saved=stage.state.serialize()
 for(let i=0;i<40;i++)stage.choreography.update(music.next({energy:1,bass:1,high:1,vocal:1}))
 expect(stage.read('crate-beam-lattice-scene','aperture')).toBeLessThan(1);expect(stage.read('crate-beam-lattice-scene','motionRate')).toBeGreaterThan(1);expect(stage.read('crate-beam-lattice-scene','upperLighting')).toBeGreaterThan(1);expect(stage.read('crate-beam-lattice-scene','lowerLighting')).toBeLessThan(1);expect(stage.state.serialize()).toBe(saved)
 for(const role of ['upper','lower','left','right'])stage.state.setPersistentValue(pid(role+'Lighting'),0)
 stage.state.setPersistentValue(pid('autoPerformance'),true)
 for(let i=0;i<20;i++)stage.choreography.update(music.next({energy:1,bass:1,event:'drop',eventId:i,section:'drop'}))
 expect(stage.read('crate-beam-lattice-scene','aperture')).toBeGreaterThan(0) // Mood may request a value.
 for(const role of ['upper','lower','left','right'])expect(stage.read('crate-beam-lattice-scene',role+'Lighting')).toBe(0)
 stage.choreography.dispose()
})
