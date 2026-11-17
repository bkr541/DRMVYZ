import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2IfritRenderer } from './ifrit/Cinema2IfritRenderer'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { IfritPerformance } from './ifrit/Cinema2IfritPerformance'
import { IFRIT_CHANNELS, IFRIT_MECHANICS_NUMBERS, IFRIT_SECTORS, IFRIT_SHATTER_NUMBERS, IFRIT_SHATTER_TRIGGERS, type IfritPattern, type IfritShatterTrigger } from './ifrit/Cinema2IfritDomain'
import { IfritTimeline, createIfritVisualFrame } from './ifrit/Cinema2IfritMotion'
import { createIfritMechanicalFrame, type IfritComponentPose, type IfritMechanicsControls, type IfritQuality } from './ifrit/Cinema2IfritMechanics'
import { createIfritShatterFrame, ifritOriginalSurvival, type IfritShardPose, type IfritShatterControls } from './ifrit/Cinema2IfritShatter'
import { IFRIT_EMPTY_OVERRIDES, parseIfritElementOverrides, type IfritElementOverrides } from './ifrit/Cinema2IfritOverrides'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'

export const CINEMA2_IFRIT_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('ifrit-native')
export const cinema2IfritNativeModuleDefinition: Cinema2ModuleTypeDefinition = {
  typeId: CINEMA2_IFRIT_MODULE_TYPE, version: 1,
  create(context) {
    const renderer = context.resources.acquire('ifrit-passage', 'IfritGeometry', gl => new Cinema2IfritRenderer(gl), value => value.dispose())
    context.resources.reportGpuBytes(renderer.gpuBytes)
    const timeline = new IfritTimeline(), performance = new IfritPerformance()
    // The music's choice of Pattern Change and Trigger while Auto Performance is on (the saved values are never written).
    const patternControls = new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
    let previousTime: number | null = null, revision = '', previousTimestamp: number | null = null, idleTime = 0
    let visual = createIfritVisualFrame({travel:0,spin:0,score:0},{count:5,spacing:1,twist:.45,detail:1},{},'infernalPassage')
    const number = (key: string, fallback: number) => {
      const v = context.parameters.get(key)
      return typeof v === 'number' && Number.isFinite(v) ? v : fallback
    }
    const flag = (key: string, fallback: boolean) => { const v = context.parameters.get(key); return typeof v === 'boolean' ? v : fallback }
    const mech = (key: keyof typeof IFRIT_MECHANICS_NUMBERS) => number(key, IFRIT_MECHANICS_NUMBERS[key][1])
    const shat = (key: keyof typeof IFRIT_SHATTER_NUMBERS) => number(key, IFRIT_SHATTER_NUMBERS[key][1])
    // Per-part overrides parse only when the persisted text changes.
    let overridesText = '{}', overrides: IfritElementOverrides = IFRIT_EMPTY_OVERRIDES
    let quality: IfritQuality = 'high'
    let mechanics: readonly IfritComponentPose[] = []
    let shards: readonly IfritShardPose[] = []
    let survival: Float32Array | null = null
    const survivalBuffer = new Float32Array(72)
    let enhanced = false
    return {
      lifecycle: {
        update({ frame }) {
          const idle = frame.transport?.sourcePresent === false
          const idleDelta = previousTimestamp == null ? 0 : Math.min(.1,Math.max(0,(frame.timestampMs-previousTimestamp)/1000))
          previousTimestamp = frame.timestampMs
          idleTime = idle ? idleTime+idleDelta : 0
          const time = idle ? idleTime : frame.transport?.timeSec ?? frame.elapsedTimeSec
          const nextRevision = `${frame.contextGeneration}:${idle}:${frame.transport?.trackId}:${frame.audio?.discontinuity.generation ?? 0}:${frame.audio?.upstream.analysisRevision ?? ''}:${frame.audio?.upstream.timelineRevision ?? ''}`
          const reset = previousTime == null || revision !== nextRevision || time < previousTime-.001
          if(reset) { timeline.reset(); performance.reset() }
          const mechanicsOn = flag('mechanics-enabled', true)
          const phases = timeline.update(frame,time,{travel:number('travel',.6),rotation:number('rotation',.15),sync:context.parameters.get('bpm-sync')===true,gearSpeed:mechanicsOn?mech('gear-speed'):0},reset)
          if(reset) patternControls.reset()
          const autoOn = context.parameters.get('auto-performance')===true
          const control = patternControls.update({
            saved:{patternChange:context.parameters.get('pattern-change')===true,trigger:context.parameters.get('trigger') as Cinema2AfterhoursTriggerId},
            mood:frame.mood,autoPerformance:autoOn&&frame.transport?.playing===true&&!frame.transport.paused,
          })
          const trigger = control.trigger
          const section = frame.audio?.structure.section
          const selected = performance.update({
            authored:context.parameters.get('pattern') as IfritPattern,editRevision:context.parameters.getEditRevision?.('pattern')??0,
            enabled:control.patternChange,trigger,
            event:resolveCinema2AfterhoursTriggerEventIdentity(frame,trigger,reset?null:previousTime),
            auto:context.parameters.get('auto-performance')===true,
            buildEvent:section?.available&&section.value?.type==='build'?section.value.id:null,
            dropEvent:resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',reset?null:previousTime),
            buildProgress:number('buildPhase',0), variation:number('directorVariation',0),
            timeSec:time,beats:phases.score,playing:frame.transport?.playing===true&&!frame.transport.paused,reset,
          })
          visual=createIfritVisualFrame(phases,{
            count:Math.round(number('count',5)),spacing:number('spacing',1),twist:number('twist',.45),detail:number('detail',1),
          },Object.fromEntries(IFRIT_CHANNELS.map(key=>[key,number(key,0)])),selected.performing,selected.previous,selected.transition)
          // The two enhancement systems read the same phases, pattern blend and shared channel values as the rings, so every pose is a pure function of
          // them. With both toggles off nothing here runs and the original visualizer renders alone.
          const shatterOn = flag('shatter-enabled', true)
          enhanced = mechanicsOn || shatterOn
          if(enhanced) {
            const text = context.parameters.get('element-overrides')
            if(text !== overridesText) { overridesText = typeof text === 'string' ? text : '{}'; overrides = parseIfritElementOverrides(overridesText) }
            const channels = Object.fromEntries(IFRIT_CHANNELS.map(key=>[key,number(key,0)]))
            const common = { aperture:number('aperture',1), spacing:number('spacing',1), overrides, quality }
            const sectors = Array.from({length:IFRIT_SECTORS},(_,s)=>({ enabled:flag(`sector-${s}-enabled`,true), armOffset:number(`sector-${s}-arm-offset`,0), bladeOffset:number(`sector-${s}-blade-offset`,0)*Math.PI/180 }))
            const mechanicsControls: IfritMechanicsControls = { ...common, enabled:mechanicsOn, density:mech('mechanics-density'), spokeExtension:mech('spoke-extension'), spokePulse:mech('spoke-pulse'), bladeSweep:mech('blade-sweep'),
              bladeCount:Math.round(mech('blade-count')), satelliteCount:Math.round(mech('satellite-count')), satelliteOrbitRadius:mech('satellite-orbit-radius'), satelliteOrbitSpeed:mech('satellite-orbit-speed'), sectors }
            const rawTrigger = context.parameters.get('shatter-trigger')
            const shatterControls: IfritShatterControls = { ...common, enabled:shatterOn, trigger:(IFRIT_SHATTER_TRIGGERS as readonly unknown[]).includes(rawTrigger)?rawTrigger as IfritShatterTrigger:'drop',
              strength:shat('shatter-strength'), hold:shat('shatter-hold'), fragmentsPerEdge:Math.round(shat('fragments-per-edge')), spread:shat('fragment-spread'), spin:shat('fragment-spin'), reassembly:shat('reassembly-duration'),
              sectorBias:Array.from({length:IFRIT_SECTORS},(_,s)=>number(`sector-${s}-shatter-bias`,1)), thickness:number('thickness',1) }
            mechanics = createIfritMechanicalFrame(phases, visual.rings, mechanicsControls, channels, selected.performing, selected.previous, selected.transition)
            shards = createIfritShatterFrame(phases, visual.rings, shatterControls, channels, selected.performing, selected.previous, selected.transition)
            survival = shards.length > 0 ? ifritOriginalSurvival(shards, survivalBuffer) : null
          } else { mechanics = []; shards = []; survival = null }
          revision=nextRevision;previousTime=time
        },
        dispose() { timeline.reset();performance.reset();patternControls.reset() },
      },
      inspect:()=>({...patternControls.inspect(),mechanicalParts:mechanics.length,shards:shards.length,detachedEdges:survival?survival.reduce((n,v)=>n+(v<.5?1:0),0):0}),
      render:{providers:[{id:`${context.module.id}:world`,moduleId:context.module.id,intent:'world',execute:exec=>{ const q=exec.lightingEnvironment?.quality; if(q==='low'||q==='medium'||q==='high') quality=q; renderer.draw(exec,context.parameters,visual,enhanced?{mechanics,shards,survival}:undefined) }}]},
    }
  },
}
