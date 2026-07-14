import type { SharedPerformanceProgramValidationIssue } from '../../../features/performanceCore'
import { validateLaserDmxShowDirectorPerformancePrograms } from './LaserDmxShowDirectorPerformanceValidation'
import { validateCanvasPerformanceShows } from './canvasPerformance'
import { validateSoundDrawingPerformanceShows } from './soundDrawing/SoundDrawingPerformanceValidation'

let validationHasRun = false

/** Runs once in development and never interrupts production playback. */
export function runPerformanceProgramDevelopmentValidation(): readonly SharedPerformanceProgramValidationIssue[] {
  if (validationHasRun || !import.meta.env.DEV) return []
  validationHasRun = true
  try {
    const issues = [
      ...validateLaserDmxShowDirectorPerformancePrograms(),
      ...validateSoundDrawingPerformanceShows(),
      ...validateCanvasPerformanceShows(),
    ]
    const errors = issues.filter(issue => issue.severity === 'error')
    if (errors.length) console.warn('[Performance Programs] Authoring validation found errors.', errors)
    return issues
  } catch (error) {
    console.warn('[Performance Programs] Development validation failed safely.', error)
    return []
  }
}

export function resetPerformanceProgramDevelopmentValidationForTests(): void {
  validationHasRun = false
}
