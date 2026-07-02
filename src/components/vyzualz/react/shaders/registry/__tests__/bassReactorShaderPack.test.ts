import { describe, expect, it } from 'vitest'
import { ShaderDefinitionValidator } from '../ShaderDefinitionValidator'
import {
  BASS_CATHEDRAL,
  LASER_LATTICE_OVERDRIVE,
  TRAP_SHRAPNEL_REACTOR,
  WOBBLE_GLYPH_FORGE,
  DREAMSTATE_MYCELIUM,
  MELODIC_RIFT_BLOOM,
  RIDDIM_RAILGUN_SEQUENCER,
  BRAND_SINGULARITY,
} from '../../scenes'

const PACK = [
  BASS_CATHEDRAL,
  LASER_LATTICE_OVERDRIVE,
  TRAP_SHRAPNEL_REACTOR,
  WOBBLE_GLYPH_FORGE,
  DREAMSTATE_MYCELIUM,
  MELODIC_RIFT_BLOOM,
  RIDDIM_RAILGUN_SEQUENCER,
  BRAND_SINGULARITY,
]

function allFragmentSource(scene: (typeof PACK)[number]): string {
  return [scene.fragSrc ?? '', ...(scene.passes ?? []).map(pass => pass.fragSrc)].join('\n')
}

describe('bass-reactor shader pack', () => {
  it('ships eight stable, distinct, valid production scenes', () => {
    expect(PACK.map(scene => scene.id)).toEqual([
      'shader-bass-cathedral',
      'shader-laser-lattice-overdrive',
      'shader-trap-shrapnel-reactor',
      'shader-wobble-glyph-forge',
      'shader-dreamstate-mycelium',
      'shader-melodic-rift-bloom',
      'shader-riddim-railgun-sequencer',
      'shader-brand-singularity',
    ])
    expect(new Set(PACK.map(scene => scene.id)).size).toBe(PACK.length)
    for (const scene of PACK) {
      expect(ShaderDefinitionValidator.validate(scene)).toEqual({ valid: true, errors: [] })
      expect(scene.tags).toContain('brand-kit')
      expect(scene.params.some(param => param.type === 'color' && param.brandRole === 'primary')).toBe(true)
      expect(scene.params.some(param => param.type === 'color' && param.brandRole === 'background')).toBe(true)
      expect(scene.transitions?.supportsGpuTransitions).toBe(true)
    }
  })

  it('routes the complete Music Intelligence contract through every scene', () => {
    const representativeUniforms = [
      'uSub', 'uRawBass', 'uRms',
      'uKickHit', 'uSnareHit', 'uHatHit', 'uTransientConfidence',
      'uBpmConfidence', 'uBeatIndex', 'uBarIndex',
      'uPhrase4Progress', 'uPhrase8Progress', 'uPhrase16Progress', 'uPhrase32Progress',
      'uSectionType', 'uSectionChangePulse',
      'uEnergyShortTerm', 'uEnergyLongTerm', 'uEnergyPercentile', 'uTrackEnergy',
      'uSpectralCentroid', 'uSpectralFlatness',
      'uChordCode', 'uPitchNormalized', 'uMelodyContourCode',
      'uVocalEnergy', 'uDrumEnergy', 'uBassStemEnergy',
      'uLyricActivity', 'uLyricWordHit',
      'uBuildConfidence', 'uDropConfidence', 'uFakeoutConfidence', 'uVocalHookConfidence',
      'uHasStems', 'uHasLyrics', 'uHasHarmonics', 'uHasSemantics',
      'uOverallConfidence',
      'uSpectrumTexture', 'uWaveformTexture',
    ]
    for (const scene of PACK) {
      const source = allFragmentSource(scene)
      for (const uniform of representativeUniforms) expect(source).toContain(uniform)
      expect(source).toContain('readMusicSignals')
    }
  })

  it('uses persistent feedback only where the concept benefits from trails or growth history', () => {
    const feedbackScenes = PACK.filter(scene => scene.quality?.requiresPersistentBuffers)
    expect(feedbackScenes.map(scene => scene.id)).toEqual([
      'shader-trap-shrapnel-reactor',
      'shader-dreamstate-mycelium',
      'shader-brand-singularity',
    ])
    for (const scene of feedbackScenes) {
      expect(scene.feedback?.pingPongBuffers).toBe(1)
      expect(scene.feedbackReset?.onSceneChange).toBe(true)
      expect(scene.passes?.some(pass => pass.pingPong)).toBe(true)
    }
  })

  it('makes Brand Singularity logo-native and media-capable', () => {
    const source = allFragmentSource(BRAND_SINGULARITY)
    expect(source).toContain('brandLogoMask')
    expect(source).toContain('uBrandLogoTexture')
    expect(BRAND_SINGULARITY.textureInputs?.map(input => input.source)).toEqual([
      'uploaded-image', 'album-artwork', 'media-output',
    ])
  })
})
