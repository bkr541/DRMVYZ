import type { Cinema2ChoreographyContinuousSourcePath, Cinema2JsonValue, Cinema2ParameterId, Cinema2ParameterManifest } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import type { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import type { Cinema2TargetContributionSubmission, Cinema2TargetHandle } from '../parameters/Cinema2TargetRuntime'
import { curveSharedPerformanceProgress, smoothSharedPerformanceModulation, resolveSharedPerformanceEventEnvelope, type SharedPerformanceEnvelopeCurve } from '../../../../features/performanceCore/envelopes'
import { CINEMA2_USER_MODEL_PREVIEWS, isCinema2UserModelPreview, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'
import { selectCinema2MainframeAudio, resolveCinema2MainframePlaybackState, resolveCinema2MainframeSourceIdentity } from '../modules/mainframe/Cinema2MainframeAudioDelivery'

export const MODEL_AUDIO_SOURCES = {
  bass: 'audio.bands.bass', mid: 'audio.bands.mid', high: 'audio.bands.high', energy: 'audio.features.overallEnergy',
  beatPhase: 'timing.beatPhase', barPhase: 'timing.barPhase', build: 'audio.features.buildProgress',
} as const satisfies Record<string, Cinema2ChoreographyContinuousSourcePath>
export const MODEL_AUDIO_EVENTS = ['kick', 'snare', 'downbeat', 'beat', 'bar', 'phrase', 'section-change', 'drop'] as const
export type ModelAudioEventSource = typeof MODEL_AUDIO_EVENTS[number]
export type ModelAudioSource = keyof typeof MODEL_AUDIO_SOURCES | ModelAudioEventSource
export const MODEL_AUDIO_TARGETS = [
  'formDeformation', 'shatterSpread', 'shardImpulse', 'shardMotion', 'shardDebris', 'shardCracks', 'shardReassembly',
  'dustDensity', 'dustDrift', 'dustFlow', 'dustFlowDirection', 'dustSize', 'dustTurbulence', 'dustOpacity', 'dustImpulse', 'dustSparkle', 'dustBrightness', 'dustReassembly',
  'hologramGlow', 'hologramTransparency', 'hologramLines', 'hologramThickness', 'hologramScanWidth', 'hologramRim', 'hologramScanSpeed', 'hologramFlash', 'hologramInterference', 'hologramEcho', 'hologramDistortion',
  'sliceSeparation', 'voxelSeparation', 'voxelRotation', 'voxelVariation', 'modelYaw', 'modelScale', 'cameraOrbit', 'cameraElevation', 'cameraZoom',
  'opacity', 'emission', 'intensity', 'cinematicMetalness', 'cinematicRoughness', 'cinematicOpacity', 'cinematicEmission', 'cinematicReflection', 'cinematicIridescence', 'cinematicTransmission', 'cinematicClearcoat', 'cinematicRim', 'cinematicRimWidth', 'cinematicRimFalloff', 'cinematicRimBloom', 'cinematicAmbientIntensity', 'cinematicKeyIntensity', 'cinematicFillIntensity', 'cinematicStageRimIntensity', 'cinematicAccentIntensity', 'cinematicLightSpeed', 'cinematicFogDensity', 'cinematicHaze', 'cinematicHazeDensity', 'cinematicHazeDrift', 'cinematicFloor', 'cinematicBloom', 'cinematicBloomThreshold', 'cinematicBloomSpread', 'cinematicExposure', 'cinematicTrails', 'cinematicTrailLength', 'opticalTwist', 'opticalMelt', 'opticalAberration',
] as const
export type ModelAudioTarget = typeof MODEL_AUDIO_TARGETS[number]
const defaults: readonly [ModelAudioSource, ModelAudioTarget, number, number, number][] = [
  ['kick', 'shardImpulse', .8, 0, 1], ['bass', 'shatterSpread', .5, .25, 1], ['snare', 'hologramFlash', .65, 0, 1],
  ['high', 'dustSparkle', .7, 0, .8], ['build', 'shardCracks', .7, 0, 1], ['kick', 'cinematicKeyIntensity', .35, .12, .32],
  ['snare', 'cinematicAccentIntensity', .35, 0, .25], ['bass', 'cinematicRim', .35, 0, .5], ['build', 'cinematicBloom', .35, .06, .22],
  ['build', 'dustTurbulence', .65, .1, .85], ['kick', 'dustImpulse', .75, 0, 1], ['build', 'hologramInterference', .55, 0, .7],
]
export const MODEL_AUDIO_SLOT_COUNT = 12
export const MODEL_AUDIO_CURVES = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'exponential'] as const
export const MODEL_AUDIO_QUANTIZATION = ['none', 'beat', 'bar', 'phrase'] as const
export const MODEL_AUDIO_PROFILES = ['KINETIC', 'CASCADE', 'ORBIT', 'DISINTEGRATE', 'SIGNAL', 'METAMORPH'] as const
const title = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
const idFor = (kind: Cinema2UserModelPreviewKind, key: string) => `user-model-${kind}-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}` as Cinema2ParameterId
export const modelAudioSlotKey = (i: number, name: string) => `audioMap${i + 1}${name}`

/** Additive persistent schema, with no extra transport, Pattern or Trigger controls. */
export function createCinema2ModelAudioParameters(kind: Cinema2UserModelPreviewKind, visual: readonly Cinema2ParameterManifest[]): Cinema2ParameterManifest[] {
  const id = (key: string) => idFor(kind, key)
  const result: Cinema2ParameterManifest[] = []
  const targets = MODEL_AUDIO_TARGETS.flatMap(key => {
    const definition = visual.find(p => p.id === id(key) && p.type === 'float' && p.min != null && p.max != null)
    return definition ? [{ value: key, label: `${definition.label} (${definition.min}–${definition.max})` }] : []
  })
  const sources = [...Object.keys(MODEL_AUDIO_SOURCES), ...MODEL_AUDIO_EVENTS].map(value => ({ value, label: title(value === 'build' ? 'buildup intensity' : value) }))
  const options = (values: readonly string[]) => values.map(value => ({ value, label: title(value) }))
  const add = (key: string, label: string, type: Cinema2ParameterManifest['type'], value: Cinema2JsonValue, group: string, extra: Partial<Cinema2ParameterManifest> = {}) => result.push({ id: id(key), label, type, defaultValue: value, section: 'Design', designParentGroup: 'effects', group, order: result.length, exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false, automatable: false, ...extra })
  add('audioMappingsEnabled', 'Audio Mappings', 'boolean', false, 'Audio Modulation', { description: 'Enable up to twelve simultaneous saved assignments. Disable to restore the authored look.' })
  const material = visual.find(p => p.id === id('cinematicMaterial') && p.type === 'enum')
  if (material?.options?.length) add('audioPhraseMaterial', 'Alternate Material on Phrase', 'enum', 'off', 'Audio Modulation', { options: [{ value: 'off', label: 'Off' }, ...material.options], visibleWhen: [{ kind: 'parameter-equals', parameterId: id('audioMappingsEnabled'), value: true }], description: 'On each authoritative phrase boundary alternate between this material and the authored material.' })
  add('audioRepresentationDirector', 'Musical Representation Transitions', 'boolean', false, 'Model', { designParentGroup: 'design', order: 6, description: 'With Auto Performance on, use the existing Pattern’s choreography family to direct section, phrase and drop transitions. Off keeps the selected representation.' })
  for (let i = 0; i < MODEL_AUDIO_SLOT_COUNT; i++) {
    const [source, target, strength, min, max] = defaults[i]!
    const key = (name: string) => modelAudioSlotKey(i, name), group = `Audio Mapping ${i + 1}`
    const master = [{ kind: 'parameter-equals' as const, parameterId: id('audioMappingsEnabled'), value: true }]
    const visibleWhen = [...master, { kind: 'parameter-equals' as const, parameterId: id(key('Enabled')), value: true }]
    const field = (name: string, label: string, type: Cinema2ParameterManifest['type'], value: Cinema2JsonValue, extra: Partial<Cinema2ParameterManifest> = {}) => add(key(name), label, type, value, group, { visibleWhen, ...extra })
    const f = (name: string, label: string, value: number, min = 0, max = 1, unit?: string) => field(name, label, 'float', value, { min, max, step: .01, ...(unit ? { unit } : {}) })
    add(key('Enabled'), 'Enabled', 'boolean', true, group, { visibleWhen: master })
    field('Source', 'Audio Source', 'enum', source, { options: sources })
    field('Target', 'Visual Target', 'enum', target, { options: targets })
    f('Intensity', 'Mapping Intensity', strength)
    f('Min', 'Minimum (fraction of target range)', min); f('Max', 'Maximum (fraction of target range)', max)
    field('Curve', 'Response Curve', 'enum', 'easeOut', { options: options(MODEL_AUDIO_CURVES) })
    f('Attack', 'Attack', .06, .02, 2, 's'); f('Release', 'Release', .35, .08, 4, 's'); f('Smoothing', 'Smoothing', .04, 0, 1, 's')
    field('Invert', 'Invert', 'boolean', false); field('Quantize', 'Quantization', 'enum', 'none', { options: options(MODEL_AUDIO_QUANTIZATION) })
  }
  return result
}

export interface ModelAudioSample { available: boolean; value: number | null; confidence: number | null }
export interface ModelAudioEvent { id: string; strength: number; confidence: number | null }
export interface ModelAudioReaders {
  sample(path: Cinema2ChoreographyContinuousSourcePath, frame: Readonly<Cinema2ModuleFrameReadContext>): ModelAudioSample
  events(source: ModelAudioEventSource, frame: Readonly<Cinema2ModuleFrameReadContext>, previousAudioTime: number | null): readonly ModelAudioEvent[]
}
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const number = (value: unknown, fallback: number, min = 0, max = 1) => typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
const confident = (confidence: number | null) => confidence == null || Number.isFinite(confidence) && confidence >= .45
const state = () => ({ value: 0, initialized: true })
interface RouteState {
  signature: string; envelope: ReturnType<typeof state>; smoothing: ReturnType<typeof state>; presence: ReturnType<typeof state>
  pulse: { time: number; strength: number } | null; pending: { time: number; strength: number } | null
  held: number | null; lastAccepted: number
}
const newRoute = (signature: string): RouteState => ({ signature, envelope: state(), smoothing: state(), presence: state(), pulse: null, pending: null, held: null, lastAccepted: -Infinity })
const sequences: readonly (readonly Cinema2UserModelPreviewKind[])[] = [
  ['form', 'shatter', 'voxel', 'shatter', 'slices', 'hologram'],
  ['form', 'slices', 'shatter', 'dust', 'slices', 'hologram'],
  ['form', 'voxel', 'dust', 'shatter', 'hologram', 'slices'],
  ['form', 'dust', 'hologram', 'shatter', 'dust', 'form'],
  ['form', 'hologram', 'slices', 'hologram', 'voxel', 'dust'],
  ['form', 'shatter', 'dust', 'hologram', 'slices', 'voxel'],
]
const dropModes: readonly Cinema2UserModelPreviewKind[] = ['shatter', 'slices', 'voxel', 'dust', 'hologram', 'shatter']
const buildModes: readonly Cinema2UserModelPreviewKind[] = ['form', 'slices', 'form', 'form', 'hologram', 'hologram']
const quietModes: readonly Cinema2UserModelPreviewKind[] = ['form', 'form', 'hologram', 'form', 'hologram', 'hologram']
const eventSource = (s: unknown): s is ModelAudioEventSource => typeof s === 'string' && (MODEL_AUDIO_EVENTS as readonly string[]).includes(s)
const continuousSource = (s: unknown): s is keyof typeof MODEL_AUDIO_SOURCES => typeof s === 'string' && Object.prototype.hasOwnProperty.call(MODEL_AUDIO_SOURCES, s)

/** Scoped extension of the existing choreography writer; no analyzer, clock, or second target authority. */
export class Cinema2ModelAudioChoreography {
  private readonly routes = new Map<number, RouteState>()
  private readonly bindings = new Map<string, readonly Readonly<Cinema2TargetHandle>[]>()
  private readonly seen = new Set<string>()
  private last: { identity: string; generation: number; time: number; audioTime: number | null; model: Cinema2JsonValue | undefined; trackId: string | null; discontinuity: number | null } | null = null
  private mode: Cinema2UserModelPreviewKind | null = null
  private directorSignature: string | null = null
  private lastTransitionTime = -Infinity
  private phaseIndex = 0
  private sectionId: string | null = null
  private sectionMode: Cinema2UserModelPreviewKind | null = null
  private pendingMode: Cinema2UserModelPreviewKind | null = null
  private phraseMaterialActive = false
  private phraseMaterialSignature: string | null = null
  constructor(private readonly kind: Cinema2UserModelPreviewKind, plan: Readonly<Cinema2CompiledPresetPlan>, private readonly parameters: Cinema2ParameterState) {
    for (const key of [...MODEL_AUDIO_TARGETS, 'representation', 'transitionDuration', 'cinematicMaterial']) {
      const id = idFor(kind, key)
      this.bindings.set(key, plan.targets.targets.filter(t => t.parameterId === id && t.channel === 'value' && t.capabilityAvailability === 'available' && t.operations.includes('replace')))
    }
  }
  static create(plan: Readonly<Cinema2CompiledPresetPlan>, state: Cinema2ParameterState): Cinema2ModelAudioChoreography | null {
    const kind = plan.manifest.modules?.find(m => isCinema2UserModelPreview(m.config?.userModelPreview))?.config?.userModelPreview
    return isCinema2UserModelPreview(kind) && state.getDefinition(idFor(kind, 'audioMappingsEnabled')) ? new Cinema2ModelAudioChoreography(kind, plan, state) : null
  }
  reset(): void {
    this.routes.clear(); this.seen.clear(); this.last = null; this.mode = null; this.directorSignature = null; this.lastTransitionTime = -Infinity; this.phaseIndex = 0; this.sectionId = null; this.sectionMode = null; this.pendingMode = null; this.phraseMaterialActive = false; this.phraseMaterialSignature = null
  }
  private read(key: string) { return this.parameters.getValue(idFor(this.kind, key)) }
  private edit(key: string) { return this.parameters.getEditRevision(idFor(this.kind, key)) }
  private publish(out: Cinema2TargetContributionSubmission[], key: string, value: Cinema2JsonValue) {
    for (const target of this.bindings.get(key) ?? []) {
      // One replacement per target: combine multiple routes before publishing, rather than conflict at equal priority.
      if (typeof value === 'number' && target.valueType !== 'number' && target.valueType !== 'integer') continue
      if (typeof value === 'string' && target.valueType !== 'enum' && target.valueType !== 'string') continue
      out.push({ targetId: target.id, contribution: { contributorId: `choreography:model-audio:${key}`, operation: 'replace', value, priority: 20 } })
    }
  }
  update(frame: Readonly<Cinema2ModuleFrameReadContext>, readers: ModelAudioReaders): Cinema2TargetContributionSubmission[] {
    const out: Cinema2TargetContributionSubmission[] = []
    const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
    const accepted = { ...frame, audio, director: audio ? frame.director : null }
    const transport = frame.transport, paused = transport?.paused === true
    const playing = resolveCinema2MainframePlaybackState(frame, audio) === 'playing' && transport?.sourcePresent !== false
    const identity = resolveCinema2MainframeSourceIdentity(frame, audio), model = this.read('model')
    const time = number(transport?.timeSec ?? audio?.upstream.timeSec ?? frame.elapsedTimeSec, 0, 0, Number.MAX_SAFE_INTEGER)
    const discontinuity = audio?.discontinuity.generation ?? null
    const old = this.last
    const changed = old != null && (old.generation !== frame.contextGeneration || old.model !== model || old.trackId !== (transport?.trackId ?? null) || (!paused && old.identity !== identity) || time < old.time - .001 || time - old.time > .75 || discontinuity != null && old.discontinuity != null && discontinuity !== old.discontinuity)
    if (changed || (!playing && !paused)) this.reset()
    if (!playing && !paused) return out
    const initial = this.last === null
    const previousAudioTime = this.last?.audioTime ?? null
    const previous = this.last
    this.last = { identity: paused && previous ? previous.identity : identity, generation: frame.contextGeneration, time, audioTime: audio?.upstream.timeSec ?? previous?.audioTime ?? null, model, trackId: transport?.trackId ?? null, discontinuity: discontinuity ?? previous?.discontinuity ?? null }
    const now = frame.elapsedTimeSec, dt = playing ? number(frame.deltaTimeSec, 0, 0, .25) : 0
    const events = new Map<ModelAudioEventSource, ModelAudioEvent>()
    if (audio) for (const source of MODEL_AUDIO_EVENTS) {
      for (const event of readers.events(source, accepted, previousAudioTime)) {
        const key = `${source}:${event.id}`
        if (this.seen.has(key)) continue
        this.seen.add(key)
        if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!)
        if (!initial && playing && confident(event.confidence)) events.set(source, event)
      }
    }
    const accum = new Map<string, { value: number; weight: number }>()
    if (this.read('audioMappingsEnabled') === true) for (let i = 0; i < MODEL_AUDIO_SLOT_COUNT; i++) {
      const get = (name: string) => this.read(modelAudioSlotKey(i, name))
      const source = get('Source'), target = get('Target'), intensity = number(get('Intensity'), 0)
      const definition = typeof target === 'string' && (MODEL_AUDIO_TARGETS as readonly string[]).includes(target) ? this.parameters.getDefinition(idFor(this.kind, target)) : null
      if (get('Enabled') !== true || !definition || typeof target !== 'string' || !(eventSource(source) || continuousSource(source)) || intensity <= 0 || definition.min == null || definition.max == null) { this.routes.delete(i); continue }
      const rawCurve = get('Curve'), curve = (MODEL_AUDIO_CURVES as readonly unknown[]).includes(rawCurve) ? rawCurve as SharedPerformanceEnvelopeCurve : 'linear'
      const quant = get('Quantize'), invert = get('Invert') === true
      const attack = number(get('Attack'), .06, .02, 2), release = number(get('Release'), .35, .08, 4), smoothing = number(get('Smoothing'), .04)
      const signature = JSON.stringify([source, target, quant, invert, curve, attack, release, smoothing])
      let route = this.routes.get(i)
      if (!route || route.signature !== signature) { route = newRoute(signature); this.routes.set(i, route) }
      const quantized = quant === 'beat' || quant === 'bar' || quant === 'phrase'
      const boundary = !quantized || events.has(quant)
      let targetValue = route.envelope.value, present = route.presence.value
      if (playing) {
        if (eventSource(source)) {
          const event = events.get(source)
          if (event && now - route.lastAccepted >= .12) route.pending = { time: now, strength: number(event.strength, 1) }
          if (route.pending && now - route.pending.time > 10) route.pending = null
          if (boundary && route.pending) { route.pulse = { time: now, strength: route.pending.strength }; route.pending = null; route.lastAccepted = now }
          // Repeated transients extend an attack from its current level, not a hard reset to zero.
          const pulse = route.pulse
          const age = pulse ? Math.max(0, now - pulse.time) : Infinity
          const env = pulse ? resolveSharedPerformanceEventEnvelope(age, { attack: 0, hold: attack, release, curve: 'linear' }) : 0
          targetValue = pulse ? (invert ? 1 - pulse.strength : pulse.strength) : 0
          present = env
          if (env <= 0) route.pulse = null
        } else {
          const sample = audio ? readers.sample(MODEL_AUDIO_SOURCES[source], accepted) : null
          const valid = sample?.available && sample.value != null && Number.isFinite(sample.value) && confident(sample.confidence)
          if (!valid) { route.held = null; targetValue = 0; present = 0 }
          else {
            if (boundary) route.held = clamp(sample!.value!)
            present = route.held != null ? 1 : 0
            targetValue = route.held == null ? 0 : invert ? 1 - route.held : route.held
          }
        }
        smoothSharedPerformanceModulation(route.envelope, targetValue, dt, attack, release)
        smoothSharedPerformanceModulation(route.presence, present, dt, attack, release)
        smoothSharedPerformanceModulation(route.smoothing, route.envelope.value, dt, smoothing, smoothing)
      }
      const weight = intensity * clamp(route.presence.value)
      if (weight <= .0001) continue
      const lo = number(get('Min'), 0), hi = number(get('Max'), 1)
      const t = clamp(curveSharedPerformanceProgress(route.smoothing.value, curve))
      const fraction = Math.min(lo, hi) + Math.abs(hi - lo) * t
      const requested = definition.min + (definition.max - definition.min) * fraction
      const combined = accum.get(target) ?? { value: 0, weight: 0 }
      combined.value += requested * weight; combined.weight += weight; accum.set(target, combined)
    } else this.routes.clear()
    for (const [key, mix] of accum) {
      const base = this.read(key)
      if (typeof base !== 'number') continue
      const weight = Math.min(1, mix.weight), target = mix.value / mix.weight
      this.publish(out, key, base + (target - base) * weight)
    }
    const material = this.read('audioPhraseMaterial')
    const materialSignature = JSON.stringify([this.read('audioMappingsEnabled'), material, this.edit('cinematicMaterial'), this.edit('cinematicLook'), this.edit('audioPhraseMaterial')])
    if (this.phraseMaterialSignature !== materialSignature) { this.phraseMaterialSignature = materialSignature; this.phraseMaterialActive = false }
    const materialEnabled = this.read('audioMappingsEnabled') === true && typeof material === 'string' && material !== 'off' && this.parameters.getDefinition(idFor(this.kind, 'cinematicMaterial'))?.options?.some(option => option.value === material)
    if (!materialEnabled) this.phraseMaterialActive = false
    else if (playing && events.has('phrase')) this.phraseMaterialActive = !this.phraseMaterialActive
    if (materialEnabled && this.phraseMaterialActive && typeof material === 'string') this.publish(out, 'cinematicMaterial', material)
    this.updateDirector(accepted, events, initial, changed, playing, now, out)
    return out
  }
  private updateDirector(frame: Readonly<Cinema2ModuleFrameReadContext>, events: ReadonlyMap<ModelAudioEventSource, ModelAudioEvent>, initial: boolean, changed: boolean, playing: boolean, now: number, out: Cinema2TargetContributionSubmission[]) {
    const enabled = this.read('audioRepresentationDirector') === true && this.read('autoPerformance') === true
    const selected = this.read('representation'), fallback = this.read('defaultRepresentation')
    const base = isCinema2UserModelPreview(selected) ? selected : isCinema2UserModelPreview(fallback) ? fallback : this.kind
    const names: readonly string[] = CINEMA2_USER_MODEL_PREVIEWS[this.kind]
    const profile = Math.max(0, names.indexOf(String(this.read('pattern'))))
    const signature = JSON.stringify([enabled, selected, fallback, profile, this.edit('representation'), this.edit('defaultRepresentation'), this.edit('pattern'), this.edit('autoPerformance'), this.edit('audioRepresentationDirector')])
    const edited = this.directorSignature !== null && this.directorSignature !== signature
    this.directorSignature = signature
    if (!enabled || edited) { this.mode = null; this.phaseIndex = 0; this.sectionMode = null; this.pendingMode = null; this.lastTransitionTime = now; return }
    const section = frame.audio?.structure.section
    const sectionValue = section?.available && section.value && confident(section.confidence) && confident(section.value.confidence) ? section.value : null
    const sequence = sequences[profile] ?? sequences[0]!
    const chooseSection = () => {
      const type = sectionValue?.type
      if (type === 'intro' || type === 'outro') return 'form' as const
      if (type === 'breakdown' || type === 'break' || type === 'bridge') return quietModes[profile]!
      if (type === 'build' || type === 'preDrop') return buildModes[profile]!
      if (type === 'drop') return dropModes[profile]!
      return null
    }
    if (initial) {
      this.sectionId = sectionValue?.id ?? null
      // On seek/track replacement recover the section's intended state without replaying an impulse.
      this.mode = changed ? chooseSection() : null; this.sectionMode = sectionValue?.type === 'drop' ? null : this.mode
      this.lastTransitionTime = now
    } else if (playing) {
      const drop = events.has('drop'), sectionChange = events.has('section-change') && sectionValue?.id !== this.sectionId
      const phrase = events.has('phrase'), sectionTarget = chooseSection()
      if (sectionChange) { this.sectionId = sectionValue?.id ?? null; this.sectionMode = sectionValue?.type === 'drop' ? null : sectionTarget; this.pendingMode = sectionTarget ?? sequence[(++this.phaseIndex) % sequence.length]! }
      // A real drop preempts phrase/section; other changes wait for the previous transition.
      const hold = Math.max(.6, number(this.read('transitionDuration'), 0, 0, 3))
      let next: Cinema2UserModelPreviewKind | null = null
      if (drop) { next = dropModes[profile]!; this.pendingMode = null; this.sectionMode = null }
      else if (this.pendingMode && now - this.lastTransitionTime >= hold) { next = this.pendingMode; this.pendingMode = null }
      else if (phrase && now - this.lastTransitionTime >= Math.max(hold, 2) && !this.sectionMode) next = sequence[(++this.phaseIndex) % sequence.length]!
      if (next && next !== (this.mode ?? base)) { this.mode = next; this.lastTransitionTime = now }
    }
    if (this.mode) {
      if (this.mode !== base) this.publish(out, 'representation', this.mode)
      this.publish(out, 'transitionDuration', Math.max(.45, number(this.read('transitionDuration'), 0, 0, 3)))
    }
  }
}
