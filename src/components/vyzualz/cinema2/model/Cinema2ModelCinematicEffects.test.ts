import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2ModelCinematicMaterials, CINEMA2_MODEL_MATERIAL_STYLES, CINEMA2_MODEL_LOOKS } from './Cinema2ModelCinematicMaterials'
import { Cinema2ModelCinematicStage, createCinema2Helix } from './Cinema2ModelCinematicStage'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'
const library = { THREE } as unknown as Cinema2ThreeLibrary
const read = (values: Record<string, Cinema2JsonValue>): Cinema2ModuleParameterReadFacet => ({ get: key => values[key], getAuthored: key => values[key], resolve: () => null })

describe('cinematic model lighting and effects', () => {
  it.each(CINEMA2_MODEL_MATERIAL_STYLES)('applies and reverses %s without replacing original maps', style => {
    const root = new THREE.Group(), texture = new THREE.Texture(), original = new THREE.MeshPhysicalMaterial({ color: 0x884422, roughness: .61, metalness: .15, map: texture, clearcoat: .08 })
    const clone = original.clone(), geometry = new THREE.SphereGeometry(1,16,12), mesh = new THREE.Mesh(geometry, clone); root.add(mesh)
    const controller = new Cinema2ModelCinematicMaterials(library, root), old = original.color.clone(), originalVersion = clone.version
    controller.apply(read({ cinematicMaterial:style,cinematicRim:1 }), 0)
    expect(clone.map).toBe(texture); expect(original.color.equals(old)).toBe(true)
    if (style === 'glass' || style === 'holographic') expect(clone.opacity).toBeLessThan(1)
    if (style === 'neon') expect(clone.emissiveIntensity).toBeGreaterThan(1)
    if (style === 'chrome' || style === 'gold' || style === 'blackChrome') expect(clone.metalness).toBeGreaterThan(.9)
    controller.restore(); controller.apply(read({ cinematicMaterial:style,cinematicRim:1 }), 1)
    expect(clone.version).toBeGreaterThanOrEqual(originalVersion)
    controller.restore(); controller.apply(read({ cinematicMaterial:'original' }), 2)
    expect(clone.color.equals(old)).toBe(true); expect(clone.roughness).toBeCloseTo(.61); expect(clone.clearcoat).toBeCloseTo(.08); expect(clone.opacity).toBe(1)
    const dispose = vi.spyOn(texture,'dispose'); controller.dispose(); expect(dispose).not.toHaveBeenCalled()
    geometry.dispose(); clone.dispose(); original.dispose(); texture.dispose()
  })
  it.each([new THREE.BoxGeometry(1,1,1),new THREE.SphereGeometry(1,16,12)])('composes Fresnel with prior shader hooks on actual mesh materials', geometry => {
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial(), prior = vi.fn(); material.onBeforeCompile = prior
    root.add(new THREE.Mesh(geometry,material)); const c = new Cinema2ModelCinematicMaterials(library,root)
    c.apply(read({ cinematicRim:2,cinematicRimWidth:2,cinematicRimFalloff:4 }),0)
    const shader = { uniforms: {}, fragmentShader:'#include <opaque_fragment>',vertexShader:'' }
    material.onBeforeCompile(shader as never, {} as never)
    expect(prior).toHaveBeenCalled(); expect(shader.fragmentShader).toContain('dot(normalize(normal), normalize(vViewPosition))'); expect(shader.uniforms).toMatchObject({ c2CinemaRim:{value:2},c2CinemaPower:{value:2} })
    c.dispose(); expect(material.onBeforeCompile).toBe(prior); geometry.dispose(); material.dispose()
  })
  it('builds real helix geometry, caps quality, animates the independent light and disposes buffers', () => {
    const geometry = createCinema2Helix(THREE,1,3,96,.02); expect(geometry.attributes.position.count).toBe((96+1)*7); geometry.dispose()
    const root = new THREE.Group(), stage = new Cinema2ModelCinematicStage(library,root)
    const values = read({ cinematicHelix:true,cinematicHelixSegments:512,cinematicAccentIntensity:5,cinematicLightMotion:'orbit',cinematicLightSpeed:2 })
    stage.update(values,0,'low'); const group = root.getObjectByName('CinematicModelStage')!, light = group.children.find(c => (c as THREE.PointLight).isPointLight) as THREE.PointLight, mesh = group.children.find(c => (c as THREE.Mesh).isMesh) as THREE.Mesh
    const initial = light.position.clone(), dispose = vi.spyOn(mesh.geometry,'dispose'); stage.update(values,.1,'low'); expect(light.position.equals(initial)).toBe(false); expect(light.intensity).toBe(5); expect(dispose).not.toHaveBeenCalled()
    stage.update(values,.1,'high'); expect(dispose).toHaveBeenCalledOnce(); const finalDispose = vi.spyOn(mesh.geometry,'dispose'); stage.dispose(); expect(finalDispose).toHaveBeenCalledOnce(); expect(root.children).toHaveLength(0)
  })
  it.each(Object.keys(CINEMA2_USER_MODEL_PREVIEWS) as Cinema2UserModelPreviewKind[])('compiles %s effects in fixed order and persists editable look macros', kind => {
    const preset = createCinema2UserModelPreset(kind), result = compileCinema2NativePreset(preset)
    expect(result.ok).toBe(true); expect(cinema2NativeEffectRegistry.validateEffects(preset.effects!).ok).toBe(true)
    expect(preset.render!.targets![0].descriptor).toMatchObject({colorFormat:'rgba16f',fallbackColorFormat:'rgba8',depthFormat:'depth24'})
    expect(preset.effects!.map(e=>e.typeId)).toEqual(['reflective-floor','volumetric-atmosphere','hdr-bloom','model-optical','cinematic-finish','feedback-trails'])
    if (!result.ok) throw new Error('preset compilation failed')
    const state = new Cinema2ParameterState(result.plan.parameters), id = (key:string)=>cinema2UserModelPreviewParameterId(kind,key)
    for (const look of Object.keys(CINEMA2_MODEL_LOOKS)) expect(state.setPersistentValue(id('cinematicLook'),look).ok).toBe(true)
    expect(state.getValue(id('cinematicMaterial'))).toBe('neon'); expect(state.getValue(id('opticalSymmetry'))).toBe(1)
    expect(state.setPersistentValue(id('opticalTwist'),-2).ok).toBe(true)
    const restored = new Cinema2ParameterState(result.plan.parameters); expect(restored.restore(state.serialize()).ok).toBe(true); expect(restored.getSnapshot().persistentValues).toEqual(state.getSnapshot().persistentValues)
  })
})
