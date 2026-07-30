import { soundDrawingPerformanceShowUsesGenerator } from './SoundDrawingPerformanceShows'
import type { SoundDrawingPerformanceSettings } from './SoundDrawingPerformanceTypes'

export function shouldShowLivingRibbonControls(settings: SoundDrawingPerformanceSettings): boolean {
  return settings.selectedShowId != null && soundDrawingPerformanceShowUsesGenerator(settings.selectedShowId, 'livingRibbon')
}
