import { beforeEach, describe, expect, it } from 'vitest'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { MusicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import { createDefaultLaserDmxBeamMatrixSettings } from '../react/ReactTypes'
import {
  compileLaserDmxBeamMatrix,
  resetBeamMatrixCompilerState,
} from '../react/renderers/LaserDmxBeamMatrixCompiler'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../react/renderers/LaserDmxShowDirectorBeamMatrixCompiler'
import {
  addLaserDmxShowManagerFixtureToSection,
  createLaserDmxShowManagerRuntimeShowDirector,
  normalizeLaserDmxShowManagerShow,
  resolveLaserDmxShowManagerPlaybackSection,
  triggerPatchForLaserDmxShowManagerOption,
} from './LaserDmxShowManagerDomain'

const SAMPLE_RATE = 48_000
const TIME_DOMAIN = new Uint8Array(512).fill(128) as Uint8Array<ArrayBuffer>
const BASELINE_SPECTRUM = new Uint8Array(256).fill(24) as Uint8Array<ArrayBuffer>
const KICK_SPECTRUM = (() => {
  const frame = new Uint8Array(BASELINE_SPECTRUM) as Uint8Array<ArrayBuffer>
  frame.fill(118, 0, 4)
  return frame
})()

describe('LaserDMX Show Manager audio-reactive trigger production path', () => {
  beforeEach(() => {
    AudioFeatureBus.reset()
    resetBeamMatrixCompilerState()
  })

  it('keeps an authored-section Kick fixture active and visibly retriggers on multiple canonical MI hits in one playback pass', () => {
    let show = normalizeLaserDmxShowManagerShow({
      id: 'repeat-kick-show',
      name: 'Repeat Kick Show',
      sections: [{
        id: 'drop-a',
        label: 'Drop A',
        type: 'drop',
        startSec: 0,
        endSec: 4,
        source: 'user-created',
        fixtures: [],
      }],
    })
    show = addLaserDmxShowManagerFixtureToSection(show, 'drop-a', 'laser', {
      x: 8,
      y: 5,
      brightness: 1,
      trigger: triggerPatchForLaserDmxShowManagerOption('kickHit'),
    }).show

    const activeSection = resolveLaserDmxShowManagerPlaybackSection(show, 0.1)
    expect(activeSection?.id).toBe('drop-a')
    expect(resolveLaserDmxShowManagerPlaybackSection(show, 4.01)).toBeNull()

    const showDirector = createLaserDmxShowManagerRuntimeShowDirector(show, activeSection!)
    const settings = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      sections: show.sections,
    })
    expect(settings.beams.length).toBeGreaterThan(0)

    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('linked-track-a', 'linked-track-a')
    engine.setBpm(120, 1)

    const render = (freqBuf: Uint8Array<ArrayBuffer>, audioTime: number) => {
      engine.updateFromAudioFrame({
        freqBuf,
        timeBuf: TIME_DOMAIN,
        sampleRate: SAMPLE_RATE,
        audioTime,
        isPlaying: true,
        publisherId: 'react:placeholder',
      })
      return compileLaserDmxBeamMatrix({
        settings,
        mi: AudioFeatureBus.getFrame(),
        timeSec: audioTime,
        canvasWidth: 640,
        canvasHeight: 360,
      })
    }

    render(BASELINE_SPECTRUM, 0.1)
    const firstHit = render(KICK_SPECTRUM, 0.12)
    const firstIntensity = firstHit.beams[0]?.intensity ?? 0
    expect(AudioFeatureBus.getFrame().rhythm.kickHit).toBe(true)
    expect(firstIntensity).toBeGreaterThan(0)

    let beforeSecondIntensity = firstIntensity
    for (let i = 1; i <= 12; i++) {
      const tail = render(BASELINE_SPECTRUM, 0.12 + i * 0.02)
      beforeSecondIntensity = tail.beams[0]?.intensity ?? 0
    }

    const secondHit = render(KICK_SPECTRUM, 0.38)
    const secondIntensity = secondHit.beams[0]?.intensity ?? 0
    expect(AudioFeatureBus.getFrame().rhythm.kickHit).toBe(true)
    expect(secondIntensity).toBeGreaterThan(beforeSecondIntensity)
    expect(secondIntensity).toBeGreaterThan(0)
  })
})
