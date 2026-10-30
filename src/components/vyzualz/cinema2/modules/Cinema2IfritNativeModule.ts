import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2IfritRenderer } from './ifrit/Cinema2IfritRenderer'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { IfritPerformance } from './ifrit/Cinema2IfritPerformance'
import { IFRIT_CHANNELS, type IfritPattern } from './ifrit/Cinema2IfritDomain'
import { IfritTimeline, createIfritVisualFrame } from './ifrit/Cinema2IfritMotion'

export const CINEMA2_IFRIT_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('ifrit-native')
export const cinema2IfritNativeModuleDefinition: Cinema2ModuleTypeDefinition = {
  typeId: CINEMA2_IFRIT_MODULE_TYPE, version: 1,
  create(context) {
    const renderer = context.resources.acquire('ifrit-passage', 'IfritGeometry', gl => new Cinema2IfritRenderer(gl), value => value.dispose())
    context.resources.reportGpuBytes(renderer.gpuBytes)
    const timeline = new IfritTimeline(), performance = new IfritPerformance()
    let previousTime: number | null = null, revision = '', previousTimestamp: number | null = null, idleTime = 0
    let visual = createIfritVisualFrame({travel:0,spin:0,score:0},{count:5,spacing:1,twist:.45,detail:1},{},'infernalPassage')
    const number = (key: string, fallback: number) => {
      const v = context.parameters.get(key)
      return typeof v === 'number' && Number.isFinite(v) ? v : fallback
    }
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
          const phases = timeline.update(frame,time,{travel:number('travel',.6),rotation:number('rotation',.15),sync:context.parameters.get('bpm-sync')===true},reset)
          const trigger = context.parameters.get('trigger') as Cinema2AfterhoursTriggerId
          const section = frame.audio?.structure.section
          const selected = performance.update({
            authored:context.parameters.get('pattern') as IfritPattern,editRevision:context.parameters.getEditRevision?.('pattern')??0,
            enabled:context.parameters.get('pattern-change')===true,trigger,
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
          revision=nextRevision;previousTime=time
        },
        dispose() { timeline.reset();performance.reset() },
      },
      render:{providers:[{id:`${context.module.id}:world`,moduleId:context.module.id,intent:'world',execute:exec=>renderer.draw(exec,context.parameters,visual)}]},
    }
  },
}
