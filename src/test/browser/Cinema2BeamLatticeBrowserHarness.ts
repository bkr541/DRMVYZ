import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../support/NightshiftMusicFixture'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { MusicIntelligenceAnalyserFramePump } from '../../features/musicIntelligence/MusicIntelligenceAnalyserFramePump'
import { musicIntelligenceEngine } from '../../features/musicIntelligence/MusicIntelligenceEngine'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { cinema2NativePresetRegistry, Cinema2PresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import {CINEMA2_CRATE_PRESET_MANIFESTS} from '../../components/vyzualz/cinema2/presets/Cinema2CratePresets'
import {beamLatticeParameterId} from '../../components/vyzualz/cinema2/presets/Cinema2BeamLatticePerformance'
const BEAM_LATTICE_PRESET_ID=CINEMA2_CRATE_PRESET_MANIFESTS.find(m=>m.id==='drmvyz.cinema2.crate-beam-lattice')!.id
import { createCinema2DesignParentGroupModel } from '../../components/vyzualz/cinema2/parameters/Cinema2InspectorModel'
import type { Cinema2JsonValue } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import '../../styles/typography.css'
import '../../styles.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'

// Coverage-test seam: exercise exact allowed camera-envelope corners using the same production graph.
const coveragePose=new URLSearchParams(location.search).get('coveragePose')
let reviewRegistry=cinema2NativePresetRegistry
if(coveragePose){
 const poses:Record<string,readonly [number,number,number]>={centre:[-.021289,.286656,.82],min:[-.046289,.261656,.8],max:[.003711,.311656,.84],cross:[-.046289,.311656,.84]}
 const original=CINEMA2_CRATE_PRESET_MANIFESTS.find(m=>m.id===BEAM_LATTICE_PRESET_ID)!,pose=poses[coveragePose]??poses.centre
 reviewRegistry=new Cinema2PresetRegistry();const registration=reviewRegistry.register({...original,cameras:original.cameras!.map(c=>({...c,transform:{position:pose},motion:undefined,controls:{fovDegrees:c.controls?.fovDegrees},rig:{kind:'static'},rigVariants:{reference:{kind:'static'},orbit:{kind:'static'},manual:{kind:'static'}}}))});if(!registration.ok)throw Error(JSON.stringify(registration.diagnostics))
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
const requestedQuality = new URLSearchParams(location.search).get('quality')
const quality = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
let timestamp = 0, targetTime = 0, bpm = 120, paused = false, sourcePresent = false, hostSync = false
let tempoOnly = false
let musicActive = false, musicTime = 0, publication = 0, musicRevision = 0, eventId = 0
let music: Partial<NightshiftFixtureOptions> = {}, cachedKey = ''
let audioContext:AudioContext|null=null, analyser:AnalyserNode|null=null, realSource:AudioBufferSourceNode|null=null, pump:MusicIntelligenceAnalyserFramePump|null=null, realStart=0
let published = DEFAULT_MI_FRAME
const bridge = new Cinema2AudioIntelligenceBridge({
  getFrame: () => {
    if(pump)return AudioFeatureBus.getFrame()
    if (!musicActive) return DEFAULT_MI_FRAME
    const key = `${musicRevision}:${musicTime.toFixed(9)}`
    if (key !== cachedKey) {
      published = nightshiftMusicFixture({ ...music, timeSec: musicTime, frameId: ++publication, trackId: music.trackId ?? 'beam-lattice-audio-fixture', advanceBeatGrid: true })
      published.rhythm = { ...published.rhythm, bpm, beatIndex: Math.floor(musicTime*bpm/60), beatPhase: (musicTime*bpm/60)%1 }
      if(tempoOnly)published.rhythm={...published.rhythm,beatHit:false,downbeatHit:false,kickHit:false,snareHit:false,beatEventId:null,beatPhase:NaN,beatIndex:NaN,barIndex:NaN,beatInBar:NaN,phrase4Hit:false,phrase8Hit:false,phrase16Hit:false,phrase32Hit:false}
      cachedKey = key
    }
    return published
  },
  getPublicationMeta: () => pump ? AudioFeatureBus.getPublicationMeta() : ({ sequence: publication, publishedAtMs: timestamp, publisherId: 'beam-lattice-production-fixture', kind: 'frame' }),
})
const create = (serializedParameterState?: string) => Cinema2Runtime.create(canvas, {
  serializedParameterState, audioIntelligenceBridge: bridge,
  presetId: BEAM_LATTICE_PRESET_ID, presetRegistry: reviewRegistry, renderQuality: quality,
  requestAnimationFrame: callback => requestAnimationFrame(() => { if(audioContext&&analyser&&pump){timestamp=performance.now();musicTime=audioContext.currentTime-realStart;pump.sample({analyser,audioTime:musicTime,isPlaying:true,trackIdentity:'beam-lattice-reference-soundtrack'});callback(timestamp);return}const previous=timestamp;timestamp = Math.min(targetTime,timestamp+1000/30);if(musicActive&&!paused)musicTime+=(timestamp-previous)/1000;callback(timestamp) }),
  transportSource: { getState: () => ({ sourcePresent, playing: sourcePresent&&!paused, analysisActive: sourcePresent, paused, trackId: sourcePresent?(musicActive?music.trackId??'beam-lattice-audio-fixture':'beam-lattice-timing-fixture'):null, timeSec: musicActive?musicTime:timestamp/1000, animationActive: !paused, bpmSync: hostSync, bpm }) },
})
const result = create()
if (!result.runtime) throw new Error(`Beam Lattice failed to start: ${result.error}`)
let runtime = result.runtime
const resize = () => runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
resize(); addEventListener('resize', resize); runtime.start()
const inspectorHost = document.createElement('aside')
inspectorHost.id='beam-lattice-inspector'
inspectorHost.style.cssText='display:none;position:fixed;right:0;top:0;bottom:0;width:360px;overflow:auto;background:#171a20;color:white;padding:12px;z-index:10'
document.body.append(inspectorHost)
const inspector=createRoot(inspectorHost)
const refresh=()=>inspector.render(createElement(Cinema2InspectorPanel,{runtime,surface:'design',sharedAudioAnalysis:false}))
refresh()
const tick=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
Object.assign(window, { beamLatticeReview: {
  async coverageAt(seconds:number){musicActive=true;sourcePresent=true;musicTime=seconds;music={trackId:`coverage-${++musicRevision}`,energy:0,bass:0,high:0,vocal:0,event:null};cachedKey='';await tick();await tick()},
  tempoOnly(value:boolean){tempoOnly=value;musicRevision++;cachedKey=''},
  snapshot: () => ({ pump:pump?.diagnostics??null, mood:runtime.getMoodFrame(), director:runtime.getVisualDirectorFrame(), effects:runtime.getEffectRuntimeSnapshot(), history:runtime.getHistoryServiceSnapshot(), audio: runtime.getAudioIntelligenceFrame(), choreography: runtime.getChoreographyRuntimeSnapshot(), live: Object.fromEntries(runtime.getCompiledPresetPlan().targets.targets.filter(t=>t.kind==='module').map(t=>[t.property,runtime.getTargetResolver().resolve(t.id).value])), runtime: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(), camera: runtime.getCameraRuntimeSnapshot().camera, transport: runtime.getTransportFrameState(),
    parameters:runtime.getParameterState().getSnapshot(), groups:createCinema2DesignParentGroupModel(runtime.getCompiledPresetPlan(),runtime.getParameterState().getSnapshot()) }),
  async set(name:string,value:Cinema2JsonValue) { const result=runtime.getParameterState().setPersistentValue(beamLatticeParameterId(name),value);refresh();await tick();await tick();return result },
  async advance(seconds:number) { targetTime=timestamp+seconds*1000;while(timestamp<targetTime-.01)await tick();await tick();return timestamp },
  restart() { const saved = runtime.getParameterState().serialize(); runtime.dispose();timestamp=0;targetTime=0;musicTime=0;musicRevision++;const created=create(saved);if(!created.runtime)throw new Error(String(created.error));runtime=created.runtime;resize();runtime.start();refresh() },
  timing(options:{bpm?:number;paused?:boolean;sourcePresent?:boolean;hostSync?:boolean}) { if(options.bpm!=null)bpm=options.bpm;if(options.paused!=null)paused=options.paused;if(options.sourcePresent!=null)sourcePresent=options.sourcePresent;if(options.hostSync!=null)hostSync=options.hostSync },
  music(options: Partial<NightshiftFixtureOptions> & { active?:boolean }) { musicActive=options.active!==false;sourcePresent=musicActive;music={...music,...options};musicRevision++;return musicTime },
  event(kind: NightshiftFixtureOptions['event']) { music={...music,event:kind,eventId:++eventId,eventTime:musicTime+.1};musicRevision++;return music.eventTime },
  seek(time:number) { musicTime=time;musicRevision++ },
  inspector(visible:boolean) { inspectorHost.style.display=visible?'block':'none';refresh() },
  async playAudio(encoded:string) {
    AudioFeatureBus.reset();audioContext=new AudioContext();await audioContext.resume()
    const data=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer,buffer=await audioContext.decodeAudioData(data)
    analyser=audioContext.createAnalyser();analyser.fftSize=2048
    const mute=audioContext.createGain();mute.gain.value=0
    realSource=audioContext.createBufferSource();realSource.buffer=buffer;realSource.connect(analyser);analyser.connect(mute);mute.connect(audioContext.destination)
    musicActive=true;sourcePresent=true;paused=false;music={trackId:'beam-lattice-reference-soundtrack'};musicIntelligenceEngine.setSourceId(music.trackId!,music.trackId!)
    pump=new MusicIntelligenceAnalyserFramePump({publisherId:'beam-lattice-reference-pcm'});realStart=audioContext.currentTime;realSource.start()
  },
  async stopAudio(){realSource?.stop();realSource?.disconnect();realSource=null;pump?.dispose();pump=null;analyser?.disconnect();analyser=null;await audioContext?.close();audioContext=null;targetTime=timestamp;musicActive=false;sourcePresent=false;AudioFeatureBus.reset()},
  dispose: () => { inspector.unmount();runtime.dispose();realSource?.stop();realSource?.disconnect();pump?.dispose();analyser?.disconnect();void audioContext?.close(); return runtime.getResourceManagerSnapshot() },
} })
addEventListener('pagehide', () => {runtime.dispose();pump?.dispose();void audioContext?.close()}, { once: true })
