import { describe, expect, it } from 'vitest'
import type { Cinema2ModuleManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_ATL_HOE_ASSET_ID, cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import {
  CINEMA2_ATL_HOE_CAMERA_ID,
  CINEMA2_ATL_HOE_PRESET_ID,
  CINEMA2_ATL_HOE_PRESET_MANIFEST,
} from '../presets/Cinema2AtlHoePreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import {
  CINEMA2_ATL_HOE_CAPTURE_TIME_SEC,
  CINEMA2_ATL_HOE_RANDOM_SEED,
  createCinema2AtlHoeVisualAcceptanceMetadata,
} from '../../../../test/browser/Cinema2AtlHoeVisualAcceptanceConfig'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] as const
const manifest = CINEMA2_ATL_HOE_PRESET_MANIFEST
const module = manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>

describe('ATL HOE preset', () => {
  it('is a visible first-party keeper named ATL HOE and passes the native authoring/compiler gates', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_ATL_HOE_PRESET_ID)
    expect(declaration).toMatchObject({ role: 'keeper' })
    expect(manifest.metadata.name).toBe('ATL HOE')
    expect(manifest.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))
    expect(compiled.plan.render.passes.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen', 'fullscreen'])
    expect(cinema2NativePresetRegistry.get(CINEMA2_ATL_HOE_PRESET_ID)).not.toBeNull()
  })

  it('renders the shipped 3D sign, sky, skyline silhouettes and foliage without the window, crown or road parts', () => {
    expect(module.typeId).toBe('three-scene')
    expect(module.config?.instances).toEqual([{ asset: CINEMA2_ATL_HOE_ASSET_ID, node: 'atl-hoe-model' }])
    expect(cinema2ThreeAssetRegistry.has(CINEMA2_ATL_HOE_ASSET_ID)).toBe(true)
    expect(module.config?.parts).toEqual(expect.arrayContaining([
      'stars',
      'landmarkDark',
      'landmarkGlass',
      'distantBuildings',
      'midBuildings',
      'nearBuildings',
      'signMetal',
      'signGlow',
      'signBorder',
      'signLetters',
      'foliageBack',
      'foliage',
    ]))
    expect(module.config?.parts).not.toEqual(expect.arrayContaining([
      'warmWindows',
      'cyanWindows',
      'crown',
      'road',
      'roadGlow',
    ]))
    expect(module.parameters).toMatchObject({
      'signGlow.emissiveIntensity': 1.25,
      'crown.emissiveIntensity': 3.1,
      'warmWindows.emissiveIntensity': 1.45,
      'cyanWindows.emissiveIntensity': 2.1,
    })
  })

  it('uses a locked world camera and a depth-aware night finish without audio choreography', () => {
    expect(manifest.cameras).toEqual([expect.objectContaining({
      id: CINEMA2_ATL_HOE_CAMERA_ID,
      projection: 'perspective',
      rig: { kind: 'static' },
      minAspect: 16 / 9,
    })])
    expect(manifest.effects?.map(effect => effect.typeId)).toEqual([
      'volumetric-atmosphere',
      'hdr-bloom',
      'cinematic-finish',
    ])
    expect(manifest.environment?.fog).toMatchObject({ mode: 'exponential', density: 0.008 })
    expect(manifest.choreography).toBeUndefined()
  })

  it('pins the Phase 0 visual-acceptance camera, effects, asset record and deterministic capture state', () => {
    const primary = createCinema2AtlHoeVisualAcceptanceMetadata({
      checkpoint: 'before-primary-16x9-high',
      viewport: { width: 1920, height: 1080 },
      quality: 'high',
    })
    const embedded = createCinema2AtlHoeVisualAcceptanceMetadata({
      checkpoint: 'before-embedded-stage-tall-high',
      viewport: { width: 1000, height: 1200 },
      quality: 'high',
    })

    expect(primary.preset).toMatchObject({ id: CINEMA2_ATL_HOE_PRESET_ID, name: 'ATL HOE', revision: manifest.revision })
    expect(primary.asset).toMatchObject({ id: CINEMA2_ATL_HOE_ASSET_ID })
    expect(primary.capture).toMatchObject({
      visualTimeSec: CINEMA2_ATL_HOE_CAPTURE_TIME_SEC,
      randomSeed: CINEMA2_ATL_HOE_RANDOM_SEED,
      deviceScaleFactor: 1,
      quality: 'high',
    })
    expect(primary.camera).toMatchObject({ id: CINEMA2_ATL_HOE_CAMERA_ID, fovDegrees: 42 })
    expect(primary.camera.aspectPolicy).toMatchObject({ fitMode: 'hold-vertical-fov', expectedResolvedFovDegrees: 42 })
    expect(embedded.camera.aspectPolicy.fitMode).toBe('fit-width')
    expect(embedded.camera.aspectPolicy.expectedResolvedFovDegrees).toBeGreaterThan(42)
    expect(primary.environment).toEqual(manifest.environment)
    expect(primary.effects.map(effect => effect.typeId)).toEqual([
      'volumetric-atmosphere',
      'hdr-bloom',
      'cinematic-finish',
    ])
  })
})
