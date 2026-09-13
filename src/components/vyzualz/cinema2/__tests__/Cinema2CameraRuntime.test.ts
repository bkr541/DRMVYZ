import { describe, expect, it } from 'vitest'

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2AudioIntelligenceFrame } from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { createCinema2InspectorModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'

const CAMERA_ID = cinema2StableId<Cinema2CameraId>('main-camera')
const TARGET_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('camera-target')
const POSITION_OFFSET_ID = cinema2StableId<Cinema2ParameterId>('camera-position-offset')
const FOV_ID = cinema2StableId<Cinema2ParameterId>('camera-fov')
const ORBIT_RADIUS_ID = cinema2StableId<Cinema2ParameterId>('camera-orbit-radius')
const ORBIT_AZIMUTH_ID = cinema2StableId<Cinema2ParameterId>('camera-orbit-azimuth')
const ORBIT_ELEVATION_ID = cinema2StableId<Cinema2ParameterId>('camera-orbit-elevation')
const SMOOTHING_ID = cinema2StableId<Cinema2ParameterId>('camera-smoothing')

function baseManifest(name: string): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(`drmvyz.cinema2.${name}`),
    revision: 1,
    metadata: { name },
    parameters: [
      { id: POSITION_OFFSET_ID, label: 'Position Offset', type: 'vec3', defaultValue: [0, 0, 0] },
      { id: FOV_ID, label: 'FOV', type: 'float', defaultValue: 60, min: 1, max: 179 },
      { id: ORBIT_RADIUS_ID, label: 'Orbit Radius', type: 'float', defaultValue: 10, min: 1, max: 50 },
      { id: ORBIT_AZIMUTH_ID, label: 'Orbit Azimuth', type: 'float', defaultValue: 0, min: -360, max: 360 },
      { id: ORBIT_ELEVATION_ID, label: 'Orbit Elevation', type: 'float', defaultValue: 0, min: -89, max: 89 },
      { id: SMOOTHING_ID, label: 'Smoothing', type: 'float', defaultValue: 0, min: 0, max: 5000 },
    ],
    scene: {
      nodes: [{ id: TARGET_NODE_ID, kind: 'group', coordinateSpace: 'world', transform: { position: [2, 0, 0] } }],
      roots: [cinema2Ref(TARGET_NODE_ID)],
    },
  }
}

function compileRuntime(manifest: Cinema2NativePresetManifest) {
  const compiled = compileCinema2NativePreset(manifest)
  expect(compiled.ok).toBe(true)
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(entry => entry.message).join('; '))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
  })
  const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
  const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial)
  return { plan: compiled.plan, state, resolver, spatial, camera }
}

function frame(
  elapsedTimeSec: number,
  deltaTimeSec = 1 / 60,
  viewport = { width: 800, height: 400, dpr: 1 },
  audio: Readonly<Cinema2AudioIntelligenceFrame> | null = null,
): Cinema2ModuleFrameReadContext {
  return {
    frameId: Math.max(1, Math.round(elapsedTimeSec * 60) + 1),
    timestampMs: elapsedTimeSec * 1000,
    deltaTimeSec,
    elapsedTimeSec,
    viewport,
    contextGeneration: 1,
    audio,
    director: null,
  }
}

function discontinuityFrame(): Readonly<Cinema2AudioIntelligenceFrame> {
  return {
    discontinuity: { occurred: true, reason: 'seek' },
  } as unknown as Readonly<Cinema2AudioIntelligenceFrame>
}

describe('Cinema 2.0 Stage 12B final Camera Runtime', () => {
  it('targets Scene Graph identity and composes bounded user controls with choreography before final projection', () => {
    const manifest = baseManifest('camera-orbit-runtime')
    manifest.cameras = [{
      id: CAMERA_ID,
      label: 'Main Camera',
      projection: 'perspective',
      targetNode: cinema2Ref(TARGET_NODE_ID),
      fovDegrees: 50,
      near: 0.1,
      far: 500,
      rig: { kind: 'orbit', radius: 10, azimuthDegrees: 0, elevationDegrees: 0 },
      controls: {
        positionOffset: cinema2Ref(POSITION_OFFSET_ID),
        fovDegrees: cinema2Ref(FOV_ID),
        orbitRadius: cinema2Ref(ORBIT_RADIUS_ID),
        orbitAzimuthDegrees: cinema2Ref(ORBIT_AZIMUTH_ID),
        orbitElevationDegrees: cinema2Ref(ORBIT_ELEVATION_ID),
      },
      safety: { maxPositionOffset: [1, 1, 1], minPosition: [-20, -20, -20], maxPosition: [20, 20, 20] },
    }]
    manifest.defaults = { camera: cinema2Ref(CAMERA_ID) }
    const { plan, state, resolver, camera } = compileRuntime(manifest)

    expect(state.setPersistentValue(POSITION_OFFSET_ID, [9, 0, 0]).ok).toBe(true)
    expect(state.setPersistentValue(FOV_ID, 75).ok).toBe(true)
    const positionTarget = plan.targets.targets.find(target => target.kind === 'camera' && target.ownerId === CAMERA_ID && target.property === 'transform.position')
    expect(positionTarget).toBeDefined()
    if (!positionTarget) return
    expect(resolver.replaceTransientContributions('choreography', [{
      targetId: positionTarget.id,
      contribution: { contributorId: 'choreography:camera-impulse', operation: 'add', value: [0, 2, 0] },
    }])).toMatchObject({ applied: true })

    const result = camera.update(frame(0))
    expect(result.target).toEqual([2, 0, 0])
    expect(result.position.map(value => Number(value.toFixed(6)))).toEqual([3, 2, 10])
    expect(result.fovDegrees).toBe(75)
    expect(result.aspect).toBe(2)
    expect(result.projectionMatrix[0]).toBeCloseTo(result.projectionMatrix[5] / 2)
    expect(result.corrected).toBe(false)
  })

  it('supports authored path/fly timing and authored transition ordering', () => {
    const manifest = baseManifest('camera-path-runtime')
    manifest.cameras = [{
      id: CAMERA_ID,
      label: 'Path Camera',
      projection: 'perspective',
      target: [0, 0, 0],
      rig: {
        kind: 'path',
        durationSeconds: 10,
        points: [
          { position: [0, 0, 10], target: [0, 0, 0], fovDegrees: 50 },
          { position: [10, 0, 10], target: [0, 0, 0], fovDegrees: 70 },
        ],
      },
      transition: { durationSeconds: 2, easing: 'linear', fromPosition: [-10, 0, 10], fromFovDegrees: 40 },
    }]
    const { camera } = compileRuntime(manifest)

    const halfwayTransition = camera.update(frame(1))
    expect(halfwayTransition.position[0]).toBeCloseTo(-4.5)
    expect(halfwayTransition.fovDegrees).toBeCloseTo(46)
    const afterTransition = camera.update(frame(5))
    expect(afterTransition.position[0]).toBeCloseTo(5)
    expect(afterTransition.fovDegrees).toBeCloseTo(60)
  })

  it('smooths pose changes but resets interpolation on an audio discontinuity', () => {
    const manifest = baseManifest('camera-smoothing-runtime')
    manifest.cameras = [{
      id: CAMERA_ID,
      label: 'Smooth Camera',
      projection: 'perspective',
      transform: { position: [0, 0, 10] },
      target: [0, 0, 0],
      controls: { positionOffset: cinema2Ref(POSITION_OFFSET_ID), smoothingMs: cinema2Ref(SMOOTHING_ID) },
      safety: { maxPositionOffset: [20, 20, 20] },
    }]
    const { state, camera } = compileRuntime(manifest)
    expect(state.setPersistentValue(SMOOTHING_ID, 1000).ok).toBe(true)
    camera.update(frame(0, 0))
    expect(state.setPersistentValue(POSITION_OFFSET_ID, [10, 0, 0]).ok).toBe(true)

    const smoothed = camera.update(frame(0.1, 0.1))
    expect(smoothed.position[0]).toBeGreaterThan(0)
    expect(smoothed.position[0]).toBeLessThan(10)
    const reset = camera.update(frame(0.2, 0.1, { width: 800, height: 400, dpr: 1 }, discontinuityFrame()))
    expect(reset.position[0]).toBeCloseTo(10)
    expect(camera.getSnapshot().resetCount).toBe(1)
  })

  it('shows a schema-driven Camera section only for declared exposed camera controls', () => {
    const manifest = baseManifest('camera-inspector-runtime')
    manifest.cameras = [{
      id: CAMERA_ID,
      label: 'Inspector Camera',
      projection: 'perspective',
      controls: { fovDegrees: cinema2Ref(FOV_ID), positionOffset: cinema2Ref(POSITION_OFFSET_ID) },
    }]
    const withControls = compileRuntime(manifest)
    expect(createCinema2InspectorModel(withControls.plan, withControls.state.getSnapshot(), 'design').map(section => section.label)).toContain('Camera')

    const withoutControlsManifest = baseManifest('camera-inspector-hidden')
    const inactiveCameraId = cinema2StableId<Cinema2CameraId>('inactive-camera')
    withoutControlsManifest.cameras = [
      { id: CAMERA_ID, label: 'Active Camera', projection: 'perspective' },
      { id: inactiveCameraId, label: 'Inactive Camera', projection: 'perspective', controls: { fovDegrees: cinema2Ref(FOV_ID) } },
    ]
    withoutControlsManifest.defaults = { camera: cinema2Ref(CAMERA_ID) }
    const withoutControls = compileRuntime(withoutControlsManifest)
    expect(createCinema2InspectorModel(withoutControls.plan, withoutControls.state.getSnapshot(), 'design').map(section => section.label)).not.toContain('Camera')
  })

  it('rejects malformed path rigs and camera control type mismatches at compile time', () => {
    const manifest = baseManifest('camera-invalid-authoring')
    manifest.cameras = [{
      id: CAMERA_ID,
      label: 'Invalid Camera',
      projection: 'perspective',
      rig: { kind: 'path', durationSeconds: 0, points: [{ position: [0, 0, 1] }] },
      controls: { positionOffset: cinema2Ref(FOV_ID) },
    }]
    const result = compileCinema2NativePreset(manifest)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PRESET_CAMERA_RIG_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PRESET_CAMERA_CONTROL_TYPE_MISMATCH' }),
    ]))
  })
})
