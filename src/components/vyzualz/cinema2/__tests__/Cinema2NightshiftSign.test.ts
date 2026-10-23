import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Cinema2NightshiftSign } from '../modules/nightshift/Cinema2NightshiftSign'
import { loadCinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { shadeNightshiftMusicCell, type NightshiftSceneFrame } from '../modules/nightshift/Cinema2NightshiftSceneController'
import { readNightshiftControls, CINEMA2_NIGHTSHIFT_PATTERNS } from '../modules/nightshift/Cinema2NightshiftDomain'
import { NIGHTSHIFT_MUSIC_TARGET_DEFAULTS } from '../modules/nightshift/Cinema2NightshiftAudio'

const frame = (): NightshiftSceneFrame => ({ controls: { ...readNightshiftControls({ get: () => undefined, resolve: () => null, getAuthored: () => undefined }), signs: true },
  phase: 2.5, angle: 0, glintPhase: 0, pattern: 'nightshift', outgoingPattern: null, blend: 1, music: { ...NIGHTSHIFT_MUSIC_TARGET_DEFAULTS } })

describe('NIGHTSHIFT freestanding neon sign', () => {
  it('builds only freestanding outline tubes and scales them about their center', async () => {
    const sign = new Cinema2NightshiftSign(await loadCinema2ThreeLibrary())
    expect(sign.root.visible).toBe(false)
    expect(sign.root.userData.text).toBe('NIGHTSHIFT')
    expect(sign.root.position.z).toBeLessThan(-7.3)
    const letters = sign.root.children.filter(o => o.name.startsWith('nightshift.sign.letter.')) as THREE.Mesh[]
    expect(letters.map(m => m.name.split('.').at(-1)).join('')).toBe('NIGHTSHIFT')
    for (const letter of letters) {
      letter.geometry.computeBoundingBox()
      expect(letter.geometry.boundingBox!.max.z - letter.geometry.boundingBox!.min.z).toBeGreaterThan(.04)
      expect(letter.geometry.getAttribute('normal').count).toBeGreaterThan(100)
    }
    expect(sign.root.children).toHaveLength(10)
    expect(sign.root.children.every(o => o.name.startsWith('nightshift.sign.letter.'))).toBe(true)
    const f = frame(), center = sign.root.position.clone()
    const sizes = [.25, 1, 2].map(signSize => {
      sign.apply({ ...f, controls: { ...f.controls, signSize } }, shadeNightshiftMusicCell)
      sign.root.updateMatrixWorld(true)
      expect(sign.root.position.equals(center)).toBe(true)
      return new THREE.Box3().setFromObject(sign.root).getSize(new THREE.Vector3())
    })
    expect(sizes[2].x / sizes[1].x).toBeCloseTo(2)
    expect(sizes[1].x / sizes[0].x).toBeCloseTo(4)
    expect(sizes[2].z / sizes[1].z).toBeCloseTo(2)
    sign.dispose()
  })

  it('performs spatial choreography, audio accents and pattern crossfades through tube buffers', async () => {
    const sign = new Cinema2NightshiftSign(await loadCinema2ThreeLibrary()), f = frame()
    const letters = sign.root.children.filter(o => o.name.startsWith('nightshift.sign.letter.')) as THREE.Mesh[]
    const signature = () => JSON.stringify(letters.map(m => Array.from(m.geometry.getAttribute('color').array)))
    const patterns = CINEMA2_NIGHTSHIFT_PATTERNS.map(p => { sign.apply({ ...f, pattern: p.value }, shadeNightshiftMusicCell); return signature() })
    expect(new Set(patterns).size).toBe(8)
    sign.apply(f, shadeNightshiftMusicCell); const neutral = signature()
    sign.apply({ ...f, music: { ...f.music, musicSnare: 1, musicImpact: 1 } }, shadeNightshiftMusicCell)
    expect(signature()).not.toBe(neutral)
    sign.apply({ ...f, pattern: 'runway', outgoingPattern: 'nightshift', blend: 0 }, shadeNightshiftMusicCell)
    expect(signature()).toBe(neutral)
    sign.apply({ ...f, pattern: 'runway', outgoingPattern: 'nightshift', blend: .5 }, shadeNightshiftMusicCell)
    expect(signature()).not.toBe(neutral)
    sign.apply({ ...f, phase: 123 }, shadeNightshiftMusicCell)
    expect(signature()).not.toBe(neutral)
    sign.dispose()
  })

  it('applies the palette to tubes, honors OFF/master zero, and disposes owned resources', async () => {
    const sign = new Cinema2NightshiftSign(await loadCinema2ThreeLibrary()), f = frame()
    const tube = sign.root.children.find(o => o.name.startsWith('nightshift.sign.letter.')) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>
    const geometryDispose = vi.spyOn(tube.geometry, 'dispose'), materialDispose = vi.spyOn(tube.material, 'dispose')
    sign.apply({ ...f, controls: { ...f.controls, colors: { ...f.controls.colors, sign: [1, .1, .25] } } }, shadeNightshiftMusicCell)
    const expected = new THREE.Color().setRGB(1, .1, .25, THREE.SRGBColorSpace)
    expect(tube.material.emissive.equals(expected)).toBe(true)
    sign.apply({ ...f, controls: { ...f.controls, signs: false } }, shadeNightshiftMusicCell)
    expect(sign.root.visible).toBe(false)
    sign.apply({ ...f, controls: { ...f.controls, master: 0 } }, shadeNightshiftMusicCell)
    expect(sign.root.visible).toBe(false)
    sign.dispose()
    expect(geometryDispose).toHaveBeenCalledOnce()
    expect(materialDispose).toHaveBeenCalledOnce()
    expect(sign.root.children).toHaveLength(0)
  })
})
