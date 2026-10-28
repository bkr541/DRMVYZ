import { describe, expect, it } from 'vitest'
import { CINEMA2_ELEVHATE_PRESET_MANIFEST as manifest, elevhateParameter as id } from '../presets/Cinema2ElevhatePreset'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2ElevhatePerformance } from '../modules/elevhate/Cinema2ElevhatePerformance'
import { ELEVHATE_PATTERNS, buildElevhateInstances } from '../modules/elevhate/Cinema2ElevhateGeometry'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'

function compile() {
  const c = compileCinema2NativePreset(manifest)
  if (!c.ok) throw new Error(JSON.stringify(c.diagnostics))
  return c.plan
}
function setup() {
  let time = 0, timestamp = 0, sequence = 0, revision = 0
  let source = nightshiftMusicFixture({ timeSec: 0, frameId: 0 })
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => source, getPublicationMeta: () => ({ sequence, publishedAtMs: timestamp, publisherId: 'elevhate-test', kind: 'frame' }) })
  const values: Record<string, unknown> = { pattern: 'crossgrid', response: .8 }
  const next = (options: Partial<NightshiftFixtureOptions> & { paused?: boolean; noAudio?: boolean; repeat?: boolean; seek?: number; bpm?: number; generation?: number } = {}): Cinema2ModuleUpdateContext => {
    timestamp += 100; if (!options.paused) time += .1; if (options.seek != null) time = options.seek
    sequence++
    if (!options.repeat) {
      source = nightshiftMusicFixture({ ...options, timeSec: time, frameId: sequence })
      if (options.bpm) source = { ...source, rhythm: { ...source.rhythm, bpm: options.bpm } }
    }
    return { parameters: { get: name => values[name] as never, getAuthored: name => values[name] as never, resolve: () => null, getEditRevision: () => revision }, targets: {} as Cinema2ModuleUpdateContext['targets'], frame: {
      frameId: sequence, timestampMs: timestamp, deltaTimeSec: .1, elapsedTimeSec: time, contextGeneration: options.generation ?? 1,
      viewport: { width: 960, height: 540, dpr: 1 }, director: null, audio: options.noAudio ? null : bridge.capture(sequence),
      transport: { sourcePresent: true, playing: !options.paused, paused: !!options.paused, analysisActive: true, animationActive: !options.paused, timeSec: time, trackId: source.trackId, bpm: options.bpm ?? 120 },
    } }
  }
  return { values, next, edit: () => revision++ }
}

describe('Elevhate native preset', () => {
  it('compiles six programs, four standard parents, exact shared triggers and five independently bound palette roles', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(preset => preset.manifest.id === manifest.id)!
    expect(declaration.role).toBe('keeper')
    expect(validateCinema2PresetAuthoringConventions(declaration)).toEqual({ ok: true, diagnostics: [] })
    const plan = compile(), parameters = new Cinema2ParameterState(plan.parameters)
    expect(ELEVHATE_PATTERNS).toHaveLength(6)
    const groups = () => createCinema2DesignParentGroupModel(plan, parameters.getSnapshot())
    expect(groups().map(g => g.id)).toEqual(['master-controls','design','effects','palette'])
    const controls = () => groups().flatMap(g => [...g.controls, ...g.groups.flatMap(n => n.controls)])
    expect(controls().some(c => c.definition.id === id('trigger'))).toBe(false)
    parameters.setPersistentValue(id('patternChange'), true)
    expect(controls().find(c => c.definition.id === id('trigger'))?.definition.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(manifest.parameters!.filter(p => p.type === 'color')).toHaveLength(5)
    const instances = buildElevhateInstances(4,1)
    const cells = new Set<string>()
    for(let i=0;i<instances.length;i+=4) if(instances[i+3]===0) cells.add(Array.from(instances.slice(i,i+3)).join(','))
    expect(cells.size).toBe(729)
  })

  it.each(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS.map(t => t.value))('advances once on canonical %s and preserves manual takeover', trigger => {
    const s = setup(), performance = new Cinema2ElevhatePerformance()
    s.values.patternChange = true; s.values.trigger = trigger
    performance.update(s.next())
    const event = trigger === 'beat2' || trigger === 'beat4' ? 'beat' : trigger.startsWith('bar') ? 'bar' : trigger as NightshiftFixtureOptions['event']
    performance.update(s.next({ event, beatIndex: 32, eventId: 32 }))
    expect(performance.state.pattern).toBe('nested-bays')
    performance.update(s.next({ repeat: true })); expect(performance.state.pattern).toBe('nested-bays')
    s.values.pattern = 'offset-blocks'; s.edit(); performance.update(s.next({ repeat: true }))
    expect(performance.state.pattern).toBe('offset-blocks'); expect(s.values.patternChange).toBe(true)
    performance.update(s.next({ event, beatIndex: 64, eventId: 64 })); expect(performance.state.pattern).toBe('split-frames')
  })

  it('temporarily performs builds/drops, restores the advanced base, and latches paused and manually consumed events', () => {
    const s = setup(), performance = new Cinema2ElevhatePerformance()
    s.values.patternChange = true; s.values.trigger = 'kick'; s.values.autoPerformance = true
    performance.update(s.next())
    s.values.buildPressure = 1; performance.update(s.next({ build: 1 })); expect(performance.state.pattern).toBe('nested-bays')
    performance.update(s.next({ event: 'kick' }))
    performance.update(s.next({ event: 'kick' }))
    s.values.buildPressure = 0; performance.update(s.next()); expect(performance.state.pattern).toBe('crossroads')
    s.values.musicDrop = 1; performance.update(s.next({ event: 'drop' })); expect(performance.state.pattern).toBe('crossroads')
    s.values.pattern = 'terraced-stacks'; s.edit(); performance.update(s.next()); expect(performance.state.pattern).toBe('terraced-stacks')
    performance.update(s.next()); expect(performance.state.pattern).toBe('terraced-stacks')
    s.values.musicDrop = 0; performance.update(s.next())
    performance.update(s.next({ event: 'kick', paused: true })); performance.update(s.next({ repeat: true })); expect(performance.state.pattern).toBe('terraced-stacks')
    s.values.response = 0; s.values.musicKick = 1; performance.update(s.next()); expect(performance.state.kick).toBe(0)
    performance.update(s.next({ seek: 0 })); expect(performance.state.phase).toBe(0)
    performance.update(s.next({ trackId: 'new-track' })); expect(performance.state.phase).toBe(0)
  })

  it('holds on pause, survives missing analysis and uses shared BPM or a deliberate free clock', () => {
    const a=setup(),b=setup(),slow=new Cinema2ElevhatePerformance(),free=new Cinema2ElevhatePerformance()
    b.values.bpmSync=false; slow.update(a.next()); free.update(b.next())
    for(let i=0;i<30;i++){slow.update(a.next({bpm:60}));free.update(b.next({bpm:60}))}
    expect(free.state.phase).toBeGreaterThan(slow.state.phase*1.7)
    const held=free.state.phase;free.update(b.next({paused:true}));expect(free.state.phase).toBe(held)
    free.update(b.next({noAudio:true}));expect(free.state.phase).toBeGreaterThan(held)
  })

  it('keeps continuous multi-axis camera travel and clearance through two loops at minimum opening', () => {
    const plan=compile(),parameters=new Cinema2ParameterState(plan.parameters)
    parameters.setPersistentValue(id('opening'),3);parameters.setPersistentValue(id('sway'),.2)
    const resolver=new Cinema2FinalValueResolver(plan.targets,{resolveBaseValue:t=>t.parameterId?parameters.getValue(t.parameterId):t.authoredBaseValue})
    const spatial=new Cinema2SpatialRuntime(plan.scene,plan.targets.targets,resolver),camera=new Cinema2CameraRuntime(plan,parameters,resolver,spatial)
    let previous: ReturnType<typeof camera.update> | null=null, minY=Infinity,maxY=-Infinity,minStep=Infinity,maxStep=0
    let lastFrame: Cinema2ModuleFrameReadContext
    for(let i=0;i<=82*60;i++){
      const time=i/60
      lastFrame={frameId:i+1,timestampMs:time*1000,deltaTimeSec:1/60,elapsedTimeSec:time,contextGeneration:1,viewport:{width:960,height:540,dpr:1},audio:null,director:null,transport:{sourcePresent:true,playing:true,paused:false,animationActive:true,analysisActive:true,timeSec:time,trackId:'route',bpm:120}}
      const pose=camera.update(lastFrame)
      if(previous&&i>20){const step=Math.hypot(...pose.position.map((v,axis)=>v-previous!.position[axis]));minStep=Math.min(minStep,step);maxStep=Math.max(maxStep,step)
        const heading=pose.target.map((v,axis)=>v-pose.position[axis]), oldHeading=previous.target.map((v,axis)=>v-previous!.position[axis])
        const dot=heading.reduce((sum,v,axis)=>sum+v*oldHeading[axis],0)/(Math.hypot(...heading)*Math.hypot(...oldHeading))
        expect(dot).toBeGreaterThan(.98)
      }
      // Nearest corner mass: its center is (cell+.5)*12, half extent 4.5.
      const outside=pose.position.map(v=>Math.max(0,Math.abs(((v%12)+12)%12-6)-4.5))
      expect(Math.hypot(...outside)).toBeGreaterThan(1)
      expect(pose.fovDegrees).toBe(80);expect(Math.abs(pose.rollDegrees)).toBeLessThan(.01)
      minY=Math.min(minY,pose.position[1]);maxY=Math.max(maxY,pose.position[1]);previous=pose
    }
    expect(minY).toBeLessThan(-11);expect(maxY).toBeGreaterThan(11)
    expect(minStep).toBeGreaterThan(.03);expect(maxStep).toBeLessThan(.14)
    parameters.setPersistentValue(id('speed'),0)
    for(let i=0;i<100;i++)camera.update({...lastFrame!,frameId:5000+i,timestampMs:84000+i*16,deltaTimeSec:1/60})
    const held=camera.getSnapshot().camera
    const paused=camera.update({...lastFrame!,frameId:5200,timestampMs:87000,deltaTimeSec:1/60})
    paused.position.forEach((v,axis)=>expect(v).toBeCloseTo(held.position[axis],9))
  })
})
