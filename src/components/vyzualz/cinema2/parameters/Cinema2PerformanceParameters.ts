import {
  cinema2StableId,
  type Cinema2ParameterId,
  type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'

export type Cinema2QualityMode = 'auto' | 'performance' | 'balanced' | 'quality'

export const CINEMA2_QUALITY_MODE_PARAMETER_ID = cinema2StableId<Cinema2ParameterId>('quality-mode')

/** Shared engine-level schema control contributed by every user-facing native preset. */
export const CINEMA2_QUALITY_MODE_PARAMETER: Readonly<Cinema2ParameterManifest> = Object.freeze({
  id: CINEMA2_QUALITY_MODE_PARAMETER_ID,
  label: 'Quality / Performance',
  description: 'Auto adapts render cost to frame time. Performance favors headroom; Quality favors detail.',
  type: 'enum' as const,
  defaultValue: 'auto',
  options: Object.freeze([
    Object.freeze({ value: 'auto', label: 'Auto' }),
    Object.freeze({ value: 'performance', label: 'Performance' }),
    Object.freeze({ value: 'balanced', label: 'Balanced' }),
    Object.freeze({ value: 'quality', label: 'Quality' }),
  ]),
  section: 'Advanced',
  group: 'Performance',
  order: -100,
  exposure: 'advanced' as const,
  persistence: 'user' as const,
  reset: 'authored-default' as const,
})

export function readCinema2QualityMode(value: unknown): Cinema2QualityMode {
  return value === 'performance' || value === 'balanced' || value === 'quality' ? value : 'auto'
}
