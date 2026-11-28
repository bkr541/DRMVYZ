import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { describe, expect, it, vi } from 'vitest'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { cinema2NativePresetRegistry, Cinema2PresetRegistry } from '../presets/Cinema2PresetRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2DesignParentGroupModel, createCinema2InspectorModel } from '../parameters/Cinema2InspectorModel'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS, CINEMA2_USER_MODEL_PREVIEWS } from './Cinema2UserModelPreviewPatterns'
import { Cinema2UserModelPreviewEffects } from './Cinema2UserModelPreviewEffects'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { ifritMusicFixture } from '../../../../test/support/IfritMusicFixture'
import { activateCinema2Workspace, createEmptyCinema2WorkspaceDocument, parseCinema2WorkspaceDocument } from '../runtime/Cinema2WorkspacePersistence'
const kinds = CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS
const library = { THREE, wideLines: { LineSegments2, LineSegmentsGeometry, LineMaterial } } as unknown as Cinema2ThreeLibrary
function root() {
  const group = new THREE.Group(), front = new THREE.MeshPhysicalMaterial({ color: '#abcdef' }), side = new THREE.MeshPhysicalMaterial({ color: '#ddaa11' }); front.name = 'front'; side.name = 'side'
  group.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, .4), [front, side])); return group
}
function context(values: Record<string, unknown>, time = 2, event?: 'kick' | 'beat' | 'drop' | 'phrase' | 'snare' | 'downbeat' | 'bar', eventId = 1, edit = 0, advanceGrid = false): Cinema2ModuleUpdateContext {
  const published = ifritMusicFixture({ frameId: Math.floor(time * 100) + 1, timeSec: time, event, eventId, beatIndex: advanceGrid ? Math.floor(time * 2) : 128, energy: .6 })
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => published, getPublicationMeta: () => ({ sequence: published.frameId, kind: 'frame', publisherId: 'preview-test', reason: null, publishedAtMs: time * 1000 }) })
  const snapshot = bridge.capture(published.frameId)
  const audio = { ...snapshot, discontinuity: { ...snapshot.discontinuity, occurred: false } }
  const frame = { frameId: published.frameId, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: .016, contextGeneration: 1, viewport: { width: 800, height: 600, dpr: 1 }, transport: { trackId: published.trackId, sourcePresent: true, playing: true, paused: false, animationActive: true, timeSec: time, analysisActive: true, bpm: 120 }, audio, director: null } as Cinema2ModuleFrameReadContext
  return { frame, parameters: { get: name => values[name] as never, getAuthored: () => undefined, resolve: () => null, getEditRevision: () => edit }, targets: {} as never }
}
describe.each(kinds)('%s model preview declaration', kind => {
  it('registers as a visible reference, compiles with dependencies and has the full control contract', () => {
    const manifest = createCinema2UserModelPreset(kind), declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(p => p.manifest.id === manifest.id)!
    expect(declaration.role).toBe('reference'); expect(manifest.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions(declaration).diagnostics).toEqual([])
    expect(cinema2NativePresetRegistry.compile(manifest.id).ok).toBe(true)
    const registry = new Cinema2PresetRegistry(); expect(registry.register(manifest).ok).toBe(true); expect(registry.register(manifest).ok).toBe(false)
    const find = (key: string) => manifest.parameters!.find(p => p.id === cinema2UserModelPreviewParameterId(kind, key))!
    const compiled = cinema2NativePresetRegistry.compile(manifest.id)
    if (!compiled.ok) throw new Error('Preview did not compile')
    const snapshot = new Cinema2ParameterState(compiled.plan.parameters).getSnapshot()
    const controls = createCinema2DesignParentGroupModel(compiled.plan, snapshot).flatMap(parent => [...parent.controls, ...parent.groups.flatMap(group => group.controls)])
    expect(find('model').exposure).toBe('primary')
    // The model picker belongs to the Source tab, so the Design projection leaves it out (docs/cinema2-sys-07-inspector.md).
    expect(controls.some(control => control.definition.id === find('model').id)).toBe(false)
    expect(controls.find(control => control.definition.id === find('pattern').id)).toBeDefined()
    expect(createCinema2InspectorModel(compiled.plan, snapshot, 'design').flatMap(section => section.groups.flatMap(group => group.controls)).some(control => control.definition.id === find('model').id)).toBe(false)
    expect(find('bpmSync')).toMatchObject({ label: 'BPM Sync', type: 'boolean', designParentGroup: 'master-controls' })
    expect(find('pattern').options).toHaveLength(6); expect(find('patternChange')).toMatchObject({ type: 'boolean', defaultValue: false, designParentGroup: 'design' })
    expect(find('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS); expect(find('trigger').visibleWhen).toEqual([{ kind: 'parameter-equals', parameterId: find('patternChange').id, value: true }])
    for (const key of ['background', 'primary', 'secondary', 'accent']) expect(find(key)).toMatchObject({ type: 'color', designParentGroup: 'palette' })
    expect(manifest.modules![0].config).toMatchObject({ userModelPreview: kind, userModel: { neutralFloor: false } })
    const model = `user-model:c0000000-0000-4000-8000-000000000001:1`
    const result = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), { presetId: manifest.id, parameterPatch: { [find('model').id]: model, [find('pattern').id]: CINEMA2_USER_MODEL_PREVIEWS[kind][4] } })
    expect(result.ok).toBe(true); expect(parseCinema2WorkspaceDocument(JSON.parse(JSON.stringify(result.document))).ok).toBe(true)
    expect(result.state!.serializedParameterState).toContain(model)
  })
  it('builds bounded model effects and six distinct arrangements without mutating cached geometry', () => {
    const scene = root(), source = scene.children[0] as THREE.Mesh, positions = Array.from(source.geometry.attributes.position.array), dispose = vi.spyOn(source.geometry, 'dispose')
    const controller = new Cinema2UserModelPreviewEffects(library, kind); controller.attach(scene, true)
    const hashes = new Set<string>()
    for (const pattern of CINEMA2_USER_MODEL_PREVIEWS[kind]) {
      for (let step = 0; step <= 20; step++) controller.update(context({ pattern, reactivity: 0 }, 2 + step * .2, undefined, 1, 0, true))
      controller.beforeDraw('high'); scene.updateMatrixWorld(true)
      const values: number[] = []
      scene.traverse(object => { values.push(...object.matrix.elements, Number(object.visible)); if ((object as THREE.LineSegments).isLineSegments) values.push(((object as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity); const mesh = object as THREE.InstancedMesh; if (mesh.isInstancedMesh) values.push(...mesh.instanceMatrix.array.slice(0, 300)); if ((object as THREE.Points).isPoints) values.push(...(object as THREE.Points).geometry.attributes.position.array.slice(0, 120)) })
      // GPU motion is represented by uniforms, not CPU position-buffer rewrites.
      if (kind === 'dust' || kind === 'hologram') {
        scene.traverse(object => {
          const material = kind === 'dust' && (object as THREE.Points).isPoints ? (object as THREE.Points).material : kind === 'hologram' && object === source ? source.material : null
          if (!material || Array.isArray(material)) return
          const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>\n#include <opaque_fragment>' }
          material.onBeforeCompile(shader as never, {} as never)
          const uniform = shader.uniforms[kind === 'dust' ? 'c2Pattern' : 'c2HoloMode']
          if (typeof uniform?.value === 'number') values.push(uniform.value)
        })
      }
      // The hologram's look is the shader mode on the projected surfaces (one per pattern), so it is read from the controller.
      if (kind === 'hologram') values.push(...controller.inspect().hologramModes)
      hashes.add(JSON.stringify(values))
    }
    expect(hashes.size).toBe(6)
    controller.beforeDraw('low')
    scene.traverse(object => { const mesh = object as THREE.InstancedMesh; if (mesh.isInstancedMesh && mesh.visible) expect(mesh.count).toBeLessThanOrEqual(20_000) })
    controller.detach(scene); controller.dispose(); expect(controller.inspect().attachmentCount).toBe(0); expect(dispose).not.toHaveBeenCalled(); expect(Array.from(source.geometry.attributes.position.array)).toEqual(positions)
  })
})
describe('shared pattern authority and musical event reuse', () => {
  it('deduplicates fresh triggers; manual edits including same-value edits hold until the next event and never change the toggle', () => {
    const controller = new Cinema2UserModelPreviewEffects(library, 'form'), patterns = CINEMA2_USER_MODEL_PREVIEWS.form
    const values = { pattern: patterns[0] as string, patternChange: true, trigger: 'beat', reactivity: 0 }
    controller.update(context(values, 2, 'beat', 1)); expect(controller.inspect().pattern).toBe(patterns[0])
    controller.update(context(values, 2.1, 'beat', 2)); expect(controller.inspect().pattern).toBe(patterns[1])
    controller.update(context(values, 2.12, 'beat', 2)); expect(controller.inspect().pattern).toBe(patterns[1])
    values.pattern = patterns[4]; controller.update(context(values, 2.14, 'beat', 2, 1)); expect(controller.inspect().pattern).toBe(patterns[4]); expect(values.patternChange).toBe(true)
    controller.update(context(values, 2.2, 'beat', 3, 1)); expect(controller.inspect().pattern).toBe(patterns[5])
    controller.update(context(values, 2.21, 'beat', 3, 2)); expect(controller.inspect().pattern).toBe(patterns[4])
    values.patternChange = false; controller.update(context(values, 2.3, 'beat', 4, 2)); expect(controller.inspect().pattern).toBe(patterns[4])
    controller.update(context(values, .5, 'beat', 5, 2)); expect(controller.inspect().pattern).toBe(patterns[4])
  })
  it.each(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)('advances on the canonical $value trigger and ignores its duplicate', ({ value }) => {
    const controller = new Cinema2UserModelPreviewEffects(library, 'form'), names = CINEMA2_USER_MODEL_PREVIEWS.form
    const values = { pattern: names[0], patternChange: true, trigger: value }
    controller.update(context(values, 2))
    const event = value === 'phrase' || value === 'drop' || value === 'kick' || value === 'snare' || value === 'downbeat' ? value : value.startsWith('bar') ? 'bar' : 'beat'
    controller.update(context(values, 2.1, event, 8)); expect(controller.inspect().pattern).toBe(names[1])
    controller.update(context(values, 2.1, event, 8)); expect(controller.inspect().pattern).toBe(names[1])
  })
  it('uses shared energy/rhythm/structure while preserving authored controls and resets transient response on seek', () => {
    const controller = new Cinema2UserModelPreviewEffects(library, 'shatter'), values = { reactivity: 1, response: .5 }
    controller.update(context(values, 2)); const energy = controller.inspect().reaction
    controller.update(context(values, 2.1, 'kick', 4)); expect(controller.inspect().reaction).toBeGreaterThan(energy)
    controller.update(context(values, .5)); expect(controller.inspect().reaction).toBeCloseTo(energy)
    expect(values).toEqual({ reactivity: 1, response: .5 })
  })
})

it('projects a simple fixed Shatter preview and persists retained model and appearance values', () => {
  const kind = 'shatter', manifest = createCinema2UserModelPreset(kind), compiled = cinema2NativePresetRegistry.compile(manifest.id)
  if (!compiled.ok) throw new Error('Preview did not compile')
  const state = new Cinema2ParameterState(compiled.plan.parameters), id = (key: string) => cinema2UserModelPreviewParameterId(kind, key)
  const groups = () => createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).flatMap(parent => parent.groups.map(group => group.label))
  expect(groups()).not.toContain('Voxel'); expect(groups()).not.toContain('Audio Modulation')
  expect(state.setPersistentValue(id('representation'), 'shatter').ok).toBe(false)
  const savedValues = { model: 'user-model:c0000000-0000-4000-8000-000000000001:3', cinematicBloom: .7, modelScale: .8, autoPerformance: true }
  for (const [key, value] of Object.entries(savedValues)) expect(state.setPersistentValue(id(key), value).ok, key).toBe(true)
  const restored = new Cinema2ParameterState(compiled.plan.parameters)
  expect(restored.restore(state.serialize()).ok).toBe(true)
  for (const [key, value] of Object.entries(savedValues)) expect(restored.getValue(id(key)), key).toEqual(value)
})


it('ships exactly four model previews; retired Form and Voxel are no longer selectable or registered', () => {
  const ids = cinema2NativePresetRegistry.list().filter(manifest => manifest.id.startsWith('drmvyz.cinema2.user-model-')).map(manifest => manifest.id)
  expect(ids).toEqual(CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS.map(kind => createCinema2UserModelPreset(kind).id).sort())
  for (const kind of ['form', 'voxel'] as const) expect(cinema2NativePresetRegistry.get(createCinema2UserModelPreset(kind).id)).toBeNull()
})

// Exercise every remaining arrangement through its full cycle on the shared musical clock.
describe.each(CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS)('%s intact-model choreography', kind => {
  it.each(CINEMA2_USER_MODEL_PREVIEWS[kind])('reveals, transforms and restores the real model in %s', pattern => {
    const scene = root(), original = scene.children[0] as THREE.Mesh
    const controller = new Cinema2UserModelPreviewEffects(library, kind)
    controller.attach(scene, true)
    const source = scene.getObjectByName('UserModelPreviewSource')!
    const values = { pattern, effectPose: 'logo-cycle', movement: .35, speed: 1, opacity: kind === 'hologram' ? .65 : 1, reactivity: 0 }
    const step = (beat: number) => {
      controller.update(context(values, 2 + beat / 2), { timing: { beats: beat, bpm: 120, source: 'analyzed-beat-grid', confirmedGrid: true }, motionBeats: beat })
      controller.beforeDraw('high')
    }
    step(0)
    expect(source.visible).toBe(true); expect(source.children[0]).toBe(original); expect(controller.inspect().logoAmount).toBe(0)
    for (let beat = .5; beat <= 8; beat += .5) step(beat)
    expect(controller.inspect().logoAmount).toBeCloseTo(1)
    if (kind !== 'hologram') expect(source.visible).toBe(false)
    expect(controller.logoOrbitRadians()).toBeGreaterThan(.1)
    for (let beat = 8.5; beat <= 14; beat += .5) step(beat)
    expect(controller.inspect().logoAmount).toBe(0); expect(source.visible).toBe(true)
    expect(controller.logoOrbitRadians()).toBeGreaterThan(0)
    for (let beat = 14.5; beat <= 16; beat += .5) step(beat)
    expect(controller.logoOrbitRadians()).toBeCloseTo(0); expect(controller.inspect().logoAmount).toBe(0)
    expect((source.children[0] as THREE.Mesh).geometry).toBe(original.geometry)
    controller.dispose()
  })
})

it('does not restart the logo cycle on each beat-driven Pattern Change', () => {
  const controller = new Cinema2UserModelPreviewEffects(library, 'shatter')
  const values = { effectPose: 'logo-cycle', pattern: 'Radial Burst', patternChange: true, trigger: 'beat' }
  for (let beat = 0; beat <= 16; beat += .5) {
    controller.update(context(values, 2 + beat / 2, 'beat', Math.floor(beat) + 1), { timing: { beats: beat, bpm: 120, source: 'analyzed-beat-grid', confirmedGrid: true }, motionBeats: beat })
    if (beat === 8) expect(controller.inspect().logoAmount).toBeCloseTo(1)
  }
  expect(controller.inspect().logoAmount).toBe(0); controller.dispose()
})
