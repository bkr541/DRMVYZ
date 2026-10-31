import { GlassfallAutoPerformance } from './Cinema2GlassfallAutoPerformance'
import { GLASSFALL_DIRECTOR_SILENCE, GLASSFALL_DIRECTOR_NEUTRAL, readGlassfallDirector, resolveGlassfallDirector } from './Cinema2GlassfallDirector'
import { sampleGlassfallAudio, GLASSFALL_SILENCE, GlassfallPatternSelection, readGlassfallChoreography } from './Cinema2GlassfallAudio'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import triangleUrl from './triangle.glb?url'
import type * as Three from 'three'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition } from '../Cinema2ModuleContracts'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { GlassfallTimeline, readGlassfallControls, GLASSFALL_DEFAULT_CONTROLS } from './Cinema2GlassfallMotion'
import { Cinema2GlassfallRenderer } from './Cinema2GlassfallRenderer'

export const GLASSFALL_PHASE1_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('glassfall-phase1-static')
function disposeSource(source: Three.Object3D) {
  source.traverse(object => {
    const mesh = object as Three.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
}
function createGlassfallModule(context: Cinema2ModuleCreateContext, animated: boolean, audioEnabled = false, choreographed = false, directed = false, automatic = false): ReturnType<Cinema2ModuleTypeDefinition['create']> {
    const timeline = new GlassfallTimeline(), selection = new GlassfallPatternSelection(), auto = new GlassfallAutoPerformance()
    let directorFacts = { ...GLASSFALL_DIRECTOR_SILENCE }, director = GLASSFALL_DIRECTOR_NEUTRAL
    let audio = { ...GLASSFALL_SILENCE }, response = 0
    let previousTimestamp: number | null = null, idleTime = 0
    let controls = GLASSFALL_DEFAULT_CONTROLS, phases = { travel: 0, score: 0 }, previousTime: number | null = null, revision = ''
    const diagnostics: Cinema2ModuleDiagnostic[] = [], abort = new AbortController()
    let disposed = false, library: Cinema2ThreeLibrary | null = null, source: Three.Object3D | null = null
    void Promise.all([
      loadCinema2ThreeLibrary(),
      fetch(triangleUrl, { signal: abort.signal }).then(response => {
        if (!response.ok) throw new Error(`GLASSFALL triangle GLB failed: ${response.status}`)
        return response.arrayBuffer()
      }),
    ]).then(async ([loaded, bytes]) => {
      if (disposed) return
      const gltf = await new loaded.GLTFLoader().parseAsync(bytes, '')
      if (disposed) { disposeSource(gltf.scene); return }
      source = gltf.scene
      library = loaded
    }).catch(error => {
      if (!disposed) diagnostics.push({ code: 'GLASSFALL_GEOMETRY_LOAD_FAILED', path: '$.modules', message: String(error) })
    })
    return {
      lifecycle: {
        update({ frame }) {
          if (!animated) return
          controls = readGlassfallControls(context.parameters)
          const idle = frame.transport?.sourcePresent === false
          const idleDelta = previousTimestamp === null ? 0 : Math.min(.1, Math.max(0, (frame.timestampMs - previousTimestamp) / 1000))
          previousTimestamp = frame.timestampMs
          idleTime = idle ? idleTime + idleDelta : 0
          // The host freezes musical elapsed time without a source. Ambient
          // decoration uses wall time only while no musical source is present.
          const time = idle ? idleTime : frame.transport?.timeSec ?? frame.elapsedTimeSec
          const nextRevision = `${frame.contextGeneration}:${frame.transport?.sourcePresent}:${frame.transport?.trackId}:${frame.audio?.discontinuity.generation ?? 0}:${frame.audio?.upstream.analysisRevision ?? ''}`
          const reset = previousTime === null || nextRevision !== revision || time < previousTime - .001
          phases = timeline.update(frame, time, controls, reset)
          if (audioEnabled) {
            controls.pattern = selection.update(frame, controls.pattern, context.parameters.getEditRevision?.('pattern') ?? 0,
              context.parameters.get('patternChange') === true, context.parameters.get('trigger') as Cinema2AfterhoursTriggerId, previousTime, reset)
            if (reset) audio = { ...GLASSFALL_SILENCE }
            if (choreographed) {
              audio = context.parameters.get('choreography') === false ? { ...GLASSFALL_SILENCE } : readGlassfallChoreography(context.parameters)
            } else if (frame.transport?.playing && !frame.transport.paused) audio = sampleGlassfallAudio(frame)
            const value = context.parameters.get('response')
            response = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : .7
          }
          if (directed) {
            if (reset) directorFacts = { ...GLASSFALL_DIRECTOR_SILENCE }
            if (!frame.transport?.paused) directorFacts = readGlassfallDirector(context.parameters)
            const influence = context.parameters.get('directorInfluence')
            director = resolveGlassfallDirector(directorFacts, typeof influence === 'number' ? influence : .35, context.parameters.get('choreography') !== false)
          }
          if (automatic) {
            const section = frame.audio?.structure.section
            const buildId = section?.available && (section.value?.type === 'build' || section.value?.type === 'preDrop') ? section.value.id : null
            controls.pattern = auto.update({ base: controls.pattern, editRevision: context.parameters.getEditRevision?.('pattern') ?? 0,
              enabled: context.parameters.get('autoPerformance') === true, playing: frame.transport?.playing === true && !frame.transport.paused,
              reset, time, buildId, dropId: resolveCinema2AfterhoursTriggerEventIdentity(frame, 'drop', reset ? null : previousTime) })
          }
          previousTime = time; revision = nextRevision
        },
        dispose() { disposed = true; abort.abort(); if (source) disposeSource(source); source = null; library = null },
      },
      getDiagnostics: () => diagnostics,
      render: { providers: [{
        id: `${context.module.id}:raised-field`, moduleId: context.module.id, intent: 'world',
        execute(exec) {
          if (!library || !source || disposed) return
          const loaded = library, asset = source
          const renderer = context.resources.acquire('raised-field', 'three-scene', gl => new Cinema2GlassfallRenderer(loaded, gl, asset), value => value.dispose())
          context.resources.reportGpuBytes(renderer.estimateGpuBytes())
          renderer.draw(exec, context.parameters.get('reviewDepth') !== false, context.parameters.get('reviewOblique') === true, animated ? controls : undefined, phases, audio, response, director)
        },
      }] },
    }
}

export const cinema2GlassfallPhase1Module: Cinema2ModuleTypeDefinition = { typeId: GLASSFALL_PHASE1_MODULE_TYPE, version: 1, create: context => createGlassfallModule(context, false) }
export const GLASSFALL_PHASE2_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('glassfall-phase2-manual')
export const cinema2GlassfallPhase2Module: Cinema2ModuleTypeDefinition = { typeId: GLASSFALL_PHASE2_MODULE_TYPE, version: 1, create: context => createGlassfallModule(context, true) }

export const GLASSFALL_PHASE3_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('glassfall-phase3-audio')
export const cinema2GlassfallPhase3Module: Cinema2ModuleTypeDefinition = { typeId: GLASSFALL_PHASE3_MODULE_TYPE, version: 1, create: context => createGlassfallModule(context, true, true) }

export const GLASSFALL_PHASE4_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('glassfall-phase4-choreography')
export const cinema2GlassfallPhase4Module: Cinema2ModuleTypeDefinition = { typeId: GLASSFALL_PHASE4_MODULE_TYPE, version: 1, create: context => createGlassfallModule(context, true, true, true) }

export const GLASSFALL_PHASE5_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('glassfall-phase5-director')
export const cinema2GlassfallPhase5Module: Cinema2ModuleTypeDefinition = { typeId: GLASSFALL_PHASE5_MODULE_TYPE, version: 1, create: context => createGlassfallModule(context, true, true, true, true) }

export const GLASSFALL_MODULE_TYPE = cinema2StableId<Cinema2ModuleTypeId>('glassfall-native')
export const cinema2GlassfallNativeModule: Cinema2ModuleTypeDefinition = { typeId: GLASSFALL_MODULE_TYPE, version: 1, create: context => createGlassfallModule(context, true, true, true, true, true) }
