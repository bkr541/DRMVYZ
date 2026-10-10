import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Cinema2ModuleManifest } from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_BACKSTREET_MAX_SCALE,
  CINEMA2_BACKSTREET_MIN_SCALE,
  CINEMA2_BACKSTREET_NATIVE_MODULE_TYPE_ID,
  CINEMA2_BACKSTREET_PARTS,
  adaptCinema2BackstreetLighting,
  cinema2BackstreetNativeModuleDefinition,
  resolveCinema2BackstreetScale,
  resolveCinema2BackstreetStaticFrame,
  resolveCinema2BackstreetSweepRegions,
} from '../modules/Cinema2BackstreetNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_MAINFRAME_ZERO_IMPULSES, CINEMA2_MAINFRAME_ZERO_SIGNALS } from '../modules/mainframe/Cinema2MainframeReactivity'
import { evaluateCinema2MainframePattern, type Cinema2MainframePatternId } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { CINEMA2_BACKSTREET_ASSET_ID, cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import {
  CINEMA2_BACKSTREET_BPM_SYNC_ID,
  CINEMA2_BACKSTREET_IDLE_GLOW_ID,
  CINEMA2_BACKSTREET_MASTER_INTENSITY_ID,
  CINEMA2_BACKSTREET_MUSICAL_CUE_ID,
  CINEMA2_BACKSTREET_PATTERN_CHANGE_ID,
  CINEMA2_BACKSTREET_PATTERN_ID,
  CINEMA2_BACKSTREET_PATTERN_LABELS,
  CINEMA2_BACKSTREET_PRESET_ID,
  CINEMA2_BACKSTREET_PRESET_MANIFEST,
  CINEMA2_BACKSTREET_SCALE_ID,
  CINEMA2_BACKSTREET_TRIGGER_ID,
  CINEMA2_BACKSTREET_TUBE_COLOR_ID,
} from '../presets/Cinema2BackstreetPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting',
  'audio.bands', 'audio.features', 'music.beat', 'music.downbeat', 'music.bar', 'music.rhythm-events',
  'music.phrase', 'music.section', 'music.drop', 'music.build', 'visual-director.significance',
] as const
const manifest = CINEMA2_BACKSTREET_PRESET_MANIFEST
const module = manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>
const parameters = manifest.parameters ?? []
const ref = (id: string) => ({ $ref: id })

function reader(values: Record<string, unknown>) {
  return { get: (name: string) => values[name], getAuthored: (name: string) => values[name], resolve: () => null } as never
}

function compileBackstreet() {
  const result = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
  expect(result.ok, result.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  if (!result.ok) throw new Error('Expected Backstreet to compile')
  return result.plan
}

/** A loud, playing frame of the given program, produced by the same engine function Mainframe uses. */
function frameOf(pattern: Cinema2MainframePatternId, beats: number, overrides: { overall?: number } = {}) {
  return evaluateCinema2MainframePattern({
    pattern,
    beats,
    signals: { ...CINEMA2_MAINFRAME_ZERO_SIGNALS, overall: overrides.overall ?? 0.1, bass: 0.1 },
    impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES,
    active: true,
  })
}

describe('Backstreet preset', () => {
  it('is a visible first-party keeper and passes the authoring and compiler gates', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(entry => entry.manifest.id === CINEMA2_BACKSTREET_PRESET_ID)?.role).toBe('keeper')
    expect(manifest.metadata).toMatchObject({ name: 'Backstreet' })
    expect(manifest.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toEqual({ ok: true, diagnostics: [] })
    expect(compileBackstreet().render.passes.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen'])
    expect(cinema2NativePresetRegistry.get(CINEMA2_BACKSTREET_PRESET_ID)).not.toBeNull()
  })

  it('registers its renderer and ships its model with the circuit attributes the Mainframe shader reads', () => {
    expect(module.typeId).toBe(CINEMA2_BACKSTREET_NATIVE_MODULE_TYPE_ID)
    expect(module.config).toMatchObject({ asset: CINEMA2_BACKSTREET_ASSET_ID })
    expect(cinema2ThreeAssetRegistry.has(CINEMA2_BACKSTREET_ASSET_ID)).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_BACKSTREET_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(cinema2BackstreetNativeModuleDefinition.validate?.(module)).toEqual([])
    expect(cinema2BackstreetNativeModuleDefinition.validate?.({ ...module, config: { asset: 'missing' } })).toHaveLength(1)

    const bytes = readFileSync(resolve(process.cwd(), 'public/cinema2/models/backstreet.glb'))
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) as {
      nodes: { name: string }[]
      meshes: { primitives: { attributes: Record<string, number> }[] }[]
      accessors: { count: number; type: string }[]
    }
    expect(json.nodes.map(node => node.name).sort()).toEqual([...CINEMA2_BACKSTREET_PARTS].sort())
    const tubes = json.meshes[json.nodes.findIndex(node => node.name === 'tubeCores')]!.primitives[0]!.attributes
    const vertexCount = json.accessors[tubes.POSITION]!.count
    for (const name of ['_GLOW_PHASE', '_MAINFRAME_ROUTE', '_MAINFRAME_BANK', '_MAINFRAME_REGION', '_MAINFRAME_SYSTEM']) {
      expect(json.accessors[tubes[name]!], name).toMatchObject({ count: vertexCount, type: 'SCALAR' })
    }
  })

  it('offers the Mainframe controls under the same four Inspector groups, with Trigger revealed by Pattern Change', () => {
    const visible = parameters.filter(parameter => parameter.exposure === 'primary' && parameter.section === 'Design')
    const inGroup = (group: string) => visible
      .filter(parameter => parameter.designParentGroup === group)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(parameter => parameter.label)
    expect(inGroup('master-controls')).toEqual(['Master Intensity', 'BPM Sync'])
    expect(inGroup('design')).toEqual(['Scale'])
    expect(inGroup('effects')).toEqual(['Pattern', 'Pattern Change', 'Trigger', 'Idle Glow'])
    expect(inGroup('palette')).toEqual(['Tube Color'])
    expect(parameters.find(parameter => parameter.id === CINEMA2_BACKSTREET_TUBE_COLOR_ID)).toMatchObject({ type: 'color', defaultValue: [1, 1, 1, 1] })
    expect(parameters.find(parameter => parameter.id === CINEMA2_BACKSTREET_PATTERN_ID)).toMatchObject({ type: 'enum', defaultValue: 'outward-bus' })
    expect(parameters.find(parameter => parameter.id === CINEMA2_BACKSTREET_TRIGGER_ID)).toMatchObject({
      type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_BACKSTREET_PATTERN_CHANGE_ID, value: true }],
    })
    expect(Object.values(CINEMA2_BACKSTREET_PATTERN_LABELS)).toEqual(['Center Out', 'Edges In', 'Marquee', 'Quadrant Relay', 'Radar Sweep', 'Surge'])

    const plan = compileBackstreet()
    const state = new Cinema2ParameterState(plan.parameters)
    const effectLabels = () => {
      const effects = createCinema2DesignParentGroupModel(plan, state.getSnapshot()).find(parent => parent.label === 'Effects')
      return [
        ...(effects?.controls.map(control => control.definition.label) ?? []),
        ...(effects?.groups.flatMap(group => group.controls.map(control => control.definition.label)) ?? []),
      ]
    }
    expect(effectLabels()).toEqual(['Pattern', 'Pattern Change', 'Idle Glow'])
    expect(state.setPersistentValue(CINEMA2_BACKSTREET_PATTERN_CHANGE_ID, true)).toMatchObject({ ok: true })
    expect(effectLabels()).toEqual(['Pattern', 'Pattern Change', 'Trigger', 'Idle Glow'])
  })

  it('binds every control to the module and routes the same nine musical cues Mainframe does', () => {
    expect(module.parameterBindings).toEqual({
      masterIntensity: ref(CINEMA2_BACKSTREET_MASTER_INTENSITY_ID),
      bpmSync: ref(CINEMA2_BACKSTREET_BPM_SYNC_ID),
      pattern: ref(CINEMA2_BACKSTREET_PATTERN_ID),
      patternChange: ref(CINEMA2_BACKSTREET_PATTERN_CHANGE_ID),
      trigger: ref(CINEMA2_BACKSTREET_TRIGGER_ID),
      scale: ref(CINEMA2_BACKSTREET_SCALE_ID),
      idleGlow: ref(CINEMA2_BACKSTREET_IDLE_GLOW_ID),
      tubeColor: ref(CINEMA2_BACKSTREET_TUBE_COLOR_ID),
    })
    expect(module.actionBindings).toEqual({ musicalCue: ref(CINEMA2_BACKSTREET_MUSICAL_CUE_ID) })
    const cueRules = (manifest.choreography?.rules ?? []).filter(rule => rule.actions.some(action => action.operation === 'spawn'))
    expect(cueRules.map(rule => (rule.actions[0]!.value as { kind: string }).kind)).toEqual([
      'kick', 'snare', 'transient', 'beat', 'downbeat', 'fourBeat', 'phrase', 'section', 'drop',
    ])
  })

  it('lights the wall from points along the sign that swell on the kick and the downbeat and lift through a build', () => {
    const lights = manifest.lighting?.lights ?? []
    expect(lights.filter(light => light.type === 'point')).toHaveLength(9)
    expect(lights.filter(light => light.type === 'spot')).toHaveLength(1)
    const group = manifest.lighting?.groups?.[0]
    expect(group?.lights).toHaveLength(9)
    const plan = compileBackstreet()
    const driven = new Set(plan.manifest.choreography?.rules.flatMap(rule => rule.actions.map(action => (action.target as { kind: string }).kind)))
    expect(driven.has('light')).toBe(true)
  })

  it('persists and restores the pattern controls and resets each to its authored default', () => {
    const plan = compileBackstreet()
    const state = new Cinema2ParameterState(plan.parameters)
    expect(state.setPersistentValue(CINEMA2_BACKSTREET_PATTERN_ID, 'radar-sweep')).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_BACKSTREET_TUBE_COLOR_ID, [1, 0, 0.5, 1])).toMatchObject({ ok: true })
    const restored = new Cinema2ParameterState(plan.parameters)
    expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_BACKSTREET_PATTERN_ID)).toBe('radar-sweep')
    expect(restored.getValue(CINEMA2_BACKSTREET_TUBE_COLOR_ID)).toEqual([1, 0, 0.5, 1])
    expect(restored.reset(CINEMA2_BACKSTREET_PATTERN_ID)).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_BACKSTREET_PATTERN_ID)).toBe('outward-bus')
  })
})

describe('Backstreet module', () => {
  it('reads its controls, and shows the unlit glass at zero Master Intensity and white neon at full', () => {
    const frame = resolveCinema2BackstreetStaticFrame(reader({ pattern: 'marquee-nope', trigger: 'nope', scale: 9, idleGlow: -1 }))
    expect(frame).toMatchObject({ pattern: 'outward-bus', trigger: 'bar4', scale: CINEMA2_BACKSTREET_MAX_SCALE, idleGlow: 0, intensity: 1 })
    const dark = resolveCinema2BackstreetStaticFrame(reader({ masterIntensity: 0 }))
    expect(dark.overrides.parts.tubeCores?.emissiveIntensity).toBe(0)
    const lit = resolveCinema2BackstreetStaticFrame(reader({ masterIntensity: 1, tubeColor: [1, 0, 0, 1] }))
    expect(lit.overrides.parts.tubeCores?.emissive).toEqual([1, 0, 0])
    expect(lit.overrides.parts.tubeCores?.emissiveIntensity).toBeGreaterThan(1)
    expect(resolveCinema2BackstreetStaticFrame(reader({})).tubeColor).toEqual([1, 1, 1])
  })

  it('zooms the sign out on a narrow Stage and never in past the authored framing', () => {
    expect(resolveCinema2BackstreetScale(1920, 1080)).toBeCloseTo(1)
    expect(resolveCinema2BackstreetScale(2560, 1080)).toBeCloseTo(1)
    expect(resolveCinema2BackstreetScale(1080, 1080)).toBeCloseTo(9 / 16)
    expect(resolveCinema2BackstreetScale(1920, 1080, 0.1)).toBeCloseTo(CINEMA2_BACKSTREET_MIN_SCALE)
    expect(resolveCinema2BackstreetScale(0, 0)).toBeCloseTo(1)
  })

  it('keeps the sign visibly lit under every program with Idle Glow up, and lets a program switch it down with Idle Glow at 0', () => {
    for (const pattern of ['outward-bus', 'inward-boot', 'bank-alternator', 'quadrant-relay', 'radar-sweep', 'system-surge'] as const) {
      const quiet = frameOf(pattern, 3.2)
      const held = adaptCinema2BackstreetLighting(quiet, 0.8)
      expect(held.circuitEnergy, pattern).toBeGreaterThanOrEqual(0.7)
      expect(Math.min(...held.bankWeights), pattern).toBeGreaterThanOrEqual(0.4)
      expect(Math.min(...held.regionWeights), pattern).toBeGreaterThanOrEqual(0.4)
      const off = adaptCinema2BackstreetLighting(quiet, 0)
      expect(off.circuitEnergy).toBe(quiet.circuitEnergy)
      expect(off.bankWeights).toEqual(quiet.bankWeights)
    }
    // A loud passage is never turned down.
    const loud = frameOf('outward-bus', 3.2, { overall: 1 })
    expect(adaptCinema2BackstreetLighting(loud, 0.3).circuitEnergy).toBeGreaterThanOrEqual(loud.circuitEnergy)
  })

  it('passes a frame with nothing playing through untouched', () => {
    const inactive = evaluateCinema2MainframePattern({
      pattern: 'bank-alternator', beats: 1, signals: CINEMA2_MAINFRAME_ZERO_SIGNALS, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES, active: false,
    })
    expect(adaptCinema2BackstreetLighting(inactive, 1)).toBe(inactive)
  })

  it('turns Radar Sweep into a beam that goes once round the sign every four beats, clockwise from the bottom', () => {
    const peak = (beats: number) => {
      const weights = resolveCinema2BackstreetSweepRegions(beats)
      return weights.indexOf(Math.max(...weights))
    }
    // Region numbering: bottom 0, bottom-left 1, left 2, top-left 3, top 7, top-right 6, right 5, bottom-right 4.
    expect([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map(peak)).toEqual([0, 1, 2, 3, 7, 6, 5, 4])
    expect(peak(4)).toBe(peak(0))
    expect(Math.max(...resolveCinema2BackstreetSweepRegions(0.25))).toBeLessThanOrEqual(1)
    expect(resolveCinema2BackstreetSweepRegions(Number.NaN)).toHaveLength(8)

    const adapted = adaptCinema2BackstreetLighting(frameOf('radar-sweep', 2), 0)
    // The shader reads the relay's region selection; every other program keeps its own id.
    expect(adapted.pattern).toBe('quadrant-relay')
    expect(adapted.regionWeights).toEqual(resolveCinema2BackstreetSweepRegions(2))
    expect(adaptCinema2BackstreetLighting(frameOf('quadrant-relay', 2), 0).pattern).toBe('quadrant-relay')
    expect(adaptCinema2BackstreetLighting(frameOf('bank-alternator', 2), 0).pattern).toBe('bank-alternator')
  })
})
