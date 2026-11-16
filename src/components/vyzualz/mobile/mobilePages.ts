import type { AppIconKind } from '../../shared/icons/AppIcon'
import { REACT_ENGINE_IDS } from '../react/reactEngineCatalog'
import type { ReactEngineId } from '../react/ReactTypes'

/** The mobile app's four pages, in bottom-navigation order. */
export const MOBILE_PAGES = [
  { id: 'Performance', label: 'Perform', icon: 'navPreset' },
  { id: 'Remote', label: 'Remote', icon: 'cast' },
  { id: 'Pads', label: 'Pads', icon: 'navPerformance' },
  { id: 'Visualizer', label: 'Visualizer', icon: 'waveform' },
] as const satisfies readonly { id: string; label: string; icon: AppIconKind }[]

export type MobilePage = typeof MOBILE_PAGES[number]['id']

/** The mobile app runs Cinema 2.0 only for now; every other engine is listed but cannot be chosen. */
export const MOBILE_ENGINE_ID: ReactEngineId = 'cinema2'
export const MOBILE_DISABLED_ENGINES: readonly ReactEngineId[] = REACT_ENGINE_IDS.filter(id => id !== MOBILE_ENGINE_ID)

/** A phone-sized stage is 16:9, like the venue screen it will later be shown on. */
export const MOBILE_STAGE_ASPECT = 16 / 9
