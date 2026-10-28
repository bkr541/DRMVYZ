import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Cinema2CrystalizedPerformance, CRYSTALIZED_ROUTES } from '../modules/crystalized/Cinema2CrystalizedPerformance'
import { Cinema2CrystalizedSceneController } from '../modules/crystalized/Cinema2CrystalizedSceneController'
import { CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST as manifest, CINEMA2_CRYSTALIZED_PARAMETER_IDS as P, CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID as RESPONSE } from '../presets/Cinema2AtmosphereReferencePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { nightshiftMusicFixture } from '../../../../test/support/NightshiftMusicFixture'
import { loadCinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleParameterReadFacet, Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'

function setup() {
  const values: Record<string, unknown> = { pattern: 'prism', motion: .35, reactivity: .8, crystalScale: 1, monolithHeight: 1 }
  let revision = 0, time = 0, timestamp = 0, sequence = 0
  let source = nightshiftMusicFixture({ timeSec: 0, frameId: 0 })
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => source, getPublicationMeta: () => ({ sequence, publishedAtMs: timestamp, publisherId: 'crystalized-test', kind: 'frame' }) })
  const parameters: Cinema2ModuleParameterReadFacet = { get: name => values[name] as never, getAuthored: name => values[name] as never, resolve: () => null, getEditRevision: () => revision }
  const next = (delta = .1, options: { paused?: boolean; noAudio?: boolean; bpm?: number; event?: 'kick' | 'snare' | 'beat' | 'drop'; eventId?: number; seek?: number; build?: number; repeat?: boolean } = {}): Cinema2ModuleUpdateContext => {
    timestamp += delta * 1000; if (!options.paused) time += delta
    if (options.seek != null) time = options.seek
    sequence++
    if (!options.repeat) {
      source = nightshiftMusicFixture({ timeSec: time, frameId: sequence, event: options.event, eventId: options.eventId, build: options.build })
      const beat = time * (options.bpm ?? 120) / 60
      source = { ...source, rhythm: { ...source.rhythm, bpm: options.bpm ?? 120, beatIndex: Math.floor(beat), beatPhase: beat % 1 } }
    }
    const audio = bridge.capture(sequence)
    return { parameters, targets: {} as Cinema2ModuleUpdateContext['targets'], frame: {
      frameId: sequence, timestampMs: timestamp, elapsedTimeSec: time, deltaTimeSec: delta, contextGeneration: 1,
      viewport: { width: 1280, height: 720, dpr: 1 }, audio: options.noAudio ? null : audio, director: null,
      transport: { sourcePresent: true, playing: !options.paused, paused: !!options.paused, animationActive: !options.paused, analysisActive: true, trackId: source.trackId, timeSec: time, bpm: options.bpm ?? 120 },
    } }
  }
  return { values, next, edit: () => revision++ }
}

describe('Crystalized production behavior', () => {
  it('uses exactly four canonical parents, conditional Trigger controls and consumed production bindings', () => {
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(manifest)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const groups = () => createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot())
    expect(groups().map(g => g.id)).toEqual(['master-controls', 'design', 'effects', 'palette'])
    const controls = () => groups().flatMap(g => [...g.controls, ...g.groups.flatMap(n => n.controls)])
    expect(controls().some(c => c.definition.id === P.trigger)).toBe(false)
    state.setPersistentValue(P.patternChange, true)
    expect(controls().find(c => c.definition.id === P.trigger)?.definition.options).toHaveLength(11)
    for (const id of Object.values(P)) expect(state.setPersistentValue(id, state.getValue(id)).ok).toBe(true)
    const restored = new Cinema2ParameterState(compiled.plan.parameters); restored.restore(state.serialize())
    expect(restored.getValue(P.patternChange)).toBe(true)
    expect(manifest.choreography!.rules.filter(r => String(r.id).endsWith('-route'))).toHaveLength(CRYSTALIZED_ROUTES.length)
  })

  it('holds motion on pause/zero and through analysis gaps, respects BPM and resets on seeks', () => {
    const a = setup(), b = setup(), slow = new Cinema2CrystalizedPerformance(), fast = new Cinema2CrystalizedPerformance()
    slow.update(a.next()); fast.update(b.next())
    for (let i = 0; i < 30; i++) { slow.update(a.next(.1, { bpm: 60 })); fast.update(b.next(.1, { bpm: 120 })) }
    expect(fast.state.phase).toBeGreaterThan(slow.state.phase * 1.7)
    const held = fast.state.phase
    fast.update(b.next(.1, { paused: true })); expect(fast.state.phase).toBe(held)
    b.values.motion = 0; fast.update(b.next()); expect(fast.state.phase).toBe(held)
    b.values.motion = .35
    fast.update(b.next(.1, { noAudio: true })); const gap = fast.state.phase
    fast.update(b.next()); expect(fast.state.phase).toBeGreaterThan(gap)
    fast.update(b.next(.1, { seek: 0 })); expect(fast.state.phase).toBe(0)
  })

  it('gives manual pattern edits authority over cycling and temporary build/drop performance', () => {
    const s = setup(), performance = new Cinema2CrystalizedPerformance()
    s.values.patternChange = true; s.values.trigger = 'kick'
    performance.update(s.next())
    performance.update(s.next(.1, { event: 'kick', eventId: 11 })); expect(performance.state.pattern).toBe('orbit')
    performance.update(s.next(.01, { repeat: true })); expect(performance.state.pattern).toBe('orbit')
    s.edit(); performance.update(s.next()); expect(performance.state.pattern).toBe('prism')
    s.values.patternChange = false; s.values.autoPerformance = true; s.values.buildPressure = 1
    performance.update(s.next()); expect(performance.state.pattern).toBe('cascade')
    s.values.pattern = 'orbit'; s.edit(); performance.update(s.next()); expect(performance.state.pattern).toBe('orbit')
    s.values.buildPressure = 0; performance.update(s.next())
    s.values.musicDrop = 1; performance.update(s.next()); expect(performance.state.pattern).toBe('pulse')
    s.values.musicDrop = 0; performance.update(s.next()); expect(performance.state.pattern).toBe('orbit')
    s.values.musicKick = 1; s.values.reactivity = 0; performance.update(s.next(.1, { paused: true })); expect(performance.state.kick).toBe(0)
  })

  it('scales about the floor, keeps each mesh addressed and applies a true master gate without accumulating material changes', async () => {
    const controller = new Cinema2CrystalizedSceneController(await loadCinema2ThreeLibrary()), s = setup(), root = new THREE.Group()
    for (const name of ['crystal', 'left', 'violet', 'right', 'back']) {
      const geometry = new THREE.BoxGeometry(1, 3.9, 1); geometry.translate(.35, .75, -1.75)
      const material = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 1 }); material.name = name
      root.add(new THREE.Mesh(geometry, material))
    }
    controller.attach(root)
    s.values.crystalScale = 1.25; s.values.motion = 0; s.values.monolithHeight = .8
    controller.update(s.next()); controller.beforeDraw()
    const pivot = root.getObjectByName('crystalized.crystal.pivot')!
    expect(pivot.scale.x).toBe(1.25); expect(pivot.position.y).toBe(-1.2)
    expect(root.getObjectByName('crystalized.left.pivot')!.scale.y).toBe(.8)
    const material = (pivot.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial
    const shader = { uniforms: {}, fragmentShader: '#include <opaque_fragment>' } as THREE.WebGLProgramParametersWithUniforms
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
    s.values.master = 0; controller.update(s.next()); controller.beforeDraw()
    expect(shader.uniforms.uCrystalizedMaster.value).toBe(0)
    const emission = material.emissiveIntensity; controller.beforeDraw(); expect(material.emissiveIntensity).toBe(emission)
    const upgraded = new THREE.MeshPhysicalMaterial({ emissiveIntensity: 99 })
    ;(pivot.children[0] as THREE.Mesh).material = upgraded
    controller.beforeDraw()
    const physicalShader = { uniforms: {}, fragmentShader: '#include <opaque_fragment>' } as THREE.WebGLProgramParametersWithUniforms
    upgraded.onBeforeCompile(physicalShader, {} as THREE.WebGLRenderer)
    expect(physicalShader.uniforms.uCrystalizedMaster.value).toBe(0)
    expect(upgraded.emissiveIntensity).toBe(emission)
    controller.dispose()
  })

  it('keeps the center crystal grounded and unrotated through active music, scaling and legacy motion settings', async () => {
    const controller = new Cinema2CrystalizedSceneController(await loadCinema2ThreeLibrary()), s = setup(), root = new THREE.Group()
    const geometry = new THREE.BoxGeometry(1, 3.9, 1); geometry.translate(0, .75, 0)
    const material = new THREE.MeshStandardMaterial(); material.name = 'crystal'
    root.add(new THREE.Mesh(geometry, material)); controller.attach(root)
    // Previously saved values must not revive levitation or rotation.
    s.values.floatAmount = .5; s.values.rotation = true; s.values.motion = 1
    s.values.pattern = 'pulse'; s.values.musicKick = 1; s.values.musicDrop = 1
    for (const scale of [.5, 1, 1.5]) {
      s.values.crystalScale = scale
      for (let i = 0; i < 50; i++) {
        controller.update(s.next()); controller.beforeDraw(); root.updateMatrixWorld(true)
        const pivot = root.getObjectByName('crystalized.crystal.pivot')!
        expect(pivot.position.y).toBe(-1.2)
        expect(pivot.rotation.toArray().slice(0,3)).toEqual([0,0,0])
        expect(new THREE.Box3().setFromObject(pivot).min.y).toBeCloseTo(-1.2, 6)
      }
    }
    controller.dispose(); geometry.dispose(); material.dispose()
  })

  it('gates every light and effect at master zero even with resolved music contributions', () => {
    const compiled = compileCinema2NativePreset(manifest)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: t => t.parameterId ? state.getValue(t.parameterId) : undefined })
    const choreography = new Cinema2ChoreographyRuntime(compiled.plan, state, resolver)
    state.setPersistentValue(P.master, 0); state.setPersistentValue(RESPONSE, 2)
    choreography.update(setup().next().frame)
    for (const target of compiled.plan.targets.targets.filter(t => t.kind === 'light' && t.property === 'intensity' || t.kind === 'effect' && t.property === 'mix')) expect(resolver.resolve(target.id).value).toBe(0)
  })
})
