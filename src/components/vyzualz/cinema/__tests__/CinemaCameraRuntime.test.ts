import { describe, expect, it } from 'vitest'
import {
  CINEMA_CAMERA_PARAMETER_IDS,
  cameraFrameForCapability,
  createCinemaCameraParameterSchemaMap,
  resolveCinemaCameraFrame,
} from '../CinemaCameraRuntime'
import {
  CINEMA_FOUNDATION_COMPOSITION,
  CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
  CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
} from '../CinemaFoundation'
import type { CinemaCompositionDefinition, CinemaCompositionInstance } from '../CinemaDomain'
import type { CinemaCameraId, CinemaCompositionInstanceId } from '../CinemaIdentifiers'
import { createCinemaParameterPath } from '../CinemaIdentifiers'
import type { CinemaFrameContext } from '../CinemaRendererContracts'
import { validateCinemaNodeRegistryEntry } from '../CinemaNodeRegistry'

const CAMERA_ID = 'shared-camera' as CinemaCameraId

function composition(): CinemaCompositionDefinition {
  return {
    ...CINEMA_FOUNDATION_COMPOSITION,
    id: 'camera-runtime-composition' as CinemaCompositionDefinition['id'],
    cameras: [{
      id: CAMERA_ID,
      label: 'Shared Camera',
      mode: 'auto-director',
      parameterValues: {
        [CINEMA_CAMERA_PARAMETER_IDS.position]: [0, 0, 2],
        [CINEMA_CAMERA_PARAMETER_IDS.rotation]: [0, 0, 0],
        [CINEMA_CAMERA_PARAMETER_IDS.target]: [0, 0, 0],
        [CINEMA_CAMERA_PARAMETER_IDS.fovDegrees]: 58,
        [CINEMA_CAMERA_PARAMETER_IDS.near]: 0.1,
        [CINEMA_CAMERA_PARAMETER_IDS.far]: 100,
      },
      safeRange: {
        minPosition: [-2, -1, 0.5],
        maxPosition: [2, 1, 4],
        minFovDegrees: 30,
        maxFovDegrees: 90,
        minNear: 0.01,
        maxFar: 200,
      },
      invalidRegions: [{
        id: 'center-obstruction',
        shape: 'sphere',
        center: [0, 0, 2],
        radius: 0.4,
        fallbackPosition: [0, 0, 2.5],
      }],
      authoredShots: [
        { id: 'verse-orbit', mode: 'orbit', sections: ['verse'], weight: 1, minimumDurationSec: 8, position: [0, 0, 2] },
        { id: 'verse-locked', mode: 'locked', sections: ['verse'], weight: 1, minimumDurationSec: 8, position: [0.5, 0, 2.5] },
        { id: 'drop-dolly', mode: 'dolly', sections: ['drop'], weight: 1, position: [0, 0, 3] },
      ],
    }],
  }
}

describe('CinemaCameraRuntime', () => {
  it('selects the same authored shot for the same musical identity', () => {
    const first = resolveCinemaCameraFrame({ composition: composition(), frame: frame() })
    const second = resolveCinemaCameraFrame({ composition: composition(), frame: frame() })
    const sameWindowFrame = {
      ...frame(),
      timing: { ...frame().timing, seeds: { ...frame().timing.seeds, musicalPosition: 999 } },
      transport: { ...frame().transport, audioTimeSec: frame().transport.audioTimeSec + 1 },
    }
    const sameWindow = resolveCinemaCameraFrame({ composition: composition(), frame: sameWindowFrame })

    expect(first.selectedShotId).not.toBeNull()
    expect(second.selectedShotId).toBe(first.selectedShotId)
    expect(second.camera).toEqual(first.camera)
    expect(sameWindow.selectedShotId).toBe(first.selectedShotId)
  })

  it('falls back deterministically when the requested camera is unavailable', () => {
    const result = resolveCinemaCameraFrame({
      composition: composition(),
      frame: frame(),
      requestedCameraId: 'missing-camera' as CinemaCameraId,
    })

    expect(result.cameraId).toBe(CAMERA_ID)
    expect(result.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_CAMERA_INVALID')).toBe(true)
  })

  it('applies instance overrides and corrects unsafe or invalid positions with diagnostics', () => {
    const instance: CinemaCompositionInstance = {
      id: 'camera-instance' as CinemaCompositionInstanceId,
      compositionId: composition().id,
      label: 'Camera Override',
      revision: 1,
      masterOverrides: {},
      nodeOverrides: [],
      cameraOverrides: [{
        cameraId: CAMERA_ID,
        values: {
          [CINEMA_CAMERA_PARAMETER_IDS.position]: [99, 99, 99],
          [CINEMA_CAMERA_PARAMETER_IDS.fovDegrees]: 180,
        },
      }],
      assetBindingOverrides: [],
    }
    const fixture = composition()
    fixture.cameras = fixture.cameras.map(camera => ({ ...camera, mode: 'locked' }))
    const result = resolveCinemaCameraFrame({ composition: fixture, instance, frame: frame() })

    expect(result.corrected).toBe(true)
    expect(result.camera?.position[0]).toBeLessThanOrEqual(2)
    expect(result.camera?.position[1]).toBeLessThanOrEqual(1)
    expect(result.camera?.position[2]).toBeLessThanOrEqual(4)
    expect(result.camera?.fovDegrees).toBe(90)
    expect(result.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_CAMERA_SAFE_RANGE_CORRECTED')).toBe(true)
  })

  it('moves locked cameras out of authored invalid regions', () => {
    const fixture = composition()
    fixture.cameras = fixture.cameras.map(camera => ({
      ...camera,
      mode: 'locked',
      authoredShots: [],
      parameterValues: {
        ...camera.parameterValues,
        [CINEMA_CAMERA_PARAMETER_IDS.position]: [0, 0, 2],
      },
    }))
    const result = resolveCinemaCameraFrame({ composition: fixture, frame: frame() })

    expect(result.corrected).toBe(true)
    expect(result.camera?.position).toEqual([0, 0, 2.5])
    expect(result.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_CAMERA_SAFE_RANGE_CORRECTED')).toBe(true)
  })

  it('reconstructs authored path motion directly from transport time', () => {
    const fixture = composition()
    fixture.cameras = fixture.cameras.map(camera => ({
      ...camera,
      mode: 'path',
      authoredShots: [],
      path: [
        { position: [-1, 0, 3], fovDegrees: 50 },
        { position: [1, 0.5, 1], fovDegrees: 70 },
      ],
    }))
    const first = resolveCinemaCameraFrame({ composition: fixture, frame: frame() })
    const replay = resolveCinemaCameraFrame({ composition: fixture, frame: frame() })

    expect(first.camera).toEqual(replay.camera)
    expect(first.camera?.position).not.toEqual([0, 0, 2])
    expect(first.camera?.fovDegrees).toBeGreaterThan(50)
  })

  it('fans one shared camera frame to compatible nodes and withholds it from none/nativeCamera nodes', () => {
    const resolved = resolveCinemaCameraFrame({ composition: composition(), frame: frame() })
    const shared = { ...frame(), activeCameraId: resolved.cameraId, camera: resolved.camera }

    expect(cameraFrameForCapability(shared, 'uniformCamera').camera).toBe(resolved.camera)
    expect(cameraFrameForCapability(shared, 'worldCamera').camera).toBe(resolved.camera)
    expect(cameraFrameForCapability(shared, 'none')).toMatchObject({ activeCameraId: null, camera: null })
    expect(cameraFrameForCapability(shared, 'nativeCamera')).toMatchObject({ activeCameraId: null, camera: null })
  })

  it('diagnoses node definitions that mix native camera ownership with shared controls', () => {
    const persisted = CINEMA_FOUNDATION_PERSISTED_DEFINITIONS.find(candidate => candidate.definition.family !== 'output')
    expect(persisted).toBeDefined()
    if (!persisted) return
    const diagnostics = validateCinemaNodeRegistryEntry({
      definition: {
        ...persisted.definition,
        capabilities: {
          ...persisted.definition.capabilities,
          camera: { mode: 'nativeCamera', controls: ['position'], autoDirector: true },
        },
      },
      rendererPlugin: { id: persisted.rendererPluginId, available: true },
      source: persisted.source,
      quality: persisted.quality,
      ...(persisted.feedback ? { feedback: persisted.feedback } : {}),
    })

    expect(diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_CAMERA_CAPABILITY_MISMATCH')).toBe(true)
  })

  it('registers stable camera schemas and consumes resolved transient parameter values', () => {
    const fixture = composition()
    const schemas = createCinemaCameraParameterSchemaMap(fixture)
    const fovPath = createCinemaParameterPath('cameras', CINEMA_CAMERA_PARAMETER_IDS.fovDegrees, CAMERA_ID)
    const resolved = resolveCinemaCameraFrame({
      composition: fixture,
      frame: frame(),
      resolvedParameterValues: { [fovPath]: 72 },
    })

    expect(schemas[CAMERA_ID].some(schema => schema.id === CINEMA_CAMERA_PARAMETER_IDS.fovDegrees)).toBe(true)
    expect(resolved.camera?.fovDegrees).toBe(72)
  })

  it('publishes authored Cinematic Worlds shots as reusable Cinema camera resources', () => {
    expect(CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.cameras).toHaveLength(1)
    const camera = CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.cameras[0]
    expect(camera.mode).toBe('auto-director')
    expect(camera.authoredShots?.length).toBeGreaterThan(0)
    expect(camera.safeRange).toBeDefined()
  })
})

function frame(): Readonly<CinemaFrameContext> {
  const clock = (spanBeats: number) => ({ available: true, spanBeats, index: 4, phase: 0.25, hit: false, eventId: null })
  return {
    version: 1,
    viewport: { width: 320, height: 180, dpr: 1 },
    timing: {
      frameIndex: 120,
      elapsedTimeSec: 2,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 11, track: 22, musicalPosition: 33, event: 44 },
    },
    transport: {
      trackId: 'camera-track',
      audioTimeSec: 12,
      durationSec: 60,
      playing: true,
      paused: false,
      seeking: false,
      looped: false,
      visibilitySuspended: false,
      discontinuity: false,
      discontinuityReasons: [],
      reset: { required: false, reconstruct: false, generation: 0, reasons: [], actionIds: [], identity: null },
    },
    audio: {
      available: true,
      volume: 0.7,
      rms: 0.6,
      energy: 0.65,
      bass: 0.8,
      mid: 0.5,
      high: 0.4,
      sub: 0.75,
      centroid: 0.5,
      flux: 0.3,
      harmonicity: 0.5,
      complexity: 0.4,
      tension: 0.3,
      buildProgress: 0.2,
      dropImpact: 0,
      vocalPresence: 0.1,
      fft: new Uint8Array([0, 64, 128, 255]),
      waveform: new Uint8Array([128, 160, 96, 128]),
    },
    music: {
      available: true,
      source: 'music-intelligence',
      bpm: 150,
      beatIndex: 48,
      beatPhase: 0.25,
      beatInBar: 0,
      barIndex: 12,
      phraseIndex: 3,
      sectionId: 'verse-1',
      sectionType: 'verse',
      sectionProgress: 0.2,
      clocks: {
        beat: false,
        beat2: false,
        beat4: false,
        bar: false,
        bar4: false,
        bar8: false,
        phrase: false,
        states: {
          beat: clock(1), beat2: clock(2), beat4: clock(4), bar: clock(4),
          bar4: clock(16), bar8: clock(32), phrase: clock(32),
        },
      },
    },
    impulses: {
      beat: false,
      downbeat: false,
      kick: false,
      snare: false,
      transient: false,
      sectionStart: false,
      dropStart: false,
      lyricCue: false,
      lyricWord: false,
      phrase4: false,
      phrase8: false,
      eventIds: {
        beat: null, downbeat: null, kick: null, snare: null, transient: null,
        sectionStart: null, dropStart: null, lyricCue: null, lyricWord: null,
        phrase4: null, phrase8: null,
      },
    },
    lyrics: {
      available: false,
      sourceIdentity: null,
      lineId: null,
      lineText: null,
      wordId: null,
      wordText: null,
      lineProgress: 0,
      wordProgress: 0,
      vocalsActive: false,
    },
    performance: { actionIds: [], toggleStates: {} },
    brand: { available: false, colors: {} },
    capabilities: {
      analyser: true,
      musicIntelligence: true,
      beatGrid: true,
      authoritativeSections: true,
      lyrics: false,
      brandKit: false,
      sharedPerformance: true,
      mediaAssets: false,
    },
    activeCameraId: null,
    camera: null,
  }
}
