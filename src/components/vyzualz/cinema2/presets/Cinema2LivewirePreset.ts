import {
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest, type Cinema2Color, type Cinema2EffectId, type Cinema2NativePresetManifest,
  type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId, type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID } from '../effects/Cinema2ReflectiveFloorEffect'
import { CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'
import { CINEMA2_LIVEWIRE_MODULE_TYPE_ID } from '../modules/Cinema2LivewireNativeModule'
import { LIVEWIRE_FLOOR_Y, LIVEWIRE_PATTERNS } from '../modules/livewire/Cinema2LivewireBridge'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import { CINEMA2_SAY_IT_AUTHORED_PRESET_MANIFEST } from './Cinema2SayItPreset'

export const CINEMA2_LIVEWIRE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.livewire')
const id = (name: string) => cinema2StableId<Cinema2ParameterId>(`livewire-${name}`)
const ref = (name: string) => cinema2Ref(id(name))
const template = JSON.parse(JSON.stringify(CINEMA2_SAY_IT_AUTHORED_PRESET_MANIFEST)
  .replaceAll('say-it', 'livewire').replaceAll('SAY IT', 'LIVEWIRE')) as Cinema2NativePresetManifest
const sourceModule = template.modules![0]!
const floor = cinema2StableId<Cinema2EffectId>('livewire-reflective-floor')
const bloom = cinema2StableId<Cinema2EffectId>('livewire-bloom-effect')
const background: Cinema2Color = [0.002, 0.004, 0.006, 1]
const floorTint: Cinema2Color = [0.025, 0.038, 0.044, 1]
const metal: Cinema2Color = [0.21, 0.25, 0.26, 1]
const led: Cinema2Color = [0.025, 0.88, 1, 1]
const removed = new Set([
  'motion-program', 'motion-direction', 'motion-safety', 'glyph-delay', 'axis-x', 'axis-y', 'axis-z', 'random-seed',
  'spread', 'material-style', 'environment-reflection', 'led-outline', 'highlight-sweep', 'camera-motion', 'trails', 'focus',
].map(id))

const overrides: Record<string, Partial<Cinema2ParameterManifest>> = {
  text: { defaultValue: 'LIVEWIRE' },
  'line-mode': { defaultValue: 'one' },
  tracking: { defaultValue: 0.04 },
  'line-spacing': { defaultValue: 0.84 },
  'glyph-scale': { label: 'Letter Scale', defaultValue: 0.42 },
  motion: { defaultValue: 0.8, description: 'Scales LED sweep travel and musical accents. At zero the pattern holds a static pose.' },
  'auto-performance': { defaultValue: false, description: 'Let the music choose LED accents, pattern timing, camera shots and bloom. Follows the System Settings default.' },
  'cycle-seconds': { label: 'Sweep Period', group: 'Lighting', defaultValue: 4, max: 12, description: 'How long the LED sweep takes at 120 BPM. BPM Sync follows the track tempo.' },
  roughness: { label: 'Letter Roughness', group: 'Lighting', defaultValue: 0.26 },
  pattern: { designParentGroup: 'design', defaultValue: 'trace', options: LIVEWIRE_PATTERNS, description: 'Select the arrangement and travel of the inset LED bars.' },
  'pattern-change': { designParentGroup: 'design' },
  trigger: { designParentGroup: 'design' },
  bloom: { defaultValue: 0.39, max: 1.5 },
  finish: { defaultValue: 0.52 },
  background: { defaultValue: background },
  chrome: { label: 'Metal Tint', defaultValue: metal, description: 'Tint of the machined glyph shells.' },
  'outline-color': { label: 'LED Color', defaultValue: led, description: 'Color of the illuminated bars and their reflections.' },
}

function slider(name: string, label: string, group: 'design' | 'effects', initial: number, min: number, max: number, order: number, description: string): Cinema2ParameterManifest {
  return {
    id: id(name), label, type: 'float', designParentGroup: group, group: group === 'design' ? 'Lighting' : 'Floor',
    section: 'Design', description, order, defaultValue: initial, min, max, step: 0.01,
    exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: true, choreographable: true,
  }
}

const bindings = Object.fromEntries(Object.entries(sourceModule.parameterBindings ?? {}).filter(([, binding]) => !removed.has(binding.$ref)))
const active = ref('auto-performance')
const cameraRef = cinema2Ref(template.cameras![0]!.id)
const cameraPosition = { kind: 'camera' as const, ref: cameraRef, property: 'transform.position' }

// The shared camera runtime applies the Camera Amount and Motion Safety permission
// to ALL camera contributions. Do not also use strengthParameter (double scaling).
function sectionShot(name: string, sections: readonly string[], offset: Cinema2Vector3): Cinema2ChoreographyRuleManifest {
  return {
    id: ruleId(name), priority: 110, enabledParameter: active,
    // A constant weight, only while the shared Director reports this section.
    source: { signal: 'continuous', path: 'director.intensity', capability: 'visual-director.significance', scale: 0, offset: 1 },
    conditions: [{ kind: 'capability', capability: 'music.section' }, { kind: 'section-type', values: sections }],
    actions: [{ id: actionId(name), target: cameraPosition, operation: 'add', value: offset }],
  }
}
const target = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(sourceModule.id), property })
const ruleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`livewire-${name}`)
const actionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`livewire-${name}`)
function continuous(property: string, path: Cinema2ChoreographyContinuousSourcePath, capability: 'audio.features' | 'audio.bands' | 'visual-director.significance', smoothingMs: number): Cinema2ChoreographyRuleManifest {
  return {
    id: ruleId(property.toLowerCase()), priority: 30, enabledParameter: active,
    source: { signal: 'continuous', path, capability, smoothingMs, clamp: [0, 1] },
    conditions: [{ kind: 'not-silent' }],
    actions: [{ id: actionId(property.toLowerCase()), target: target(property), operation: 'replace' }],
  }
}

function accent(signal: 'kick' | 'snare' | 'transient' | 'drop', property: string, hold: number, release: number): Cinema2ChoreographyRuleManifest {
  return {
    id: ruleId(signal), priority: 40, enabledParameter: active,
    source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' },
    conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
    actions: [{
      id: actionId(signal), target: target(property), operation: 'envelope', value: 1,
      envelope: { attack: 0.015, hold, release, unit: 'seconds' }, retrigger: 'restart',
    }, ...(signal === 'drop' ? [{
      id: actionId('drop-bloom'), target: { kind: 'effect' as const, ref: cinema2Ref(bloom), property: 'intensity' },
      operation: 'envelope' as const, composition: 'add' as const, value: 0.26,
      envelope: { attack: 0.04, hold: 0.12, release: 0.85, unit: 'seconds' as const }, retrigger: 'restart' as const,
    }] : [])],
  }
}

const render = template.render!
const scene = template.scene!
const scenePass = render.passes.find(pass => pass.kind === 'scene')!
const floorPass = render.passes.find(pass => pass.effect?.$ref === 'livewire-focus-effect')!
const floorInputs = floorPass.inputs!.map(input => input.attachment === 'color'
  ? { ...input, source: { pass: cinema2Ref(scenePass.id), output: scenePass.outputs!.find(output => output.attachment === 'color')!.id } }
  : input)

const manifest: Cinema2NativePresetManifest = {
  ...template,
  id: CINEMA2_LIVEWIRE_PRESET_ID,
  revision: 1,
  metadata: { name: 'LIVEWIRE', description: 'Type a machined 3D wordmark with individually lit LED bars above a dark reflective stage.', tags: ['3d', 'typography', 'led', 'reflective-floor'] },
  capabilities: [
    ...template.capabilities!.filter(capability => capability.id !== 'render.history'),
    { id: 'audio.features', requirement: 'optional', purpose: 'Energy spreads the illuminated regions and vocals soften the sweep.' },
    { id: 'audio.bands', requirement: 'optional', purpose: 'Bass expands coverage and highs accent nearby segments.' },
    { id: 'music.section', requirement: 'optional', purpose: 'Shared section context selects the low reveal and release camera shots.' },
  ],
  parameters: [
    ...template.parameters!.filter(parameter => !removed.has(parameter.id)).map(parameter => ({ ...parameter, ...overrides[parameter.id.replace('livewire-', '')] }) as Cinema2ParameterManifest),
    { id: id('camera-motion'), label: 'Camera Motion', type: 'boolean', defaultValue: true,
      section: 'Design', designParentGroup: 'design', group: 'Camera', order: 20, exposure: 'primary', persistence: 'preset', reset: 'authored-default',
      description: 'Enable the bounded camera drift and musical shots.', modulatable: false, choreographable: false },
    { ...slider('camera-amount', 'Camera Amount', 'design', 0.85, 0, 1, 21, 'Scales camera travel and musical shots; zero locks the camera.'), group: 'Camera', modulatable: false, choreographable: false },
    { ...template.parameters!.find(parameter => parameter.id === id('motion-safety'))!,
      designParentGroup: 'design', group: 'Camera', order: 22,
      description: 'Full allows bounded camera travel; Reduced limits it; Lock Off holds the framing.' },
    slider('coverage', 'LED Coverage', 'design', 0.45, 0.08, 1, 25, 'How many bars of the selected pattern can light at once.'),
    slider('intensity', 'LED Intensity', 'design', 1, 0, 1.6, 26, 'Emissive output of the inset bars.'),
    slider('floor-reflection', 'Floor Reflection', 'effects', 0.89, 0, 1, 1, 'Strength of the reflected letters on the floor.'),
    slider('floor-roughness', 'Floor Roughness', 'effects', 0.22, 0, 1, 2, 'Diffusion and texture of reflected highlights.'),
    { id: id('floor-tint'), label: 'Floor Tint', type: 'color', defaultValue: floorTint, section: 'Design',
      designParentGroup: 'palette', group: 'Color', order: 4, exposure: 'primary', persistence: 'preset', reset: 'authored-default' },
  ],
  modules: [{
    ...sourceModule, typeId: CINEMA2_LIVEWIRE_MODULE_TYPE_ID,
    parameters: {
      ...sourceModule.parameters, line1Text: 'LIVEWIRE', lineMode: 'one', pattern: 'trace',
      highlightSweep: 0, environmentIntensity: 0.14, autoPerformance: false,
      coverage: 0.45, intensity: 1, energy: 0, bass: 0, highs: 0, vocal: 0,
    },
    parameterBindings: { ...bindings, coverage: ref('coverage'), intensity: ref('intensity'), autoPerformance: active },
  }],
  scene: {
    ...scene,
    nodes: scene.nodes.map(node => node.id === 'livewire-focus'
      ? { ...node, transform: { position: [0, -0.50, 0] } }
      : node),
  },
  cameras: template.cameras!.map(camera => ({
    ...camera,
    // The production shared camera receives the exact live text bounds as its
    // composition constraint. Retain a safe fallback aim for manifest-only use.
    targetNode: undefined, target: [0, -0.50, 0],
    transform: { position: [0, 0.19, 6.9] }, fovDegrees: 35.5, minAspect: 1.6,
    // Static rigs support beat-synced weave, but flight-speed scaling requires a path or fly rig.
    motion: { tempo: { referenceBpm: 120, weave: 0.38, bob: 0, flightSpeed: false },
      drift: { position: 0.24, target: 0, rollDegrees: 0, fovDegrees: 0, speed: 0.10, seed: 718 },
      fovRateLimitDegreesPerSecond: 5 },
    controls: { motionEnabled: ref('camera-motion'), masterMotionAmount: ref('camera-amount'),
      motionSafety: ref('motion-safety'), tempoSync: ref('bpm-sync') },
    smoothingMs: 420,
    safety: { ...camera.safety, minPosition: [-0.82, -0.25, 6.35], maxPosition: [0.82, 0.79, 7.8],
      maxPositionOffset: [0.82, 0.6, 0.9], maxTargetOffset: [0.24, 2, 0], minFovDegrees: 35.4, maxFovDegrees: 35.6 },
  })),
  lighting: { ...template.lighting, lights: template.lighting!.lights.map(light => {
    if (light.type === 'ambient') return { ...light, intensity: 0.028 }
    if (light.id === 'livewire-key') return {
      ...light, intensity: 1.35, color: [0.64, 0.89, 0.94, 1],
      transform: { position: [-3.4, 2.3, 1.9] }, config: { ...light.config, coneAngleDegrees: 36, penumbra: 0.88, range: 10 },
    }
    return {
      ...light, intensity: 1.6, color: [0.5, 0.8, 0.87, 1],
      transform: { position: [4.3, 1.15, -0.5] }, config: { ...light.config, coneAngleDegrees: 35, penumbra: 0.7, range: 10 },
    }
  }) },
  environment: { ...template.environment, backgroundColor: background },
  choreography: {
    tempoSyncParameter: ref('bpm-sync'),
    rules: [
      continuous('energy', 'audio.features.overallEnergy', 'audio.features', 160),
      continuous('vocal', 'audio.features.vocalPresence', 'audio.features', 220),
      continuous('bass', 'audio.bands.bass', 'audio.bands', 95),
      continuous('highs', 'audio.bands.high', 'audio.bands', 90),
      continuous('buildAmount', 'director.build', 'visual-director.significance', 120),
      accent('kick', 'ledKick', 0.035, 0.24), accent('snare', 'ledSnare', 0.04, 0.21),
      accent('transient', 'ledTransient', 0.015, 0.16), accent('drop', 'dropAccent', 0.13, 1.22),
      sectionShot('camera-intro', ['intro'], [-0.28, -0.46, 0.32]),
      sectionShot('camera-release', ['breakdown', 'outro'], [0.23, 0.30, 0.72]),
      { id: ruleId('camera-build'), priority: 120, enabledParameter: active,
        source: { signal: 'continuous', path: 'director.build', capability: 'visual-director.significance', smoothingMs: 260, clamp: [0, 1] },
        conditions: [{ kind: 'not-silent' }],
        actions: [{ id: actionId('camera-build'), target: cameraPosition, operation: 'add', value: [0, 0.12, -0.38] }] },
      { id: ruleId('camera-drop'), priority: 130, enabledParameter: active,
        source: { signal: 'drop', capability: 'music.drop' }, conditions: [{ kind: 'once-per-event' }],
        actions: [{ id: actionId('camera-drop'), target: cameraPosition, operation: 'envelope', composition: 'add',
          value: [0.22, -0.18, -0.70], envelope: { attack: 0.18, hold: 0.40, release: 1.8, unit: 'seconds' }, retrigger: 'restart' }] },
    ],
  },
  effects: [
    {
      id: floor, typeId: CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output',
      parameters: {
        mix: 1, floorY: LIVEWIRE_FLOOR_Y, reflectivity: 0.89, roughness: 0.22, fresnel: 1.33,
        baseLift: 0.92, albedo: 0.027, specular: 0.35, thickness: 2.3, maxReflection: 30, fadeDistance: 22,
        grit: 0.20, gritScale: 1.05, streak: 0.57, samplingStability: 1,
        surfaceTexture: CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID, surfaceTextureScale: 2.25, surfaceTextureStrength: 0.19,
        baseColor: floorTint, skyColor: background,
      },
      parameterBindings: { reflectivity: ref('floor-reflection'), roughness: ref('floor-roughness'), baseColor: ref('floor-tint'), skyColor: ref('background') },
    },
    ...template.effects!.filter(effect => effect.id === bloom || effect.id === 'livewire-finish-effect').map(effect => ({
      ...effect,
      parameters: effect.id === bloom
        ? { ...effect.parameters, threshold: 1.45, spread: 0.33, intensity: 0.39 }
        : { ...effect.parameters, grain: 0, aberration: 0, contrast: 1.06 },
    })),
  ],
  render: {
    ...render,
    targets: render.targets?.filter(target => target.id !== 'livewire-trails-target'),
    passes: render.passes.filter(pass => pass.effect?.$ref !== 'livewire-trails-effect').map(pass => pass.id === floorPass.id
      ? { ...pass, effect: cinema2Ref(floor), dependsOn: [cinema2Ref(scenePass.id)], inputs: floorInputs }
      : pass),
  },
}

export const CINEMA2_LIVEWIRE_PRESET_MANIFEST = withCinema2MoodDrives(manifest, {
  idPrefix: 'livewire-auto',
  enabledParameter: id('auto-performance'),
  strengthParameter: id('motion'),
  patternControls: { patternChange: id('pattern-change'), trigger: id('trigger') },
  drives: [
    { id: 'coverage-activity', target: cinema2AutoTargets.module(sourceModule.id, 'coverage'), source: 'mood.activity', operation: 'add', value: 0.22 },
    { id: 'coverage-silence', target: cinema2AutoTargets.module(sourceModule.id, 'coverage'), source: 'mood.silence', operation: 'add', value: -0.4 },
    { id: 'sweep-activity', target: cinema2AutoTargets.module(sourceModule.id, 'cycleSeconds'), source: 'mood.activity', operation: 'add', value: -1.5 },
    { id: 'bloom-peak', target: cinema2AutoTargets.effect(bloom, 'intensity'), source: 'mood.peak', operation: 'add', value: 0.26 },
    { id: 'bloom-silence', target: cinema2AutoTargets.effect(bloom, 'intensity'), source: 'mood.silence', operation: 'add', value: -0.25 },
  ],
})
