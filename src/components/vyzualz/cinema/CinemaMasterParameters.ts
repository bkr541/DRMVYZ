import { cinemaStableId, type CinemaParameterId } from './CinemaIdentifiers'
import type {
  CinemaBrandRole,
  CinemaColorParameterDefinition,
  CinemaFloatParameterDefinition,
  CinemaParameterDefinition,
} from './CinemaDomain'

export const CINEMA_MASTER_PARAMETER_IDS = Object.freeze({
  intensity: cinemaStableId<CinemaParameterId>('intensity', 'parameter'),
  motion: cinemaStableId<CinemaParameterId>('motion', 'parameter'),
  complexity: cinemaStableId<CinemaParameterId>('complexity', 'parameter'),
  atmosphere: cinemaStableId<CinemaParameterId>('atmosphere', 'parameter'),
  bloom: cinemaStableId<CinemaParameterId>('bloom', 'parameter'),
  primaryColor: cinemaStableId<CinemaParameterId>('primary-color', 'parameter'),
  secondaryColor: cinemaStableId<CinemaParameterId>('secondary-color', 'parameter'),
  accentColor: cinemaStableId<CinemaParameterId>('accent-color', 'parameter'),
  backgroundColor: cinemaStableId<CinemaParameterId>('background-color', 'parameter'),
  foregroundColor: cinemaStableId<CinemaParameterId>('foreground-color', 'parameter'),
  highlightColor: cinemaStableId<CinemaParameterId>('highlight-color', 'parameter'),
  shadowColor: cinemaStableId<CinemaParameterId>('shadow-color', 'parameter'),
})

function scalar(
  id: CinemaParameterId,
  label: string,
  description: string,
  defaultValue: number,
): CinemaFloatParameterDefinition {
  return {
    id,
    label,
    description,
    group: 'Master',
    type: 'float',
    default: defaultValue,
    min: 0,
    max: 2,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', precision: 2 },
  }
}

function brandColor(
  id: CinemaParameterId,
  label: string,
  role: CinemaBrandRole,
  defaultValue: readonly [number, number, number, number],
): CinemaColorParameterDefinition {
  return {
    id,
    label,
    description: `Semantic ${role} color slot. The Brand Kit bridge is introduced in a later Cinema stage.`,
    group: 'Brand',
    type: 'color',
    default: defaultValue,
    brandRole: role,
    modulatable: false,
    ui: { control: 'color' },
  }
}

export const CINEMA_MASTER_PARAMETER_CATALOG: readonly CinemaParameterDefinition[] = deepFreeze([
  scalar(CINEMA_MASTER_PARAMETER_IDS.intensity, 'Intensity', 'Global visual contribution and response strength.', 1),
  scalar(CINEMA_MASTER_PARAMETER_IDS.motion, 'Motion', 'Global movement and animation amplitude.', 1),
  scalar(CINEMA_MASTER_PARAMETER_IDS.complexity, 'Complexity', 'Global density and structural detail.', 1),
  scalar(CINEMA_MASTER_PARAMETER_IDS.atmosphere, 'Atmosphere', 'Global environmental depth and ambience.', 1),
  scalar(CINEMA_MASTER_PARAMETER_IDS.bloom, 'Bloom', 'Global luminous emphasis.', 1),
  brandColor(CINEMA_MASTER_PARAMETER_IDS.primaryColor, 'Primary Color', 'primary', [0.15, 0.78, 0.86, 1]),
  brandColor(CINEMA_MASTER_PARAMETER_IDS.secondaryColor, 'Secondary Color', 'secondary', [0.38, 0.84, 0.66, 1]),
  brandColor(CINEMA_MASTER_PARAMETER_IDS.accentColor, 'Accent Color', 'accent', [0.95, 0.66, 0.26, 1]),
  brandColor(CINEMA_MASTER_PARAMETER_IDS.backgroundColor, 'Background Color', 'background', [0.01, 0.02, 0.04, 1]),
  brandColor(CINEMA_MASTER_PARAMETER_IDS.foregroundColor, 'Foreground Color', 'foreground', [0.92, 0.96, 0.98, 1]),
  brandColor(CINEMA_MASTER_PARAMETER_IDS.highlightColor, 'Highlight Color', 'highlight', [1, 1, 1, 1]),
  brandColor(CINEMA_MASTER_PARAMETER_IDS.shadowColor, 'Shadow Color', 'shadow', [0, 0, 0, 1]),
])

export interface CinemaBrandParameterSlot {
  parameterId: CinemaParameterId
  brandRole: CinemaBrandRole
}

export const CINEMA_BRAND_PARAMETER_SLOTS: readonly CinemaBrandParameterSlot[] = deepFreeze([
  { parameterId: CINEMA_MASTER_PARAMETER_IDS.primaryColor, brandRole: 'primary' },
  { parameterId: CINEMA_MASTER_PARAMETER_IDS.secondaryColor, brandRole: 'secondary' },
  { parameterId: CINEMA_MASTER_PARAMETER_IDS.accentColor, brandRole: 'accent' },
  { parameterId: CINEMA_MASTER_PARAMETER_IDS.backgroundColor, brandRole: 'background' },
  { parameterId: CINEMA_MASTER_PARAMETER_IDS.foregroundColor, brandRole: 'foreground' },
  { parameterId: CINEMA_MASTER_PARAMETER_IDS.highlightColor, brandRole: 'highlight' },
  { parameterId: CINEMA_MASTER_PARAMETER_IDS.shadowColor, brandRole: 'shadow' },
])


function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}
