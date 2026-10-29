import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { TrippyBroPerformance } from './trippyBro/Cinema2TrippyBroPerformance'
import { CINEMA2_TRIPPY_BRO_FRAGMENT_SOURCE } from './trippyBro/Cinema2TrippyBroShader'
import { TRIPPY_BRO_COLORS, TRIPPY_BRO_PATTERNS } from './trippyBro/Cinema2TrippyBroDomain'

export const CINEMA2_TRIPPY_BRO_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('trippy-bro-native')
export const cinema2TrippyBroNativeModuleDefinition = Object.freeze<Cinema2ModuleTypeDefinition>({
  typeId: CINEMA2_TRIPPY_BRO_NATIVE_MODULE_TYPE_ID, version: 1,
  create(context) {
    const clock = new Cinema2BeatClock()
    const performance = new TrippyBroPerformance()
    let phase = 0, lastBeat = 0, previousTime: number | null = null, generation: number | null = null
    let track: string | null | undefined, contextGeneration = -1, analysisRevision = ''
    let selected = { base: 'prismLattice', performing: 'prismLattice', previous: 'prismLattice', transition: 1, overridden: false } as ReturnType<TrippyBroPerformance['update']>
    const number = (name: string, fallback: number) => { const value = context.parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
    return {
      lifecycle: {
        update({ frame }) {
          const time = frame.transport?.sourcePresent ? frame.transport.timeSec : frame.elapsedTimeSec
          const revision = `${frame.audio?.upstream.analysisRevision ?? ''}:${frame.audio?.upstream.timelineRevision ?? ''}`
          const reset = revision !== analysisRevision || contextGeneration !== frame.contextGeneration || generation !== (frame.audio?.discontinuity.generation ?? 0)
            || track !== frame.transport?.trackId || (previousTime != null && time < previousTime-0.001)
          if (reset) { clock.reset(); performance.reset(); phase = 0; lastBeat = 0 }
          analysisRevision = revision; contextGeneration = frame.contextGeneration; generation = frame.audio?.discontinuity.generation ?? 0; track = frame.transport?.trackId
          const beat = clock.update({ ...frame, elapsedTimeSec: time }, context.parameters.get('bpm-sync') === true).beats
          const playing = frame.transport?.playing !== false && frame.transport?.paused !== true && frame.transport?.animationActive !== false
          const dt = reset ? 0 : Math.max(0,beat-lastBeat)
          const significance = Math.max(number('energy',0),number('directorIntensity',0),number('directorMomentum',0))
          phase += dt*0.5*number('speed',1)*(1+Math.min(1,significance)*0.2)
          lastBeat = beat
          const trigger = context.parameters.get('trigger') as Cinema2AfterhoursTriggerId
          const section = frame.audio?.structure.section
          const buildEvent = section?.available && section.value?.type === 'build' ? section.value.id : null
          selected = performance.update({
            authored: context.parameters.get('pattern') as typeof TRIPPY_BRO_PATTERNS[number], editRevision: context.parameters.getEditRevision?.('pattern') ?? 0,
            enabled: context.parameters.get('pattern-change') === true, trigger,
            event: resolveCinema2AfterhoursTriggerEventIdentity(frame,trigger,reset ? null : previousTime),
            auto: context.parameters.get('auto-performance') === true, buildEvent,
            dropEvent: resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',reset ? null : previousTime),
            timeSec: time, beats: beat, playing, reset,
          })
          previousTime = time
        },
        dispose() { clock.reset(); performance.reset() },
      },
      render: { providers: [{
        id: `${context.module.id}:neon-instrument`, moduleId: context.module.id, intent: 'fullscreen',
        execute({ target, width, height }) {
          const program = context.resources.acquire('trippy-bro:program', 'ShaderProgram', gl => {
            const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
              label: 'Cinema2/TrippyBro/NeonInstrument', vertSrc: FULLSCREEN_VERT_SRC, fragSrc: CINEMA2_TRIPPY_BRO_FRAGMENT_SOURCE,
              requiredUniforms: ['u_resolution', 'u_pattern', 'u_phase'],
            })
            if (!result.program) throw new Error(`Trippy, Bro shader ${result.error.stage}: ${result.error.log}`)
            return result.program
          }, value => value.dispose())
          const pass = context.resources.acquire('trippy-bro:pass', 'FullscreenPass', gl => new FullscreenPass(gl), value => value.dispose())
          program.activate()
          program.setVec2('u_resolution', width, height)
          const pattern = Math.max(0, TRIPPY_BRO_PATTERNS.indexOf(selected.performing))
          program.setFloat('u_pattern', pattern)
          program.setFloat('u_previous', TRIPPY_BRO_PATTERNS.indexOf(selected.previous))
          program.setFloat('u_transition', selected.transition)
          program.setFloat('u_phase', phase)
          for (const [name, fallback] of Object.entries({ scale: 1, density: 13, width: 1, amount: 0.45, detail: 0.3, intensity: 1, split: 0, echo: 0 })) program.setFloat(`u_${name}`, (name === 'density' ? Math.min(number(name,fallback),2*Math.ceil((number(name,fallback)*(1-Math.min(1,number('vocal',0))*0.25)-1)/2)+1) : number(name, fallback)))
          for (const name of ['bass','energy','kick','snare','build','drop','highs','vocal']) {
            const director = name === 'energy' ? number('directorIntensity',0) : name === 'build' ? number('directorBuild',0) : name === 'drop' ? number('directorImpact',0)*0.3 : 0
            program.setFloat(`u_${name}`, Math.min(1,Math.max(0,number(name,0),director)))
          }
          for (const [name, fallback] of Object.entries(TRIPPY_BRO_COLORS)) {
            const value = context.parameters.get(name)
            const color = Array.isArray(value) ? value as number[] : fallback
            program.setVec3(`u_${name}`, color[0],color[1],color[2])
          }
          pass.run(program, target, width, height, [])
        },
      }] },
    }
  },
})
