import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_MAX_LEVELS } from '../../effects/Cinema2HdrBloomEffect'
import { cinema2QualityPolicy } from '../../runtime/Cinema2PerformanceDiagnostics'
import { CINEMA2_THREE_SHADOW_BUDGET } from '../three/Cinema2ThreeCameraLightMapping'

export interface Cinema2MainframeQualityProfile {
  readonly quality: Cinema2RenderQualityLevel
  readonly meshVariant: 'full'
  readonly smallComponentDetail: 'full'
  readonly renderTargetScale: number
  readonly shadowLightLimit: number
  readonly shadowMapSize: number
  readonly bloomLevels: number
  readonly normalAoDetail: boolean
  readonly visiblePartCount: number
  readonly frameBudgetMs: number
}

const RENDER_TARGET_SCALE: Readonly<Record<Cinema2RenderQualityLevel, number>> = Object.freeze({
  low: cinema2QualityPolicy('performance').renderTargetScale,
  medium: cinema2QualityPolicy('balanced').renderTargetScale,
  high: cinema2QualityPolicy('quality').renderTargetScale,
})

/**
 * Mainframe uses one merged production GLB at every tier. A second model would repeat most of the
 * 7.8 MiB asset, and radar/chip families remain essential audio-reactive landmarks even on low.
 */
export const CINEMA2_MAINFRAME_QUALITY_PROFILES: Readonly<Record<Cinema2RenderQualityLevel, Readonly<Cinema2MainframeQualityProfile>>> = Object.freeze({
  low: Object.freeze({
    quality: 'low', meshVariant: 'full', smallComponentDetail: 'full', renderTargetScale: RENDER_TARGET_SCALE.low,
    shadowLightLimit: CINEMA2_THREE_SHADOW_BUDGET.low.lights,
    shadowMapSize: CINEMA2_THREE_SHADOW_BUDGET.low.mapSize,
    bloomLevels: CINEMA2_HDR_BLOOM_MAX_LEVELS.low,
    normalAoDetail: false, visiblePartCount: 13, frameBudgetMs: 16.7,
  }),
  medium: Object.freeze({
    quality: 'medium', meshVariant: 'full', smallComponentDetail: 'full', renderTargetScale: RENDER_TARGET_SCALE.medium,
    shadowLightLimit: CINEMA2_THREE_SHADOW_BUDGET.medium.lights,
    shadowMapSize: CINEMA2_THREE_SHADOW_BUDGET.medium.mapSize,
    bloomLevels: CINEMA2_HDR_BLOOM_MAX_LEVELS.medium,
    normalAoDetail: true, visiblePartCount: 13, frameBudgetMs: 16.7,
  }),
  high: Object.freeze({
    quality: 'high', meshVariant: 'full', smallComponentDetail: 'full', renderTargetScale: RENDER_TARGET_SCALE.high,
    shadowLightLimit: CINEMA2_THREE_SHADOW_BUDGET.high.lights,
    shadowMapSize: CINEMA2_THREE_SHADOW_BUDGET.high.mapSize,
    bloomLevels: CINEMA2_HDR_BLOOM_MAX_LEVELS.high,
    normalAoDetail: true, visiblePartCount: 13, frameBudgetMs: 16.7,
  }),
})

export function resolveCinema2MainframeQualityProfile(quality: Cinema2RenderQualityLevel): Readonly<Cinema2MainframeQualityProfile> {
  return CINEMA2_MAINFRAME_QUALITY_PROFILES[quality]
}
