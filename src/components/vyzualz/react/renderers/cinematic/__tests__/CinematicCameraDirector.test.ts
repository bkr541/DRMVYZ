import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_AUDIO_EVENT_SOURCES,
  CINEMATIC_AUDIO_SOURCES,
  createDefaultCinematicCameraConfig,
} from '../../../CinematicWorldConfig'
import type { ReactSectionType } from '../../../ReactTypes'
import {
  CinematicCameraSystem,
  CinematicShotScheduler,
  interpolateCinematicCameraPose,
  resolveCinematicDirectionSection,
  resolveSupportedCameraRig,
} from '../CinematicCameraDirector'
import type { CinematicNormalizedAudioFrame } from '../CinematicAudioModulation'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'

function audioFrame(overrides: {
  time?: number
  section?: ReactSectionType | null
  sectionSource?: 'manual' | 'analysis' | 'inferred' | 'unknown'
  sectionProgress?: number
  barIndex?: number
  beatIndex?: number
  barStart?: boolean
  beat?: boolean
  energy?: number
  transient?: number
  build?: number
  drop?: number
  playing?: boolean
  resets?: CinematicNormalizedAudioFrame['resetReasons']
} = {}): CinematicNormalizedAudioFrame {
  const values = Object.fromEntries(CINEMATIC_AUDIO_SOURCES.map(source => [source, 0])) as CinematicNormalizedAudioFrame['values']
  const events = Object.fromEntries(CINEMATIC_AUDIO_EVENT_SOURCES.map(source => [source, false])) as CinematicNormalizedAudioFrame['events']
  values.overallEnergy = overrides.energy ?? 0.5
  values.transientIntensity = overrides.transient ?? 0
  values.buildProgress = overrides.build ?? 0
  values.dropState = overrides.drop ?? 0
  events.barStart = overrides.barStart ?? false
  events.downbeat = overrides.barStart ?? false
  events.beat = overrides.beat ?? false
  return {
    frameId: 1,
    sourceId: 'source',
    trackId: 'track',
    transportTimeSec: overrides.time ?? 0,
    isPlaying: overrides.playing ?? true,
    values,
    events,
    timing: {
      bpm: 120,
      beatPhase: 0,
      beatIndex: overrides.beatIndex ?? 0,
      beatInBar: 0,
      barIndex: overrides.barIndex ?? 0,
      barPosition: 0,
      phraseProgress: 0,
    },
    section: {
      type: overrides.section ?? null,
      label: overrides.section ?? '',
      startSec: 0,
      endSec: 32,
      progress: overrides.sectionProgress ?? 0,
      intensity: 0.5,
      confidence: 0.8,
      source: overrides.sectionSource ?? 'unknown',
    },
    capabilities: {
      musicIntelligence: true,
      broadBands: true,
      detailedBands: true,
      transientEvents: true,
      kickEvents: true,
      snareEvents: true,
      beatTiming: true,
      downbeatTiming: true,
      barTiming: true,
      phraseTiming: true,
      sectionTiming: overrides.section != null,
      buildProgress: true,
      dropState: true,
      trackEnergyCurve: false,
      vocalEnergy: false,
    },
    resetReasons: overrides.resets ?? [],
  }
}

const direction = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked', 'dolly', 'orbit', 'flyThrough', 'handheld', 'autoDirector'],
  shots: [
    { id: 'verse-a', rig: 'orbit', sections: ['verse'], action: 'orbit' },
    { id: 'verse-b', rig: 'dolly', sections: ['verse'], action: 'approach' },
    { id: 'verse-c', rig: 'locked', sections: ['verse'], action: 'hold' },
    { id: 'build', rig: 'dolly', sections: ['build', 'preDrop'], action: 'approach' },
    { id: 'drop', rig: 'flyThrough', sections: ['drop'], action: 'reveal' },
    { id: 'fallback', rig: 'locked', sections: ['intro', 'breakdown', 'outro', 'unknown'], action: 'establish' },
  ],
  dropActions: ['impact', 'reveal'],
  revealActions: ['reveal'],
  retreatActions: ['retreat'],
  flyThroughPaths: [[
    { position: { x: 0, y: 0, z: 4 } },
    { position: { x: 0.4, y: 0.1, z: 0.6 }, rotation: { z: 0.08 } },
  ]],
})

function updateCamera(
  system: CinematicCameraSystem,
  audio: CinematicNormalizedAudioFrame,
  requestedRig: 'locked' | 'dolly' | 'orbit' | 'flyThrough' | 'handheld' | 'autoDirector' = 'autoDirector',
  camera = createDefaultCinematicCameraConfig(),
  worldId = 'test-world',
  deltaTimeSec = 1 / 60,
) {
  return system.update({
    worldId,
    direction,
    requestedRig,
    camera,
    audio,
    transportTimeSec: audio.transportTimeSec,
    deltaTimeSec,
    isPlaying: audio.isPlaying,
    seed: 1234,
  })
}

describe('CinematicCameraDirector', () => {
  it('interpolates camera poses without overshoot', () => {
    const pose = interpolateCinematicCameraPose(
      { position: { x: 0, y: 0, z: 1 }, rotation: { x: 0, y: 0, z: 0 }, fieldOfView: 40 },
      { position: { x: 2, y: 4, z: 5 }, rotation: { x: 1, y: 2, z: 3 }, fieldOfView: 80 },
      0.5,
    )
    expect(pose.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(pose.rotation).toEqual({ x: 0.5, y: 1, z: 1.5 })
    expect(pose.fieldOfView).toBe(60)
  })

  it('selects supported rigs and safely falls back from unsupported rigs', () => {
    expect(resolveSupportedCameraRig('orbit', ['locked', 'orbit'])).toEqual({ rig: 'orbit', usedFallback: false })
    expect(resolveSupportedCameraRig('flyThrough', ['locked', 'orbit'])).toEqual({ rig: 'locked', usedFallback: true })
  })

  it('distinguishes analyzed sections from conservative inferred fallback sections', () => {
    expect(resolveCinematicDirectionSection(audioFrame({ section: 'build', sectionSource: 'analysis' })).source).toBe('analyzed')
    const inferred = resolveCinematicDirectionSection(audioFrame({ time: 48, section: null, build: 0.9, barIndex: 12 }))
    expect(inferred.source).toBe('inferred')
    expect(inferred.type).toBe('preDrop')
  })

  it('schedules the same shot deterministically for the same seed and timing', () => {
    const config = createDefaultCinematicCameraConfig().autoDirector
    const input = {
      worldId: 'world', direction, section: resolveCinematicDirectionSection(audioFrame({ section: 'verse', sectionSource: 'analysis' })),
      audio: audioFrame({ section: 'verse', sectionSource: 'analysis' }), config, seed: 77, transportTimeSec: 8,
    }
    expect(new CinematicShotScheduler().update(input).shot.id).toBe(new CinematicShotScheduler().update(input).shot.id)
  })

  it('respects minimum shot duration even on musical boundaries', () => {
    const scheduler = new CinematicShotScheduler()
    const config = { ...createDefaultCinematicCameraConfig().autoDirector, minimumShotDurationSec: 8 }
    const firstAudio = audioFrame({ time: 8, section: 'verse', sectionSource: 'analysis', barStart: true })
    const section = resolveCinematicDirectionSection(firstAudio)
    const first = scheduler.update({ worldId: 'world', direction, section, audio: firstAudio, config, seed: 4, transportTimeSec: 8 })
    const earlyAudio = audioFrame({ time: 12, section: 'verse', sectionSource: 'analysis', barStart: true, barIndex: 4 })
    const early = scheduler.update({ worldId: 'world', direction, section, audio: earlyAudio, config, seed: 4, transportTimeSec: 12 })
    expect(early.shot.id).toBe(first.shot.id)
    expect(early.changed).toBe(false)
  })

  it('avoids immediate repeats when alternatives exist', () => {
    const scheduler = new CinematicShotScheduler()
    const config = { ...createDefaultCinematicCameraConfig().autoDirector, minimumShotDurationSec: 1, repeatAvoidance: 2 }
    const firstAudio = audioFrame({ time: 8, section: 'verse', sectionSource: 'analysis', barStart: true })
    const section = resolveCinematicDirectionSection(firstAudio)
    const first = scheduler.update({ worldId: 'world', direction, section, audio: firstAudio, config, seed: 9, transportTimeSec: 8 })
    const nextAudio = audioFrame({ time: 12, section: 'verse', sectionSource: 'analysis', barStart: true, barIndex: 4 })
    const next = scheduler.update({ worldId: 'world', direction, section, audio: nextAudio, config, seed: 9, transportTimeSec: 12 })
    expect(next.shot.id).not.toBe(first.shot.id)
  })

  it('honors manual override while Auto Director is selected', () => {
    const system = new CinematicCameraSystem()
    const camera = createDefaultCinematicCameraConfig()
    camera.autoDirector.manualOverrideRig = 'handheld'
    expect(updateCamera(system, audioFrame({ time: 20, section: 'verse', sectionSource: 'analysis' }), 'autoDirector', camera).rig).toBe('handheld')
  })

  it('switches worlds without retaining the previous Auto Director shot', () => {
    const system = new CinematicCameraSystem()
    const first = updateCamera(system, audioFrame({ time: 20, section: 'drop', sectionSource: 'analysis' }), 'autoDirector', undefined, 'world-a')
    const second = updateCamera(system, audioFrame({ time: 20, section: 'verse', sectionSource: 'analysis', resets: ['worldReplacement'] }), 'autoDirector', undefined, 'world-b')
    expect(first.shotId).not.toBe(second.shotId)
    expect(second.sectionType).toBe('verse')
  })

  it('recovers from seeking without retaining a stale section', () => {
    const system = new CinematicCameraSystem()
    updateCamera(system, audioFrame({ time: 80, section: 'drop', sectionSource: 'analysis' }))
    const afterSeek = updateCamera(system, audioFrame({ time: 8, section: 'intro', sectionSource: 'analysis', resets: ['seek'] }))
    expect(afterSeek.sectionType).toBe('intro')
    expect(afterSeek.shotId).toBe('fallback')
  })

  it('resets safely on transport restart at the beginning of a track', () => {
    const system = new CinematicCameraSystem()
    updateCamera(system, audioFrame({ time: 30, section: 'verse', sectionSource: 'analysis' }))
    const restarted = updateCamera(system, audioFrame({ time: 0, section: 'intro', sectionSource: 'analysis', resets: ['seek', 'transportRestart'] }))
    expect(restarted.sectionType).toBe('intro')
    expect(Number.isFinite(restarted.pose.position.z)).toBe(true)
  })

  it('holds motion while paused and resumes without a giant delta-time jump', () => {
    const system = new CinematicCameraSystem()
    const moving = updateCamera(system, audioFrame({ time: 20, section: 'verse', sectionSource: 'analysis' }), 'handheld')
    const paused = updateCamera(system, audioFrame({ time: 20, section: 'verse', sectionSource: 'analysis', playing: false }), 'handheld', undefined, 'test-world', 10)
    expect(paused.pose).toEqual(moving.pose)
    const resumed = updateCamera(system, audioFrame({ time: 20.016, section: 'verse', sectionSource: 'analysis', resets: ['transportRestart'] }), 'handheld', undefined, 'test-world', 10)
    expect(Math.abs(resumed.pose.position.x - paused.pose.position.x)).toBeLessThan(0.05)
  })

  it('produces bounded finite poses for every manual rig', () => {
    for (const rig of ['locked', 'dolly', 'orbit', 'flyThrough', 'handheld'] as const) {
      const frame = updateCamera(
        new CinematicCameraSystem(),
        audioFrame({ time: 18, section: 'verse', sectionSource: 'analysis', energy: 0.7, build: 0.4 }),
        rig,
      )
      expect(frame.rig).toBe(rig)
      expect(Object.values(frame.pose.position).every(Number.isFinite)).toBe(true)
      expect(Object.values(frame.pose.rotation).every(Number.isFinite)).toBe(true)
      expect(frame.pose.fieldOfView).toBeGreaterThanOrEqual(direction.safeCameraRange.minFieldOfView)
      expect(frame.pose.fieldOfView).toBeLessThanOrEqual(direction.safeCameraRange.maxFieldOfView)
    }
  })

  it('uses world fly-through paths and loops route progression deterministically', () => {
    const system = new CinematicCameraSystem()
    const frame = updateCamera(system, audioFrame({ time: 22, section: 'drop', sectionSource: 'analysis', energy: 0.9 }), 'flyThrough')
    expect(frame.rig).toBe('flyThrough')
    expect(frame.routeProgress).toBeGreaterThanOrEqual(0)
    expect(frame.routeProgress).toBeLessThan(1)
    expect(frame.pose.position.z).toBeGreaterThanOrEqual(direction.safeCameraRange.minDistance)
  })
})
