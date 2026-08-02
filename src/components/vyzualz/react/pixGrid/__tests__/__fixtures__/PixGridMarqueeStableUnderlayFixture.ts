import type { ReactPreset, ReactSectionType } from '../../../ReactTypes'
import { createDefaultPixGridState } from '../../PixGridDefaults'
import { applyPixGridPresetSettings } from '../../PixGridState'
import type {
  PixGridAudioFrame,
  PixGridBuiltInAssetId,
  PixGridLayer,
  PixGridState,
} from '../../PixGridTypes'

export const PIX_GRID_MARQUEE_STABLE_UNDERLAY_FRAME_IDS = ['base', 'rise', 'peak', 'release'] as const
export type PixGridMarqueeStableUnderlayFrameId = typeof PIX_GRID_MARQUEE_STABLE_UNDERLAY_FRAME_IDS[number]

export const PIX_GRID_MARQUEE_LETTER_LAYER_IDS = [
  'marquee-letter-lights-a',
  'marquee-letter-lights-b',
  'marquee-letter-lights-c',
] as const

const ALL_LAYER_IDS = [
  'marquee-structure',
  'marquee-bulbs-a',
  'marquee-bulbs-b',
  'marquee-bulbs-c',
  'marquee-bulbs-d',
  ...PIX_GRID_MARQUEE_LETTER_LAYER_IDS,
  'marquee-equalizer-lights',
  'marquee-trim-lights',
  'marquee-focal-lights',
  'marquee-sparkle-lights',
] as const

export type PixGridMarqueeStableUnderlayFixtureId =
  | 'all-lighting-active'
  | 'only-structure-active'
  | 'one-letter-bank-active'
  | 'all-letter-banks-off'
  | 'pre-drop-scene'
  | 'drop-scene'

export interface PixGridMarqueeStableUnderlayFixtureSpec {
  id: PixGridMarqueeStableUnderlayFixtureId
  sectionType: ReactSectionType
  visibleLayerIds?: readonly string[]
  hideLetterBanks?: boolean
  freezeAnimatedMasks?: boolean
  expectedBeforeHashes: readonly [number, number, number, number]
  expectedAfterHashes: readonly [number, number, number, number]
}

/**
 * Paired logical-frame snapshots. "Before" swaps only the structure asset back
 * to the preserved exclusive compatibility asset; every other state, scene,
 * animation clock, source frame, and layer remains identical.
 */
export const PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES: readonly PixGridMarqueeStableUnderlayFixtureSpec[] = [
  {
    id: 'all-lighting-active',
    sectionType: 'drop',
    visibleLayerIds: ALL_LAYER_IDS,
    freezeAnimatedMasks: true,
    expectedBeforeHashes: [3_476_907_863, 153_787_772, 876_482_146, 3_867_350_619],
    expectedAfterHashes: [3_476_907_863, 153_787_772, 876_482_146, 3_867_350_619],
  },
  {
    id: 'only-structure-active',
    sectionType: 'drop',
    visibleLayerIds: ['marquee-structure'],
    freezeAnimatedMasks: true,
    expectedBeforeHashes: [207_775_016, 3_938_269_786, 1_916_625_077, 1_591_766_667],
    expectedAfterHashes: [558_525_756, 924_059_490, 3_359_182_170, 1_771_597_700],
  },
  {
    id: 'one-letter-bank-active',
    sectionType: 'drop',
    visibleLayerIds: ['marquee-structure', 'marquee-letter-lights-a'],
    freezeAnimatedMasks: true,
    expectedBeforeHashes: [1_268_641_305, 2_193_036_626, 2_642_290_211, 1_591_766_667],
    expectedAfterHashes: [615_915_708, 259_690_258, 1_495_250_103, 1_771_597_700],
  },
  {
    id: 'all-letter-banks-off',
    sectionType: 'drop',
    hideLetterBanks: true,
    expectedBeforeHashes: [3_949_288_467, 2_860_773_161, 1_088_039_048, 554_673_486],
    expectedAfterHashes: [3_621_309_695, 476_486_970, 2_640_669_343, 2_973_804_649],
  },
  {
    id: 'pre-drop-scene',
    sectionType: 'preDrop',
    expectedBeforeHashes: [618_896_069, 3_802_689_964, 1_299_027_060, 2_973_262_435],
    expectedAfterHashes: [807_917_559, 1_757_726_021, 2_948_969_978, 1_038_694_475],
  },
  {
    id: 'drop-scene',
    sectionType: 'drop',
    expectedBeforeHashes: [1_937_125_919, 1_943_782_283, 725_058_165, 554_673_486],
    expectedAfterHashes: [4_174_514_651, 2_857_918_434, 1_129_849_895, 2_973_804_649],
  },
] as const

function fixtureLayers(
  layers: readonly PixGridLayer[],
  fixture: PixGridMarqueeStableUnderlayFixtureSpec,
  structureAssetId: PixGridBuiltInAssetId,
): PixGridLayer[] {
  const visibleLayerIds = fixture.visibleLayerIds ? new Set(fixture.visibleLayerIds) : null
  const hiddenLetters = fixture.hideLetterBanks ? new Set<string>(PIX_GRID_MARQUEE_LETTER_LAYER_IDS) : null
  return layers.map(layer => ({
    ...layer,
    assetId: layer.id === 'marquee-structure' ? structureAssetId : layer.assetId,
    visible: visibleLayerIds ? visibleLayerIds.has(layer.id) : layer.visible && !hiddenLetters?.has(layer.id),
    animations: fixture.freezeAnimatedMasks
      ? layer.animations.filter(animation => animation.mode === 'frameCycle')
      : layer.animations.map(animation => ({ ...animation })),
  }))
}

export function createPixGridMarqueeStableUnderlayFixtureState(
  preset: ReactPreset,
  fixture: PixGridMarqueeStableUnderlayFixtureSpec,
  structureAssetId: 'pix-neon-marquee-structure' | 'pix-neon-marquee-stable-underlay',
): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
  return {
    ...applied,
    selectedSceneId: `${preset.id}-${fixture.sectionType}`,
    layers: fixtureLayers(applied.layers, fixture, structureAssetId),
    globalIntensity: 1,
    cellBrightness: 1,
    glowAmount: 0,
    diffusion: 0,
    performance: { ...applied.performance, enabled: false },
  }
}

export function createPixGridMarqueeStableUnderlayFixtureFrame(
  fixture: PixGridMarqueeStableUnderlayFixtureSpec,
  frameIndex: number,
): PixGridAudioFrame {
  const sectionBeat = fixture.sectionType === 'preDrop' ? 2.75 : 1.5
  const sectionBar = sectionBeat / 4
  return {
    audioTime: 20 + frameIndex,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0.37,
    isPlaying: true,
    beatIndex: 80 + frameIndex,
    barIndex: 20,
    beatsSinceSectionStart: sectionBeat,
    barsSinceSectionStart: sectionBar,
    sectionType: fixture.sectionType,
    sectionProgress: 0.5,
    motionClockSectionType: fixture.sectionType,
    motionClockSectionBeat: sectionBeat,
    motionClockSectionBar: sectionBar,
    signClock: frameIndex,
    motionClockSign: frameIndex,
    signTransitionClock: null,
    motionClockSignTransition: null,
    autoPerformanceEnabled: false,
    sourceValues: {},
    motionMultiplier: 1,
    bassReactivityGain: 0,
  }
}

export function fnv1aPixGridLogicalFrame(bytes: Uint8Array): number {
  let hash = 2_166_136_261
  for (const value of bytes) {
    hash ^= value
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}
