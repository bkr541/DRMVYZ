import { describe, expect, it } from 'vitest'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import atlHoeParts from '../presets/atlHoeParts.json'
import {
  CINEMA2_ATL_HOE_PARAMETER_IDS as IDS,
  CINEMA2_ATL_HOE_SIGN_PATTERNS,
  CINEMA2_ATL_HOE_SKY_PATTERNS,
} from '../presets/Cinema2AtlHoeDesign'
import { CINEMA2_ATL_HOE_PRESET_MANIFEST as manifest } from '../presets/Cinema2AtlHoePreset'

const parameters = new Map((manifest.parameters ?? []).map(parameter => [parameter.id as string, parameter]))
const rules = manifest.choreography?.rules ?? []
const module = manifest.modules?.[0]
const bindings = module?.parameterBindings ?? {}
const targetsOf = (ruleId: string) => (rules.find(rule => rule.id === ruleId)?.actions ?? [])
  .map(action => (action.target.kind === 'module' ? action.target.property : action.target.kind))

describe('ATL HOE Design tab', () => {
  it('declares the requested master controls with the agreed defaults', () => {
    expect(parameters.get(IDS.masterIntensity)).toMatchObject({ label: 'Master Intensity', defaultValue: 1, designParentGroup: 'master-controls' })
    expect(parameters.get(IDS.bpmSync)).toMatchObject({ label: 'BPM Sync', type: 'boolean', defaultValue: true })
    expect(parameters.get(IDS.cameraMovement)).toMatchObject({ label: 'Camera Movement', defaultValue: 0, min: 0, max: 1 })
    expect(parameters.get(IDS.musicReactivity)).toMatchObject({ label: 'Music Reactivity', defaultValue: 0.8 })
    expect(parameters.get(IDS.kickReaction)).toMatchObject({ label: 'Kick Reactivity', defaultValue: 0.72 })
    expect(parameters.get(IDS.transientReaction)).toMatchObject({ label: 'Transient Reaction', defaultValue: 0.58 })
    expect(parameters.get(IDS.dropReaction)).toMatchObject({ label: 'Drop Reaction', defaultValue: 0.92 })
  })

  it('offers the four sign patterns (default Pulse), Flicker (default 0) and City Atmosphere (default at the authored look)', () => {
    const pattern = parameters.get(IDS.signPattern)
    expect(pattern).toMatchObject({ type: 'enum', defaultValue: 'pulse', designParentGroup: 'design' })
    expect((pattern as { options: readonly { value: string }[] }).options.map(option => option.value)).toEqual([...CINEMA2_ATL_HOE_SIGN_PATTERNS])
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

  it('gates each sign pattern\'s rules on the Sign Pattern value and runs only the shared rules otherwise', () => {
    const gated = (pattern: string) => rules.filter(rule => (rule.enabledWhen ?? []).some(condition => condition.kind === 'parameter-equals' && condition.parameterId === IDS.signPattern && condition.value === pattern))
    for (const pattern of CINEMA2_ATL_HOE_SIGN_PATTERNS) expect(gated(pattern).length, pattern).toBeGreaterThan(0)
    // Marquee staggers one chase over the eleven cells; Cascade staggers a wave across sign, windows, lamps and spires.
    const chase = rules.find(rule => rule.id === 'atl-hoe-marquee-chase')
    expect(chase?.actions.map(action => action.delayBeats)).toEqual(Array.from({ length: 11 }, (_, index) => (index * 4) / 11))
    expect(rules.find(rule => rule.id === 'atl-hoe-cascade-wave')?.source.signal).toBe('phrase')
    // Neon Fault drops parts out at random on transients.
    expect(rules.find(rule => rule.id === 'atl-hoe-fault-transient')?.actions.every(action => action.probability === 0.3)).toBe(true)
  })

  it('routes each reaction slider to its own events', () => {
    const strengthOf = (ruleId: string) => rules.find(rule => rule.id === ruleId)?.strengthParameter?.$ref
    expect(strengthOf('atl-hoe-pulse-kick')).toBe(IDS.kickReaction)
    expect(strengthOf('atl-hoe-pulse-transient')).toBe(IDS.transientReaction)
    expect(strengthOf('atl-hoe-drop')).toBe(IDS.dropReaction)
    expect(strengthOf('atl-hoe-energy')).toBe(IDS.musicReactivity)
    expect(strengthOf('atl-hoe-flicker')).toBe(IDS.flicker)
    expect(rules.find(rule => rule.id === 'atl-hoe-flicker')?.actions.every(action => action.gate != null)).toBe(true)
  })

  it('offers a Sky Pattern toggle (default off) and, once on, a Stars / Thunderstorm dropdown', () => {
    expect(parameters.get(IDS.skyPatternEnabled)).toMatchObject({ label: 'Sky Pattern', type: 'boolean', defaultValue: false, designParentGroup: 'design' })
    const dropdown = parameters.get(IDS.skyPattern)
    expect(dropdown).toMatchObject({ type: 'enum', defaultValue: 'stars' })
    expect((dropdown as { options: readonly { value: string }[] }).options.map(option => option.value)).toEqual([...CINEMA2_ATL_HOE_SKY_PATTERNS])
    expect(dropdown?.visibleWhen).toEqual([{ kind: 'parameter-equals', parameterId: IDS.skyPatternEnabled, value: true }])
  })

  it('has twelve defined lightning bolts, each struck by its own rule, and gates every sky rule on the toggle and the type', () => {
    expect(atlHoeParts.bolts).toHaveLength(12)
    const strikes = rules.filter(rule => rule.id.startsWith('atl-hoe-storm-strike-'))
    expect(strikes).toHaveLength(12)
    for (const rule of rules.filter(candidate => candidate.id.startsWith('atl-hoe-storm-') || candidate.id.startsWith('atl-hoe-stars-'))) {
      const conditions = rule.enabledWhen ?? []
      expect(conditions.some(condition => condition.kind === 'parameter-equals' && condition.parameterId === IDS.skyPatternEnabled && condition.value === true), rule.id).toBe(true)
      expect(conditions.some(condition => condition.kind === 'parameter-equals' && condition.parameterId === IDS.skyPattern), rule.id).toBe(true)
    }
  })

  it('drives the camera from Camera Movement and BPM Sync, with the camera at rest by default', () => {
    const camera = manifest.cameras?.[0]
    expect(camera?.controls?.motionAmount?.$ref).toBe(IDS.cameraMovement)
    expect(camera?.controls?.tempoSync?.$ref).toBe(IDS.bpmSync)
    expect(camera?.motion).toBeDefined()
  })

  it('moves the haze with City Atmosphere without changing it at the default', () => {
    const atmosphere = rules.find(rule => rule.id === 'atl-hoe-atmosphere')
    expect(atmosphere?.source).toMatchObject({ signal: 'parameter', offset: -0.5 })
    expect(atmosphere?.actions.map(action => (action.target.kind === 'effect' || action.target.kind === 'environment') ? action.target.property : '')).toEqual(['mistAmount', 'density', 'fog.density'])
  })

  it('lays the Design tab out as Master Controls, Design, Effects and Palette, revealing the sky dropdown only when the toggle is on', () => {
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const labels = () => Object.fromEntries(createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).map(parent => [
      parent.id,
      [...parent.controls.map(control => control.definition.label), ...parent.groups.flatMap(group => group.controls.map(control => control.definition.label))],
    ]))

    expect(labels()).toEqual({
      'master-controls': ['Master Intensity', 'BPM Sync', 'Camera Movement', 'Music Reactivity', 'Kick Reactivity', 'Transient Reaction', 'Drop Reaction'],
      design: ['Sign Pattern', 'Sky Pattern'],
      effects: ['Flicker', 'City Atmosphere'],
      palette: ['Sign Color', 'Letter Color', 'Architecture Color'],
    })
    expect(state.setPersistentValue(IDS.skyPatternEnabled, true)).toMatchObject({ ok: true })
    expect(labels().design).toEqual(['Sign Pattern', 'Sky Pattern', 'Sky Pattern Type'])
  })
})
