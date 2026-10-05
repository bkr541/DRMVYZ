import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_ASSET_RECORDS } from '../../components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated'
import {
  CINEMA2_ATL_HOE_PRESET_MANIFEST,
} from '../../components/vyzualz/cinema2/presets/Cinema2AtlHoePreset'
import { CINEMA2_ATL_HOE_ASSET_ID } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetManifest'
import { fitCinema2FovToMinAspect } from '../../components/vyzualz/cinema2/spatial/Cinema2CameraRuntime'

export const CINEMA2_ATL_HOE_VISUAL_ACCEPTANCE_SCHEMA_VERSION = 1 as const
export const CINEMA2_ATL_HOE_CAPTURE_TIME_SEC = 2 as const
export const CINEMA2_ATL_HOE_RANDOM_SEED = 'atl-hoe-phase-zero' as const

export interface Cinema2AtlHoeVisualAcceptanceViewport {
  width: number
  height: number
}

export interface Cinema2AtlHoeVisualAcceptanceMetadataInput {
  checkpoint: string
  viewport: Readonly<Cinema2AtlHoeVisualAcceptanceViewport>
  quality: Cinema2RenderQualityLevel
}

/**
 * Produces the authored half of the Phase 0 capture record. Runtime-resolved
 * camera and renderer diagnostics are appended by the browser harness after
 * the fixed-time frame has rendered.
 */
export function createCinema2AtlHoeVisualAcceptanceMetadata(
  input: Readonly<Cinema2AtlHoeVisualAcceptanceMetadataInput>,
) {
  const manifest = CINEMA2_ATL_HOE_PRESET_MANIFEST
  const defaultCameraId = manifest.defaults?.camera?.$ref
  if (!defaultCameraId) throw new Error('ATL HOE visual acceptance requires a default camera reference.')
  const camera = manifest.cameras?.find(candidate => candidate.id === defaultCameraId)
  if (!camera) throw new Error('ATL HOE visual acceptance requires its authored default camera.')
  const asset = CINEMA2_ASSET_RECORDS.find(record => record.id === CINEMA2_ATL_HOE_ASSET_ID)
  if (!asset) throw new Error('ATL HOE visual acceptance requires its generated asset record.')

  const aspect = input.viewport.width / input.viewport.height
  return Object.freeze({
    schemaVersion: CINEMA2_ATL_HOE_VISUAL_ACCEPTANCE_SCHEMA_VERSION,
    checkpoint: input.checkpoint,
    preset: Object.freeze({
      id: manifest.id,
      name: manifest.metadata.name,
      revision: manifest.revision,
    }),
    asset: Object.freeze({
      id: asset.id,
      files: asset.files,
      gpuBytes: asset.gpuBytes,
    }),
    capture: Object.freeze({
      width: input.viewport.width,
      height: input.viewport.height,
      aspect,
      quality: input.quality,
      deviceScaleFactor: 1,
      visualTimeSec: CINEMA2_ATL_HOE_CAPTURE_TIME_SEC,
      randomSeed: CINEMA2_ATL_HOE_RANDOM_SEED,
    }),
    camera: Object.freeze({
      id: camera.id,
      projection: camera.projection,
      transform: camera.transform,
      target: camera.target,
      fovDegrees: camera.fovDegrees,
      near: camera.near,
      far: camera.far,
      aspectPolicy: Object.freeze({
        authoredMinAspect: camera.minAspect ?? null,
        captureAspect: aspect,
        fitMode: camera.minAspect != null && aspect < camera.minAspect ? 'fit-width' : 'hold-vertical-fov',
        expectedResolvedFovDegrees: fitCinema2FovToMinAspect(camera.fovDegrees ?? 50, aspect, camera.minAspect),
      }),
      rig: camera.rig,
    }),
    environment: manifest.environment,
    effects: Object.freeze((manifest.effects ?? []).map(effect => Object.freeze({
      id: effect.id,
      typeId: effect.typeId,
      enabled: effect.enabled !== false,
      order: effect.order,
      parameters: effect.parameters ?? Object.freeze({}),
    }))),
  })
}
