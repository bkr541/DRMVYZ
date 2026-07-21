import { soundDrawingPerformanceShowUsesGenerator } from './SoundDrawingPerformanceShows'
import type { SoundDrawingPerformanceSettings } from './SoundDrawingPerformanceTypes'

export function shouldShowLivingRibbonControls(settings: SoundDrawingPerformanceSettings): boolean {
  return (
    settings.generatorPreference === 'livingRibbon' ||
    soundDrawingPerformanceShowUsesGenerator(settings.selectedShowId, 'livingRibbon')
  )
}
