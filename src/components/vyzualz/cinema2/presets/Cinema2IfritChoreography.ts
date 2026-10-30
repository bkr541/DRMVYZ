import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId } from '../contracts/Cinema2NativePresetManifest'
import { ifritParameterId as pid } from '../modules/ifrit/Cinema2IfritDomain'

const moduleId = cinema2StableId<Cinema2ModuleId>('ifrit-tunnel')
export { IFRIT_CHANNELS } from '../modules/ifrit/Cinema2IfritDomain'
const stableName = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
const target = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property })
const continuous = (name: string, capability: NonNullable<Cinema2ChoreographyRuleManifest['source']['capability']>, path: NonNullable<Cinema2ChoreographyRuleManifest['source']['path']>, smoothingMs: number, scaled = true): Cinema2ChoreographyRuleManifest => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`ifrit-${stableName(name)}-rule`), priority: 10,
  ...(scaled ? { strengthParameter: cinema2Ref(pid('reactivity')) } : {}),
  source: { signal: 'continuous', capability, path, smoothingMs, clamp: [0,1] },
  actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`ifrit-${stableName(name)}-action`), target: target(name), operation: 'replace', value: 1 }],
})
const event = (name: 'kick'|'snare'|'drop', release: number): Cinema2ChoreographyRuleManifest => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`ifrit-${stableName(name)}-rule`), priority: 20,
  strengthParameter: cinema2Ref(pid('reactivity')),
  source: { signal: name, capability: name === 'drop' ? 'music.drop' : 'music.rhythm-events' },
  conditions: [{ kind: 'once-per-event' }],
  actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`ifrit-${stableName(name)}-action`), target: target(name), operation: 'envelope', composition: 'replace', value: 1,
    envelope: { attack: name === 'snare' ? 0.01 : 0.015, hold: 0, release, unit: 'seconds' }, retrigger: 'restart' }],
})
export const IFRIT_CHOREOGRAPHY: readonly Cinema2ChoreographyRuleManifest[] = [
  continuous('energy','audio.features','audio.features.overallEnergy',180),
  continuous('bass','audio.bands','audio.bands.bass',120),
  continuous('highs','audio.bands','audio.bands.high',90),
  continuous('vocal','music.vocal-presence','audio.features.vocalPresence',250),
  continuous('build','music.build','audio.features.buildProgress',200),
  continuous('buildPhase','music.build','audio.features.buildProgress',80,false),
  continuous('directorIntensity','visual-director.significance','director.intensity',200),
  continuous('directorMomentum','visual-director.significance','director.momentum',200),
  continuous('directorBuild','visual-director.significance','director.build',200),
  continuous('directorImpact','visual-director.significance','director.impact',90),
  continuous('directorVariation','visual-director.significance','director.variation',180),
  event('kick',0.18), event('snare',0.14), event('drop',0.45),
  ...spatialScore(),
]

/** Delay and envelope lifetime belong to shared Choreography, including pause,
 * seek and track resets. These targets are transient; authored controls stay intact.
 */
function spatialScore(): Cinema2ChoreographyRuleManifest[] {
  const cue = (signal: 'kick'|'snare'|'drop'|'downbeat'|'phrase'|'section-change', name: string, delay: number, attack: number, hold: number, release: number, parity?: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`ifrit-${signal}-${stableName(name)}${parity==null?'':`-phase-${parity}`}-score`), priority: 30,
    strengthParameter: cinema2Ref(pid('reactivity')),
    source: { signal, capability: signal==='drop'?'music.drop':signal==='kick'||signal==='snare'?'music.rhythm-events':signal==='section-change'?'music.section':signal==='phrase'?'music.phrase':'music.downbeat' },
    conditions: [{kind:'once-per-event'}, ...(parity == null ? [] : [{kind:'capability' as const,capability:'music.beat' as const,available:true},{kind:'beat-interval' as const,unit:'beat' as const,every:4,phase:parity}])],
    actions: [{ id:cinema2StableId<Cinema2ChoreographyActionId>(`ifrit-${signal}-${stableName(name)}${parity==null?'':`-phase-${parity}`}-gesture`), target:target(name), operation:'envelope', composition:'replace', value:1,
      delayBeats:delay, envelope:{attack,hold,release,unit:'seconds'}, retrigger:'restart' }],
  })
  const ungridded = (name:'snareLeft'|'snareRight', delay:number) => {
    const rule=cue('snare',name,delay,.008,.025,.18)
    return {...rule,id:cinema2StableId<Cinema2ChoreographyRuleId>(`${rule.id}-ungridded`),
      actions:rule.actions.map(action=>({...action,id:cinema2StableId<Cinema2ChoreographyActionId>(`${action.id}-ungridded`)})),
      conditions:[...(rule.conditions??[]),{kind:'capability' as const,capability:'music.beat' as const,available:false}]}
  }
  return [
    ungridded('snareLeft',0),ungridded('snareRight',.18),
    cue('kick','kickNear',0,.012,.025,.20),cue('kick','kickMiddle',.16,.018,.025,.22),cue('kick','kickFar',.32,.025,.03,.26),
    cue('snare','snareLeft',0,.008,.025,.18,0),cue('snare','snareLeft',0,.008,.025,.18,1),
    cue('snare','snareRight',0,.008,.025,.18,2),cue('snare','snareRight',0,.008,.025,.18,3),
    cue('drop','dropExpand',0,.025,.08,.32),cue('drop','dropAlign',.45,.08,.16,.45),cue('drop','dropRecover',1,.15,.1,.75),
    cue('downbeat','downbeatAccent',0,.02,.04,.25),cue('phrase','phraseAccent',.15,.06,.10,.5),
    cue('section-change','phraseAccent',0,.06,.12,.6),
  ]
}
