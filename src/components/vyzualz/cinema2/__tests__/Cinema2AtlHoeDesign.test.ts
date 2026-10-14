import { describe, expect, it } from 'vitest'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import atlHoeParts from '../presets/atlHoeParts.json'
import {
  CINEMA2_ATL_HOE_PARAMETER_IDS as IDS,
  CINEMA2_ATL_HOE_SIGN_PATTERNS,
} from '../presets/Cinema2AtlHoeDesign'
import { CINEMA2_ATL_HOE_TRIGGER_IDS } from '../modules/atlHoe/Cinema2AtlHoePatternController'
import { CINEMA2_ATL_HOE_PRESET_MANIFEST as manifest } from '../presets/Cinema2AtlHoePreset'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'

const parameters = new Map((manifest.parameters ?? []).map(parameter => [parameter.id as string, parameter]))
const rules = manifest.choreography?.rules ?? []
const module = manifest.modules?.[0]
const bindings = module?.parameterBindings ?? {}
const targetsOf = (ruleId: string) => (rules.find(rule => rule.id === ruleId)?.actions ?? [])
  .map(action => (action.target.kind === 'module' ? action.target.property : action.target.kind))

describe('ATL HOE Design tab', () => {
  it('declares the requested master controls with the agreed defaults', () => {
    expect(parameters.get(IDS.autoPerformance)).toMatchObject({ label: 'Auto Performance', type: 'boolean', defaultValue: true, designParentGroup: 'master-controls' })
    expect(parameters.get(IDS.masterIntensity)).toMatchObject({ label: 'Master Intensity', defaultValue: 1, designParentGroup: 'master-controls' })
    expect(parameters.get(IDS.bpmSync)).toMatchObject({ label: 'BPM Sync', type: 'boolean', defaultValue: true })
    expect(parameters.get(IDS.cameraMovement)).toMatchObject({ label: 'Camera Movement', defaultValue: 0.32, min: 0, max: 1 })
    expect(parameters.get(IDS.cameraImpacts)).toMatchObject({ label: 'Camera Impacts', type: 'boolean', defaultValue: true })
    expect(parameters.get(IDS.musicReactivity)).toMatchObject({ label: 'Music Reactivity', defaultValue: 0.8 })
    expect(parameters.get(IDS.kickReaction)).toMatchObject({ label: 'Kick Reactivity', defaultValue: 0.72 })
    expect(parameters.get(IDS.transientReaction)).toMatchObject({ label: 'Transient Reaction', defaultValue: 0.58 })
    expect(parameters.get(IDS.dropReaction)).toMatchObject({ label: 'Drop Reaction', defaultValue: 0.92 })
  })

  it('offers exactly six full-scene programs, Flicker and City Atmosphere', () => {
    const pattern = parameters.get(IDS.signPattern)
    expect(pattern).toMatchObject({ label: 'Pattern', type: 'enum', defaultValue: 'city-pulse', designParentGroup: 'design' })
    expect((pattern as { options: readonly { value: string }[] }).options.map(option => option.value)).toEqual([...CINEMA2_ATL_HOE_SIGN_PATTERNS])
    expect(CINEMA2_ATL_HOE_SIGN_PATTERNS).toHaveLength(6)
    expect((pattern?.metadata as { userEditSetParameters?: Record<string, boolean> }).userEditSetParameters).toEqual({ [IDS.autoPerformance]: false })
    expect(parameters.get(IDS.patternChange)).toMatchObject({ label: 'Pattern Change', type: 'boolean', defaultValue: false })
    const trigger = parameters.get(IDS.trigger)
    expect((trigger as { options: readonly { value: string }[] }).options.map(option => option.value)).toEqual([...CINEMA2_ATL_HOE_TRIGGER_IDS])
    expect(trigger?.visibleWhen).toEqual([{ kind: 'parameter-equals', parameterId: IDS.patternChange, value: true }])
    expect(parameters.get(IDS.flicker)).toMatchObject({ label: 'Flicker', defaultValue: 0, designParentGroup: 'effects' })
    expect(parameters.get(IDS.cityAtmosphere)).toMatchObject({ label: 'City Atmosphere', defaultValue: 0.5, designParentGroup: 'effects' })
  })

  it('binds the palette: sign faces, letters and every architecture part, but never the beacons', () => {
    expect(parameters.get(IDS.signColor)).toMatchObject({ label: 'Sign Color', designParentGroup: 'palette' })
    expect(parameters.get(IDS.letterColor)).toMatchObject({ label: 'Letter Color', designParentGroup: 'palette' })
    expect(parameters.get(IDS.architectureColor)).toMatchObject({ label: 'Architecture Color', designParentGroup: 'palette' })
    for (const part of atlHoeParts.signFaces) expect(bindings[`${part}.emissive`]?.$ref).toBe(IDS.signColor)
    expect(bindings['signLetters.color']?.$ref).toBe(IDS.letterColor)
    for (const part of [...atlHoeParts.windows, 'cyanWindows', 'truistWindows', 'spireBoa', 'spireWestinMast', ...atlHoeParts.lampOrbs, ...atlHoeParts.lampHalos]) {
      expect(bindings[`${part}.emissive`], part).toBeDefined()
    }
    expect(Object.keys(bindings).some(key => key.startsWith('beacon'))).toBe(false)
  })

  it('keeps the authored mixed colours until Architecture Color is edited, which then overrides every group', () => {
    const mirrored = (parameters.get(IDS.architectureColor)?.metadata as { mirrorParameters?: string[] } | undefined)?.mirrorParameters ?? []
    expect(mirrored.length).toBe(9)
    const cyan = parameters.get('atl-hoe-architecture-cyan')
    expect(mirrored).toContain('atl-hoe-architecture-cyan')
    expect(cyan).toMatchObject({ exposure: 'hidden', defaultValue: [0.1, 0.9, 0.85, 1] })
    expect(bindings['cyanWindows.emissive']?.$ref).toBe('atl-hoe-architecture-cyan')
    expect((parameters.get(IDS.signColor)?.metadata as { mirrorParameters?: string[] }).mirrorParameters).toEqual([IDS.signBaseColor])
  })

  it('scales every lit part with Master Intensity through a multiplier that is exactly 1 at the default', () => {
    const master = rules.find(rule => rule.id === 'atl-hoe-master')
    expect(master?.source).toMatchObject({ signal: 'parameter', offset: -1 })
    const properties = targetsOf('atl-hoe-master')
    for (const part of [...atlHoeParts.signFaces, ...atlHoeParts.windows, ...atlHoeParts.lampOrbs, ...atlHoeParts.spires]) {
      expect(properties, part).toContain(`${part}.emissiveIntensity`)
    }
    expect(properties).not.toContain('beacon.emissiveIntensity')
  })

  it('moves persistent program timing out of generic choreography and binds the six-program planner to the module', () => {
    expect(rules.some(rule => (rule.enabledWhen ?? []).some(condition => condition.kind === 'parameter-equals' && condition.parameterId === IDS.signPattern))).toBe(false)
    expect(rules.some(rule => ['atl-hoe-marquee-chase', 'atl-hoe-cascade-wave', 'atl-hoe-fault-transient', 'atl-hoe-drop'].includes(rule.id))).toBe(false)
    expect(bindings.atlHoePattern?.$ref).toBe(IDS.signPattern)
    expect(bindings.atlHoeBpmSync?.$ref).toBe(IDS.bpmSync)
    expect(bindings.atlHoeAutoPerformance?.$ref).toBe(IDS.autoPerformance)
    expect(bindings.atlHoePatternChange?.$ref).toBe(IDS.patternChange)
    expect(bindings.atlHoeTrigger?.$ref).toBe(IDS.trigger)
  })

  it('routes music controls to the program engine while retaining the independent Flicker gate', () => {
    const strengthOf = (ruleId: string) => rules.find(rule => rule.id === ruleId)?.strengthParameter?.$ref
    expect(bindings.atlHoeMusicReactivity?.$ref).toBe(IDS.musicReactivity)
    expect(bindings.atlHoeKickReaction?.$ref).toBe(IDS.kickReaction)
    expect(bindings.atlHoeTransientReaction?.$ref).toBe(IDS.transientReaction)
    expect(bindings.atlHoeDropReaction?.$ref).toBe(IDS.dropReaction)
    expect(strengthOf('atl-hoe-energy')).toBe(IDS.musicReactivity)
    expect(strengthOf('atl-hoe-flicker')).toBe(IDS.flicker)
    expect(rules.find(rule => rule.id === 'atl-hoe-flicker')?.actions.every(action => action.gate != null)).toBe(true)
  })

  it('integrates the twelve lightning bolts into the full-scene program engine instead of exposing a disconnected sky mode', () => {
    expect(atlHoeParts.bolts).toHaveLength(12)
    expect([...parameters.values()].some(parameter => parameter.label === 'Sky Pattern' || parameter.label === 'Sky Pattern Type')).toBe(false)
    expect(rules.some(rule => rule.id.startsWith('atl-hoe-storm-') || rule.id.startsWith('atl-hoe-stars-'))).toBe(false)
  })

  it('drives restrained camera parallax by default, with independent BPM and impact controls', () => {
    const camera = manifest.cameras?.[0]
    expect(camera?.controls?.motionAmount?.$ref).toBe(IDS.cameraMovement)
    expect(camera?.controls?.tempoSync?.$ref).toBe(IDS.bpmSync)
    expect(camera?.controls?.kickZoom?.$ref).toBe(IDS.cameraImpacts)
    expect(camera?.motion).toBeDefined()
    expect(camera?.safety?.maxPositionOffset).toEqual([0.7, 0.48, 0.75])
  })

  it('keeps a 30-second default camera path inside the authored safe envelope at Stage and 16:9 aspects', () => {
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    for (const [width, height] of [[900, 1200], [1920, 1080]] as const) {
      const state = new Cinema2ParameterState(compiled.plan.parameters)
      const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
        resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
      })
      const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
      const runtime = new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial)
      const xs: number[] = []
      for (let step = 0; step <= 30 * 30; step += 1) {
        const timeSec = step / 30
        const view = runtime.update({ frameId: step + 1, timestampMs: timeSec * 1_000, deltaTimeSec: step ? 1 / 30 : 0, elapsedTimeSec: timeSec,
          viewport: { width, height, dpr: 1 }, contextGeneration: 1, audio: null, director: null } as never)
        xs.push(view.position[0])
        expect(view.position[0]).toBeGreaterThanOrEqual(-0.85)
        expect(view.position[0]).toBeLessThanOrEqual(0.85)
        expect(view.position[1]).toBeGreaterThanOrEqual(5.2)
        expect(view.position[1]).toBeLessThanOrEqual(6.55)
        expect(view.position[2]).toBeGreaterThanOrEqual(19.1)
        expect(view.position[2]).toBeLessThanOrEqual(20.9)
      }
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.04)
    }
    expect(manifest.cameras?.[0]?.minAspect).toBe(16 / 9)
  })

  it('moves the haze with City Atmosphere without changing it at the default', () => {
    const atmosphere = rules.find(rule => rule.id === 'atl-hoe-atmosphere')
    expect(atmosphere?.source).toMatchObject({ signal: 'parameter', offset: -0.5 })
    expect(atmosphere?.actions.map(action => (action.target.kind === 'effect' || action.target.kind === 'environment') ? action.target.property : '')).toEqual(['mistAmount', 'density', 'fog.density'])
  })

  it('lays the Design tab out as Master Controls, Design, Effects and Palette, revealing Trigger only for Pattern Change', () => {
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const labels = () => Object.fromEntries(createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).map(parent => [
      parent.id,
      [...parent.controls.map(control => control.definition.label), ...parent.groups.flatMap(group => group.controls.map(control => control.definition.label))],
    ]))

    expect(labels()).toEqual({
      'master-controls': ['Auto Performance', 'Master Intensity', 'BPM Sync', 'Camera Movement', 'Music Reactivity', 'Camera Impacts', 'Kick Reactivity', 'Transient Reaction', 'Drop Reaction'],
      design: ['Pattern', 'Pattern Change'],
      effects: ['Flicker', 'City Atmosphere'],
      palette: ['Sign Color', 'Letter Color', 'Architecture Color'],
    })
    expect(state.setPersistentValue(IDS.patternChange, true)).toMatchObject({ ok: true })
    expect(labels().design).toEqual(['Pattern', 'Pattern Change', 'Trigger'])
  })
})
