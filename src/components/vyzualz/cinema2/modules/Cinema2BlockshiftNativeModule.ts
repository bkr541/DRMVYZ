import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext, Cinema2ModuleInstance, Cinema2ModuleTypeDefinition, Cinema2ModuleDiagnostic } from './Cinema2ModuleContracts'
import { CINEMA2_BLOCKSHIFT_BLOCK_COUNT, CINEMA2_BLOCKSHIFT_PALETTE, CINEMA2_BLOCKSHIFT_PATTERN_IDS, type Cinema2BlockshiftPattern } from './blockshift/Cinema2BlockshiftDomain'
import { buildCinema2BlockshiftLayout, packCinema2BlockshiftInstances } from './blockshift/Cinema2BlockshiftLayout'
import { Cinema2BlockshiftRenderer } from './blockshift/Cinema2BlockshiftRenderer'
import { loadCinema2BlockshiftModels, type Cinema2BlockshiftModel } from './blockshift/Cinema2BlockshiftModels'
import { Cinema2BlockshiftAudioRuntime, CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS, CINEMA2_BLOCKSHIFT_CUE_RELEASE, type Cinema2BlockshiftAudioChannels, type Cinema2BlockshiftAudioCue, type Cinema2BlockshiftCue } from './blockshift/Cinema2BlockshiftAudio'
import { Cinema2BlockshiftPerformance, CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS, type Cinema2BlockshiftDirectorChannels } from './blockshift/Cinema2BlockshiftPerformance'
import { Cinema2BlockshiftOrchestration } from './blockshift/Cinema2BlockshiftOrchestration'
import { CINEMA2_BLOCKSHIFT_LED_FLOATS, writeCinema2BlockshiftLeds } from './blockshift/Cinema2BlockshiftLeds'
import { Cinema2BlockshiftRotation } from './blockshift/Cinema2BlockshiftRotation'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { Cinema2MainframePatternController } from './mainframe/Cinema2MainframePatternController'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity } from './Cinema2AfterhoursNativeModule'

export const CINEMA2_BLOCKSHIFT_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('blockshift-native')
export const CINEMA2_BLOCKSHIFT_NATIVE_MODULE_VERSION = 1

export interface Cinema2BlockshiftModuleInstance extends Cinema2ModuleInstance {
  inspect(): { blockIds: readonly string[]; instanceCount: number; drawCalls: number; estimatedGpuBytes: number; pattern: Cinema2BlockshiftPattern; phase: number; synced: boolean; modelState: string; transitionProgress: number; audio: ReturnType<Cinema2BlockshiftAudioRuntime['inspect']>; performance: ReturnType<Cinema2BlockshiftPerformance['inspect']> }
}
type Renderer = Pick<Cinema2BlockshiftRenderer, 'draw' | 'dispose' | 'estimateGpuBytes' | 'updateInstances'>

function number(context: Cinema2ModuleCreateContext, name: string, fallback: number, min: number, max: number): number {
  const value = context.parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
function flag(context: Cinema2ModuleCreateContext, name: string, fallback: boolean): boolean {
  const value = context.parameters.get(name)
  return typeof value === 'boolean' ? value : fallback
}
function color(context: Cinema2ModuleCreateContext, name: keyof typeof CINEMA2_BLOCKSHIFT_PALETTE): Cinema2Color {
  const value = context.parameters.get(name)
  return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component) && component >= 0 && component <= 1)
    ? value as unknown as Cinema2Color : CINEMA2_BLOCKSHIFT_PALETTE[name]
}

export function createCinema2BlockshiftNativeModuleDefinition(
  createRenderer: (gl: WebGL2RenderingContext, packed: Float32Array, models: readonly Cinema2BlockshiftModel[]) => Renderer = (gl, packed, models) => new Cinema2BlockshiftRenderer(gl, packed, models),
  loadModels: () => Promise<readonly Cinema2BlockshiftModel[]> = loadCinema2BlockshiftModels,
): Readonly<Cinema2ModuleTypeDefinition> {
  return Object.freeze<Cinema2ModuleTypeDefinition>({
    typeId: CINEMA2_BLOCKSHIFT_NATIVE_MODULE_TYPE_ID, version: CINEMA2_BLOCKSHIFT_NATIVE_MODULE_VERSION,
    validate: module => module.config?.blockCount !== undefined && module.config.blockCount !== CINEMA2_BLOCKSHIFT_BLOCK_COUNT
      ? [{ code: 'CINEMA2_BLOCKSHIFT_COUNT_INVALID', message: 'BLOCKSHIFT requires fifteen stable blocks.', path: '$.config.blockCount' }] : [],
    create(context): Cinema2BlockshiftModuleInstance {
      let layout = buildCinema2BlockshiftLayout()
      const packed = packCinema2BlockshiftInstances(layout)
      const leds = new Float32Array(CINEMA2_BLOCKSHIFT_LED_FLOATS)
      const cubeRotation = new Cinema2BlockshiftRotation()
      const clock = new Cinema2BeatClock()
      const audioRuntime = new Cinema2BlockshiftAudioRuntime()
      const performance = new Cinema2BlockshiftPerformance()
      const cues: (Omit<Cinema2BlockshiftAudioCue, 'kind'> & { kind: Cinema2BlockshiftCue | 'build' })[] = []
      let authoredGeometry: string | null = null
      let baseLayout = layout
      const orchestration = new Cinema2BlockshiftOrchestration()
      let previousAuthored: Cinema2BlockshiftPattern | null = null
      const controller = new Cinema2MainframePatternController<Cinema2BlockshiftPattern>(CINEMA2_BLOCKSHIFT_PATTERN_IDS, 'stagger')
      let renderer: Renderer | null = null, disposed = false, lastFrameId = -1
      let models: readonly Cinema2BlockshiftModel[] | null = null
      let modelState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'
      const diagnostics: Cinema2ModuleDiagnostic[] = []
      const startLoading = () => {
        modelState = 'loading'
        void loadModels().then(loaded => {
          if (disposed) return
          if (loaded.length !== 2) throw new Error('BLOCKSHIFT requires both supplied GLB models.')
          models = loaded; modelState = 'ready'
        }).catch(error => {
          if (disposed) return
          modelState = 'failed'
          diagnostics.push({ code: 'CINEMA2_BLOCKSHIFT_MODEL_LOAD_FAILED', message: error instanceof Error ? error.message : String(error), path: '$.models' })
        })
      }
      let lastTimestampMs: number | null = null
      let phase = 0, lastBeat: number | null = null, lastTime: number | null = null
      let lastTrack: string | null | undefined, lastGeneration: number | null = null, lastPaused = false
      let pattern: Cinema2BlockshiftPattern = 'stagger', synced = false
      let signature = '', dirty = false, blockedResumeEvent: string | null = null
      let eventPublication: string | null = null, publicationEvent: string | null = null, structuralClock: string | null = null
      let body: Cinema2Color = CINEMA2_BLOCKSHIFT_PALETTE.blockBody, intensity = 1
      const update = (frame: Readonly<Cinema2ModuleFrameReadContext>) => {
        if (disposed || lastFrameId === frame.frameId) return
        lastFrameId = frame.frameId
        // The shared runtime deliberately zeros animation delta without a source. Manual idle
        // transitions still use its frame timestamp; musical phase and cube spin stay stopped.
        const idleDeltaSeconds = lastTimestampMs === null ? 0 : Math.min(0.1, Math.max(0, (frame.timestampMs - lastTimestampMs) / 1000))
        lastTimestampMs = frame.timestampMs
        const time = frame.transport?.timeSec ?? frame.elapsedTimeSec
        const track = frame.transport?.trackId ?? null
        const paused = frame.transport?.paused === true
        const reset = lastGeneration !== null && (lastGeneration !== frame.contextGeneration || track !== lastTrack || (lastTime !== null && (time < lastTime || time - lastTime > Math.max(1, frame.deltaTimeSec * 4))) || frame.audio?.discontinuity.occurred === true)
        if (reset) { clock.reset(); controller.reset(); phase = 0; lastBeat = null; lastTime = null; eventPublication = null; publicationEvent = null; structuralClock = null; blockedResumeEvent = null }
        const active = frame.transport != null && frame.transport.sourcePresent && frame.transport.playing && frame.transport.animationActive && !paused
        const clockFrame = { ...frame, transport: frame.transport ? { ...frame.transport, animationActive: active } : undefined }
        const beat = clock.update(clockFrame, flag(context, 'bpmSync', true))
        synced = beat.locked
        const deltaBeats = lastBeat === null ? 0 : Math.max(0, beat.beats - lastBeat)
        const motionAmount = number(context, 'motionAmount', 0.55, 0, 1)
        cubeRotation.update({ enabled: flag(context, 'rotateCubes', false), active, reset, deltaBeats, motionAmount, motionRate: number(context, 'motionRate', 1, 0.25, 2) })
        if (active) phase = (phase + deltaBeats * number(context, 'motionRate', 1, 0.25, 2) * motionAmount / 32) % 1
        lastBeat = beat.beats
        const authored = context.parameters.get('pattern')
        const authoredPattern = CINEMA2_BLOCKSHIFT_PATTERN_IDS.includes(authored as Cinema2BlockshiftPattern) ? authored as Cinema2BlockshiftPattern : 'stagger'
        const trigger = context.parameters.get('trigger')
        const selectedTrigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.find(value => value === trigger) ?? 'bar4'
        // A structural crossing and its fixed-clock fallback must not become two triggers when
        // the same upstream publication is rendered again. Resolve it once per publication/trigger.
        const upstream = frame.audio?.upstream
        const publication = upstream ? JSON.stringify([upstream.sourceId, upstream.trackId, upstream.frameId, upstream.publicationSequence, selectedTrigger]) : null
        let eventId = active ? publication !== null && publication === eventPublication ? publicationEvent : resolveCinema2AfterhoursTriggerEventIdentity(frame, selectedTrigger, reset ? null : lastTime) : null
        const phraseClock = selectedTrigger === 'phrase' ? frame.audio?.rhythm.fixedClocks[16].boundary?.id : null
        if (eventId && phraseClock) {
          if (eventId !== phraseClock) structuralClock = phraseClock
          else if (phraseClock === structuralClock) eventId = null
        }
        if (active) { eventPublication = publication; publicationEvent = eventId }
        if (lastPaused && !paused) blockedResumeEvent = eventId
        const freshEventId = eventId === blockedResumeEvent ? null : eventId
        pattern = controller.update({ authoredPattern, patternChange: flag(context, 'patternChange', false), trigger: selectedTrigger, triggerEventId: freshEventId, absoluteBeat: beat.beats, reset }).activePattern
        const options = { pattern, phase,
          blockSize: number(context, 'blockSize', 1.35, 1.05, 6), spread: number(context, 'spread', 1, 0.5, 3),
          depth: number(context, 'depth', 0.45, 0, 1), rotationRange: number(context, 'rotationRange', 16, 0, 45),
        }
        const geometryKey = JSON.stringify([options.blockSize, options.spread, options.depth, options.rotationRange])
        const manualEdited = previousAuthored !== null && (authoredPattern !== previousAuthored || geometryKey !== authoredGeometry)
        const manualTakeover = manualEdited && performance.hasOverlay()
        const palette = { primaryEdge: color(context, 'primaryEdge'), secondaryEdge: color(context, 'secondaryEdge'), impactAccent: color(context, 'impactAccent'), blockBody: color(context, 'blockBody'), background: color(context, 'background') }
        const nextSignature = JSON.stringify([options, palette.primaryEdge, palette.secondaryEdge, palette.impactAccent])
        if (signature !== nextSignature || orchestration.getProgress() < 1 || reset) {
          const target = buildCinema2BlockshiftLayout(options)
          const durationValue = Number(context.parameters.get('transitionLength'))
          baseLayout = orchestration.update({ target, pattern, geometryKey,
            deltaBeats, deltaSeconds: active ? frame.deltaTimeSec : idleDeltaSeconds, durationBeats: [0.5, 1, 2, 4].includes(durationValue) ? durationValue : 1,
            active, frozen: paused || motionAmount === 0, reset, snap: manualTakeover || previousAuthored !== null && authoredPattern !== previousAuthored && (paused || motionAmount === 0),
          })
          signature = nextSignature
        }
        const channels = Object.fromEntries(Object.keys(CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS).map(key => [key, number(context, key, 0, 0, 1)])) as Cinema2BlockshiftAudioChannels
        const section = frame.audio?.structure?.section
        const musicalCues = cues.splice(0)
        audioRuntime.update({ channels, cues: musicalCues.filter((cue): cue is Cinema2BlockshiftAudioCue => cue.kind !== 'build').map(cue => ({ ...cue, strength: cue.kind === 'kick' || cue.kind === 'snare' ? frame.audio?.rhythm[cue.kind]?.strength ?? 1 : cue.strength })), active: active && frame.audio != null, reset: reset || !frame.audio || !frame.transport?.sourcePresent, deltaSeconds: frame.deltaTimeSec, motionAmount,
          reactivity: number(context, 'audioReactivity', 0.8, 0, 1), sectionType: section?.available ? section.value?.type ?? null : null })
        const director = Object.fromEntries(Object.keys(CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS).map(key => [key, number(context, key, 0, 0, 1)])) as Cinema2BlockshiftDirectorChannels
        const reactivity = number(context, 'audioReactivity', 0.8, 0, 1)
        performance.update({ director, cues: musicalCues.filter((cue): cue is typeof cue & { kind: 'build' | 'drop' } => cue.kind === 'build' || cue.kind === 'drop'), active: active && frame.audio != null,
          reset: reset || !frame.audio || !frame.transport?.sourcePresent, enabled: flag(context, 'autoPerformance', false), manualEdited, deltaBeats, motionAmount, reactivity })
        const rendered = audioRuntime.apply(baseLayout, reactivity, options.rotationRange, { director: performance.getDirector(), overlay: (pose, attenuation) => performance.apply(pose, reactivity, options.rotationRange, attenuation) })
        writeCinema2BlockshiftLeds({ pattern, phase, reactivity, audio: audioRuntime.inspect(), director: performance.getDirector(), macroWeight: performance.getWeight() }, leds)
        layout = cubeRotation.apply(rendered.pose)
        const before = packed.slice()
        packCinema2BlockshiftInstances(layout, palette, packed)
        rendered.emission.forEach((value, index) => { packed[index * 12 + 7] = value })
        dirty ||= packed.some((value, index) => value !== before[index])
        body = palette.blockBody
        intensity = number(context, 'masterIntensity', 1, 0, 2)
        authoredGeometry = geometryKey
        previousAuthored = authoredPattern
        lastTime = time; lastTrack = track; lastGeneration = frame.contextGeneration; lastPaused = paused
      }
      return {
        lifecycle: { update: ({ frame }) => update(frame), dispose: () => { disposed = true; renderer = null; models = null; clock.reset(); controller.reset(); orchestration.reset(); audioRuntime.reset(); performance.reset(); cubeRotation.reset(); cues.splice(0) } },
        handleAction: (action, event) => {
          if (disposed || action !== 'musicalCue' || !event.eventId || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return
          const kind = (event.payload as { kind?: unknown }).kind
          if (typeof kind !== 'string' || kind !== 'build' && !Object.prototype.hasOwnProperty.call(CINEMA2_BLOCKSHIFT_CUE_RELEASE, kind)) return
          if (cues.length < 64) cues.push({ kind: kind as Cinema2BlockshiftCue | 'build', id: event.eventId, strength: 1 })
        },
        render: { providers: [{
          id: `${context.module.id}:blockshift-world`, moduleId: context.module.id, intent: 'world',
          execute(execution) {
            if (disposed) return
            if (!execution.depthAvailable) throw new Error('BLOCKSHIFT requires a world target with depth.')
            if (!execution.camera) throw new Error('BLOCKSHIFT requires the final engine camera.')
            update(execution.frame)
            if (modelState === 'idle') startLoading()
            if (!models) return
            if (!renderer) {
              renderer = context.resources.acquire('blockshift-renderer', 'Cinema2BlockshiftRenderer', gl => createRenderer(gl, packed, models!), value => value.dispose())
              context.resources.reportGpuBytes(renderer.estimateGpuBytes()); dirty = false
            }
            if (dirty) { renderer.updateInstances(packed); dirty = false }
            renderer.draw(execution.camera.viewProjectionMatrix, body, intensity, leds)
          },
        }] },
        inspect: () => ({ blockIds: layout.map(block => block.id), instanceCount: layout.length, drawCalls: 4, estimatedGpuBytes: renderer?.estimateGpuBytes() ?? 0, pattern, phase, synced, modelState, transitionProgress: orchestration.getProgress(), audio: audioRuntime.inspect(), performance: performance.inspect() }),
        getDiagnostics: () => diagnostics,
      }
    },
  })
}
export const cinema2BlockshiftNativeModuleDefinition = createCinema2BlockshiftNativeModuleDefinition()
