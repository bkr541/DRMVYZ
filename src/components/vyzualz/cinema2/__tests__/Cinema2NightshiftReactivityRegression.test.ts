import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Cinema2NightshiftSceneController, type NightshiftSceneFrame } from '../modules/nightshift/Cinema2NightshiftSceneController'
import { readNightshiftControls, CINEMA2_NIGHTSHIFT_PATTERNS } from '../modules/nightshift/Cinema2NightshiftDomain'
import { NIGHTSHIFT_MUSIC_TARGET_DEFAULTS } from '../modules/nightshift/Cinema2NightshiftAudio'
import { cinema2NightshiftNativeModuleDefinition } from '../modules/Cinema2NightshiftNativeModule'
import { Cinema2BeatClock } from '../modules/Cinema2BeatClock'
import { loadCinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_NIGHTSHIFT_PRESET_MANIFEST as manifest } from '../presets/Cinema2NightshiftPreset'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { nightshiftMusicFixture } from '../../../../test/support/NightshiftMusicFixture'

const parameters: Cinema2ModuleParameterReadFacet = { get: () => undefined, getAuthored: () => undefined, resolve: () => null }

function installation() {
  const root = new THREE.Group()
  const ball = new THREE.Group(); ball.name = 'nightshift.ball'; root.add(ball)
  const mesh = (name: string, geometry: THREE.BufferGeometry) => {
    const result = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
    result.name = name; root.add(result); return result
  }
  mesh('nightshift.ball.mirrors', new THREE.BoxGeometry())
  const panel = new THREE.BoxGeometry(1.19, .016, 1.19)
  for (let row = 0; row < 10; row++) for (let column = 0; column < 10; column++) {
    mesh(`nightshift.floor.cell.${row}.${column}`, panel).userData = { row, column, paletteIndex: column % 4, level: 2 }
    mesh(`nightshift.floor.frame.${row}.${column}`, panel)
  }
  mesh('nightshift.ceiling.strip.-5.2', new THREE.BoxGeometry(.43, .065, 16)).position.set(-5.2, 6.35, 1)
  mesh('nightshift.ceiling.strip.5.2', new THREE.BoxGeometry(.43, .065, 16)).position.set(5.2, 6.35, 1)
  mesh('nightshift.ceiling.rear-strip', new THREE.BoxGeometry(10.83, .065, .43)).position.set(0, 6.35, -7)
  return root
}

describe('NIGHTSHIFT sustained choreography regression', () => {
  it('keeps the module clock moving through analysis gaps, revisions and audio rejection, then holds on pause', () => {
    const clock = vi.spyOn(Cinema2BeatClock.prototype, 'update')
    const instance = cinema2NightshiftNativeModuleDefinition.create({ module: manifest.modules![0] } as Cinema2ModuleCreateContext)
    let upstream = nightshiftMusicFixture({ timeSec: 0, frameId: 1 })
    const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => upstream,
      getPublicationMeta: () => ({ sequence: upstream.frameId, publisherId: 'regression', kind: 'frame', publishedAtMs: 0 }) })
    const update = (i: number, paused = false, stopped = false) => {
      upstream = { ...nightshiftMusicFixture({ timeSec: i / 30, frameId: i + 1 }), analysisRevision: `revision-${i}`, timelineRevision: `timeline-${i}` }
      const audio = bridge.capture(i + 1)
      const frame: Cinema2ModuleFrameReadContext = { frameId: i + 1, timestampMs: i / 30 * 1000, elapsedTimeSec: 0, deltaTimeSec: 0,
        contextGeneration: 1, viewport: { width: 1280, height: 720, dpr: 1 }, audio: i > 0 && i % 10 === 0 ? null : audio, director: null,
        transport: { sourcePresent: true, trackId: upstream.trackId, timeSec: i / 30, playing: !paused && !stopped, paused, analysisActive: stopped, animationActive: stopped } }
      instance.lifecycle.update({ frame, parameters, targets: {} as Cinema2ModuleCreateContext['targets'] })
      return clock.mock.results.at(-1)!.value.beats as number
    }
    try {
      update(0)
      let beats = 0
      for (let i = 1; i <= 1800; i++) {
        const next = update(i)
        expect(next).toBeGreaterThan(beats)
        beats = next
      }
      expect(beats).toBeGreaterThan(110)
      expect(update(1801, true)).toBe(beats)
      expect(update(1802, false, true)).toBe(beats)
      expect(update(1803)).toBeGreaterThan(beats)
    } finally { instance.lifecycle.dispose(); clock.mockRestore() }
  })

  it('animates all ceiling rails with spatial programs and audio, with 3x floor output and authoritative zone controls', async () => {
    const controller = new Cinema2NightshiftSceneController(await loadCinema2ThreeLibrary())
    const root = installation()
    controller.attach(root)
    const floor = root.getObjectByName('nightshift.floor.panels-instanced') as THREE.InstancedMesh
    const rails = root.children.filter(o => o.name.endsWith('-segments')) as THREE.InstancedMesh[]
    expect(rails).toHaveLength(3)
    const frame: NightshiftSceneFrame = { controls: readNightshiftControls(parameters), phase: 0, angle: 0, pattern: 'runway',
      outgoingPattern: null, blend: 1, music: { ...NIGHTSHIFT_MUSIC_TARGET_DEFAULTS }, glintPhase: 0 }
    const signature = () => rails.map(r => Array.from(r.instanceColor!.array))
    controller.apply(frame)
    const initial = signature()
    controller.apply({ ...frame, phase: 120 })
    const late = signature()
    controller.apply({ ...frame, phase: 121 })
    const later = signature()
    expect(late).not.toEqual(later)
    expect(initial).not.toEqual(later)
    expect(new Set(later.flat().map(v => v.toFixed(4))).size).toBeGreaterThan(10)
    controller.apply({ ...frame, phase: 121, music: { ...frame.music, musicKick: 1, musicKickTravel: .5, musicSnare: 1, musicBuild: .8 } })
    expect(signature()).not.toEqual(later)
    const patterns = CINEMA2_NIGHTSHIFT_PATTERNS.map(p => {
      controller.apply({ ...frame, phase: 2.5, pattern: p.value })
      return JSON.stringify(signature())
    })
    expect(new Set(patterns).size).toBe(8)
    // Inspect the actual material hook that supplies the shader's zone gains.
    const uniforms = (mesh: THREE.InstancedMesh) => {
      const shader = { uniforms: {}, fragmentShader: '#include <opaque_fragment>\n#include <emissivemap_fragment>' } as THREE.WebGLProgramParametersWithUniforms
      ;(mesh.material as THREE.MeshStandardMaterial).onBeforeCompile(shader, {} as THREE.WebGLRenderer)
      return shader.uniforms
    }
    const floorUniforms = uniforms(floor), ceilingUniforms = uniforms(rails[0])
    controller.apply(frame)
    expect(floorUniforms.uNightshiftZone.value).toBeCloseTo(3)
    controller.apply({ ...frame, controls: { ...frame.controls, floor: 0, ceiling: 0 } })
    expect(floorUniforms.uNightshiftZone.value).toBe(0)
    expect(ceilingUniforms.uNightshiftZone.value).toBe(0)
    controller.apply({ ...frame, controls: { ...frame.controls, master: 0 } })
    expect(floorUniforms.uNightshiftMaster.value).toBe(0)
    controller.dispose()
    expect(root.getObjectByName(rails[0].name)).toBeUndefined()
  })
})
