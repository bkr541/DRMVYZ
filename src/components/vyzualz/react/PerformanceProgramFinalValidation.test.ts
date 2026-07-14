import { describe, expect, it } from 'vitest'
import { validateLaserDmxShowDirectorPerformancePrograms } from './LaserDmxShowDirectorPerformanceValidation'
import { LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY } from './LaserDmxShowDirectorPerformanceProgram'
import { validateCanvasPerformanceShows } from './canvasPerformance/CanvasPerformanceValidation'
import { CANVAS_PERFORMANCE_SHOWS } from './canvasPerformance/CanvasPerformanceShows'
import { validateSoundDrawingPerformanceShows } from './soundDrawing/SoundDrawingPerformanceValidation'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from './soundDrawing/SoundDrawingPerformanceShows'
import {
  clearAllSharedPerformanceDiagnostics,
  getSharedPerformanceDiagnostics,
  publishSharedPerformanceDiagnostics,
  retainSharedPerformanceDiagnosticsEngine,
} from './SharedPerformanceDiagnosticsStore'

const snapshot = (engine: 'laserDmx' | 'soundDrawing' | 'canvas') => ({
  engine,
  active: true,
  performanceShow: 'Show',
  scene: 'Scene',
  section: 'drop',
  sectionFamily: 'drop-family',
  sectionOccurrence: 1,
  dropOccurrence: 1,
  barWithinSection: 0,
  fourBarStage: 1,
  eightBarStage: 1,
  sixteenBarStage: 1,
  motifOrComposition: 'Motif',
  activeLayers: [],
  activeEventEnvelopes: [],
  recentActions: [],
  continuousRoutes: [],
  upcomingSemanticMoment: null,
  lockedParameters: [],
  fallbackState: null,
  capabilityLimitations: [],
  confidenceLimitations: [],
  resourceLimitDecisions: [],
  runtimeIdentity: 'runtime',
})

describe('final authored performance validation', () => {
  it('keeps every built-in show uniquely identified and free of validation errors', () => {
    const laserPrograms = Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY)
    expect(new Set(laserPrograms.map(entry => entry.id)).size).toBe(laserPrograms.length)
    expect(new Set(SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => show.id)).size).toBe(SOUND_DRAWING_PERFORMANCE_SHOWS.length)
    expect(new Set(CANVAS_PERFORMANCE_SHOWS.map(show => show.id)).size).toBe(CANVAS_PERFORMANCE_SHOWS.length)
    expect(validateLaserDmxShowDirectorPerformancePrograms().filter(issue => issue.severity === 'error')).toEqual([])
    expect(validateSoundDrawingPerformanceShows().filter(issue => issue.severity === 'error')).toEqual([])
    expect(validateCanvasPerformanceShows().filter(issue => issue.severity === 'error')).toEqual([])
  })

  it('drops inactive-engine diagnostics on engine switches', () => {
    clearAllSharedPerformanceDiagnostics()
    publishSharedPerformanceDiagnostics(snapshot('soundDrawing'))
    publishSharedPerformanceDiagnostics(snapshot('canvas'))
    retainSharedPerformanceDiagnosticsEngine('canvas')
    expect(getSharedPerformanceDiagnostics('soundDrawing')).toBeNull()
    expect(getSharedPerformanceDiagnostics('canvas')?.active).toBe(true)
    retainSharedPerformanceDiagnosticsEngine(null)
    expect(getSharedPerformanceDiagnostics('canvas')).toBeNull()
  })
})
