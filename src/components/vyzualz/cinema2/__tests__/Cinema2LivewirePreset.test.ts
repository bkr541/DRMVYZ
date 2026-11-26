import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { setAutoPerformanceUserDefault } from '../../../../lib/autoPerformanceDefault'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { createLivewireCameraFraming } from '../modules/livewire/Cinema2LivewireCameraFraming'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_LIVEWIRE_PRESET_ID, CINEMA2_LIVEWIRE_PRESET_MANIFEST } from '../presets/Cinema2LivewirePreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { LIVEWIRE_GLYPH_METRICS, LIVEWIRE_GLYPH_MESHES } from '../modules/livewire/Cinema2LivewireGlyphs'
import { livewireGlyphShapes } from '../modules/livewire/Cinema2LivewireContours'
import { resolveCinema2SayItTextLayout } from '../modules/sayIt/Cinema2SayItTextLayout'

import { buildLivewireStage, Cinema2LivewireEnvironment, livewireStageLight } from '../modules/livewire/Cinema2LivewireEnvironment'
import { LIVEWIRE_FLOOR_Y, type LivewirePerformance } from '../modules/livewire/Cinema2LivewireBridge'

const manifest = CINEMA2_LIVEWIRE_PRESET_MANIFEST
const parameter = (name: string) => manifest.parameters!.find(item => item.id === `livewire-${name}`)!

afterEach(() => setAutoPerformanceUserDefault(null))

describe('LIVEWIRE', () => {
  it('compiles and exposes the four groups, authored text and canonical pattern controls', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_LIVEWIRE_PRESET_ID)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest }).diagnostics).toEqual([])
    expect(new Set(manifest.parameters!.filter(item => item.section === 'Design').map(item => item.designParentGroup))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
    expect(parameter('text').defaultValue).toBe('LIVEWIRE')
    expect(parameter('pattern').options).toHaveLength(6)
    expect(parameter('pattern-change')).toMatchObject({ defaultValue: false, metadata: { moodPolicy: 'patternChange' } })
    expect(parameter('trigger')).toMatchObject({
      options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: 'livewire-pattern-change', value: true }],
    })
    expect(manifest.parameters!.filter(item => item.designParentGroup === 'palette' && item.type === 'color')).toHaveLength(4)
  })

  it('keeps beat-synced camera motion compatible with the static rig', () => {
    const camera = manifest.cameras![0]!
    expect(camera.rig?.kind).toBe('static')
    expect(camera.motion?.tempo).toMatchObject({ flightSpeed: false, weave: 0.38 })
    expect(camera.controls?.tempoSync?.$ref).toBe('livewire-bpm-sync')
    expect(cinema2NativePresetRegistry.compile(CINEMA2_LIVEWIRE_PRESET_ID).ok).toBe(true)
  })

  it('takes its initial Auto Performance from the shared system preference', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_LIVEWIRE_PRESET_ID)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    for (const preference of [true, false]) {
      setAutoPerformanceUserDefault(preference)
      const state = new Cinema2ParameterState(result.plan.parameters)
      expect(state.getValue(parameter('auto-performance').id)).toBe(preference)
      expect(state.getValue(parameter('text').id)).toBe('LIVEWIRE')
    }
  })

  it('lays out both lines from the original glyph repertoire', () => {
    const layout = resolveCinema2SayItTextLayout({ line1: 'LIVEWIRE', line2: 'D.O.R.! 42' }, {
      alignment: 'center', lineMode: 'two', tracking: 0.04, lineSpacing: 0.84, glyphScale: 0.5,
    }, LIVEWIRE_GLYPH_METRICS)
    expect(layout.replacementCount).toBe(0)
    expect(layout.glyphs.length).toBe(17)
    expect(layout.glyphs.every(glyph => LIVEWIRE_GLYPH_MESHES.has(glyph.mesh))).toBe(true)
    expect(Object.keys(LIVEWIRE_GLYPH_METRICS.glyphs)).toHaveLength(95)
  })

  it('merges a closed glyph into one machinable shell and preserves its counter', () => {
    const shape = livewireGlyphShapes(THREE, [
      { start: [0, 0], end: [0, 1] }, { start: [0, 1], end: [0.75, 1] },
      { start: [0.75, 1], end: [1, 0.5] }, { start: [1, 0.5], end: [0.75, 0] },
      { start: [0.75, 0], end: [0, 0] },
    ], 0.22)
    expect(shape).toHaveLength(1)
    expect(shape[0]!.holes).toHaveLength(1)
    expect(THREE.ShapeUtils.isClockWise(shape[0]!.getPoints())).toBe(true)
    expect(THREE.ShapeUtils.isClockWise(shape[0]!.holes[0]!.getPoints())).toBe(false)
  })
})

// Exercise the compiled LIVEWIRE plan, shared audio bridge, director, choreography
// and final camera resolver. No hand-authored replacement camera in the test.
function cameraRun(settings: Record<string, unknown>, music: Partial<NightshiftFixtureOptions> = {},
  viewport = { width: 1280, height: 720, dpr: 1 }, pause = false) {
  const compiled = cinema2NativePresetRegistry.compile(CINEMA2_LIVEWIRE_PRESET_ID)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const plan = compiled.plan
  const state = new Cinema2ParameterState(plan.parameters)
  expect(state.setPersistentValues(Object.fromEntries(Object.entries(settings).map(([key, value]) => [`livewire-${key}`, value]))).ok).toBe(true)
  const authored = state.serialize()
  const resolver = new Cinema2FinalValueResolver(plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
  })
  const spatial = new Cinema2SpatialRuntime(plan.scene, plan.targets.targets, resolver)
  const camera = new Cinema2CameraRuntime(plan, state, resolver, spatial, createLivewireCameraFraming(state))
  const choreography = new Cinema2ChoreographyRuntime(plan, state, resolver)
  const director = new Cinema2VisualDirector()
  let frameId = 0, time = 0
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => nightshiftMusicFixture({ ...music, frameId, timeSec: time, advanceBeatGrid: true }),
    getPublicationMeta: () => ({ sequence: frameId, publisherId: 'livewire-camera-test', kind: 'frame', publishedAtMs: time * 1000 }),
  })
  const frames = []
  for (let step = 0; step <= 120; step++) {
    frameId++
    const paused = pause && step > 60
    time = (paused ? 60 : step) / 60
    const audio = bridge.capture(frameId)
    const frame: Cinema2ModuleFrameReadContext = {
      frameId, timestampMs: step * 1000 / 60, elapsedTimeSec: time, deltaTimeSec: paused ? 0 : 1 / 60,
      viewport, contextGeneration: 1, audio, director: director.capture(audio),
      transport: { sourcePresent: true, playing: !paused, paused, analysisActive: true, animationActive: !paused, trackId: 'fixture', timeSec: time },
    }
    choreography.update(frame)
    frames.push(camera.update(frame))
  }
  expect(state.serialize()).toBe(authored)
  return frames
}

const travel = (frames: ReturnType<typeof cameraRun>) => Math.max(...frames.map(frame => frame.position[0])) - Math.min(...frames.map(frame => frame.position[0]))
const last = (frames: ReturnType<typeof cameraRun>) => frames[frames.length - 1]!

describe('LIVEWIRE shared camera authority', () => {
  it('moves in manual playback, respects hard disable and reduced motion, and freezes on pause', () => {
    const settings = { 'auto-performance': false, 'camera-amount': 1 }
    const full = cameraRun(settings)
    expect(travel(full)).toBeGreaterThan(0.25)
    const off = cameraRun({ ...settings, 'camera-motion': false })
    const zero = cameraRun({ ...settings, 'camera-amount': 0 })
    const locked = cameraRun({ ...settings, 'motion-safety': 'lockoff' })
    for (const frames of [off, zero, locked]) {
      expect(travel(frames)).toBeCloseTo(0, 8)
      expect(last(frames).position).toEqual([0, 0.19, 6.9])
    }
    const reduced = cameraRun({ ...settings, 'motion-safety': 'reduced' })
    expect(travel(reduced)).toBeLessThan(travel(full) * 0.6)
    const paused = cameraRun(settings, {}, undefined, true)
    expect(last(paused).viewProjectionMatrix).toEqual(paused[60]!.viewProjectionMatrix)
  })

  it('uses distinct shared section and drop contributions without rewriting saved controls', () => {
    const settings = { 'auto-performance': true, 'camera-amount': 1 }
    const verse = last(cameraRun(settings, { sectionType: 'verse' }))
    const intro = last(cameraRun(settings, { sectionType: 'intro' }))
    const build = last(cameraRun(settings, { sectionType: 'build', build: 0.95 }))
    const release = last(cameraRun(settings, { sectionType: 'breakdown' }))
    expect(intro.position[1]).toBeLessThan(verse.position[1] - 0.25)
    expect(build.position[2]).toBeLessThan(verse.position[2] - 0.1)
    expect(release.position[2]).toBeGreaterThan(verse.position[2] + 0.4)
    const drop = cameraRun(settings, { sectionType: 'verse', event: 'drop', eventId: 22, eventTime: 1 })
    expect(drop[96]!.position[2]).toBeLessThan(cameraRun(settings)[96]!.position[2] - 0.15)
    const manual = last(cameraRun({ ...settings, 'auto-performance': false }, { sectionType: 'intro' }))
    expect(manual.position).toEqual(last(cameraRun({ ...settings, 'auto-performance': false }, { sectionType: 'verse' })).position)
    const disabled = last(cameraRun({ ...settings, 'camera-motion': false }, { sectionType: 'breakdown' }))
    expect(disabled.position).toEqual([0, 0.19, 6.9])
  })

  it('keeps the floor-anchored maximum text envelope inside both landscape and portrait projections', () => {
    // Use the maximum-size requested two-line layout and the real framing bounds.
    for (const viewport of [{ width: 1920, height: 1080, dpr: 1 }, { width: 540, height: 960, dpr: 1 }]) {
      const settings = { 'auto-performance': true, 'camera-amount': 1, text: 'WWWWWWWWWWWW', 'line-2-text': 'WWWWWWWW', 'line-mode': 'two', 'glyph-scale': 1.5 }
      const frames = cameraRun(settings, { sectionType: 'build', build: 0.95, event: 'drop', eventId: 23, eventTime: 1 }, viewport)
      const compiled = cinema2NativePresetRegistry.compile(CINEMA2_LIVEWIRE_PRESET_ID)
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
      const state = new Cinema2ParameterState(compiled.plan.parameters)
      expect(state.setPersistentValues(Object.fromEntries(Object.entries(settings).map(([key, value]) => [`livewire-${key}`, value]))).ok).toBe(true)
      const bounds = createLivewireCameraFraming(state)()
      for (const frame of frames) {
        const matrix = new THREE.Matrix4().fromArray([...frame.viewProjectionMatrix])
        for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
          const point = new THREE.Vector3(x, y, z).applyMatrix4(matrix)
          expect(Math.abs(point.x)).toBeLessThan(0.98)
          expect(Math.abs(point.y)).toBeLessThan(0.98)
        }
      }
    }
  })
})


describe('LIVEWIRE recessed environment', () => {
  const idle: LivewirePerformance = {
    coverage: 0.45, intensity: 1, period: 4, motion: 0.8, playing: false,
    energy: 0, vocal: 0, kick: 0, snare: 0, transient: 0, build: 0, drop: 0, silence: 0,
  }
  const parts = buildLivewireStage(LIVEWIRE_FLOOR_Y)
  const conduits = parts.filter(part => part.kind === 'conduit')
  const levels = (look: LivewirePerformance, pattern = 0, phase = 0.31) =>
    conduits.map(part => livewireStageLight(part, pattern, phase, look))
  const peak = (look: LivewirePerformance) => Math.max(...levels(look))

  it('spans the full text envelope in two recessed layers without crossing the floor or glyphs', () => {
    expect(parts.length).toBeLessThan(200)
    expect(new Set(parts.filter(part => part.kind === 'shell').map(part => part.position[2])).size).toBeGreaterThan(1)
    expect(Math.max(...parts.map(part => part.position[0] + part.size[0] / 2))).toBeGreaterThan(5.4 / 2)
    for (const part of parts) {
      expect(part.position[2] + part.size[2] / 2).toBeLessThan(-1)
      expect(part.position[1] - part.size[1] / 2).toBeGreaterThanOrEqual(LIVEWIRE_FLOOR_Y - 1e-8)
    }
  })

  it('uses distinct banks, traveling highlights and bounded shared accents with vocal and silence protection', () => {
    const playing = { ...idle, playing: true }
    const drop = { ...playing, energy: 1, drop: 1, build: 1, kick: 1, snare: 1, transient: 1 }
    expect(peak(idle)).toBeLessThan(0.005)
    expect(peak(drop)).toBeGreaterThan(peak(playing) * 3)
    expect(peak({ ...drop, vocal: 1 })).toBeLessThan(peak(drop) * 0.4)
    expect(levels({ ...drop, silence: 1 })).toEqual(levels(idle))
    expect(levels({ ...drop, motion: 0 })).toEqual(levels(idle))
    expect(levels({ ...drop, intensity: 0 }).every(value => value === 0)).toBe(true)
    expect(Math.max(...levels({ ...drop, intensity: 1.6, motion: 1 }))).toBeLessThanOrEqual(0.22)
    expect(levels(playing, 0, 0.12)).not.toEqual(levels(playing, 0, 0.62))
    expect(new Set(Array.from({ length: 6 }, (_, pattern) => JSON.stringify(levels(playing, pattern)))).size).toBe(6)
  })

  it('uses one reusable instance batch and disposes its owned resources', () => {
    const scene = new THREE.Scene()
    const environment = new Cinema2LivewireEnvironment(THREE, scene, LIVEWIRE_FLOOR_Y)
    const mesh = scene.children[0]!.children[0] as THREE.InstancedMesh
    const material = mesh.material as THREE.MeshBasicMaterial
    const disposed: string[] = []
    mesh.addEventListener('dispose', () => disposed.push('instances'))
    mesh.geometry.addEventListener('dispose', () => disposed.push('geometry'))
    material.addEventListener('dispose', () => disposed.push('material'))
    environment.update(0, 0, idle, [0.025, 0.88, 1])
    const before = Array.from(mesh.instanceColor!.array)
    environment.update(0, 0.31, { ...idle, playing: true, drop: 1 }, [0.025, 0.88, 1])
    expect(Array.from(mesh.instanceColor!.array)).not.toEqual(before)
    expect(mesh.count).toBe(parts.length)
    expect(environment.estimateGpuBytes()).toBeLessThan(32 * 1024)
    expect(scene.children).toHaveLength(1)
    environment.dispose()
    environment.dispose()
    expect(scene.children).toHaveLength(0)
    expect(disposed.sort()).toEqual(['geometry', 'instances', 'material'])
  })
})
