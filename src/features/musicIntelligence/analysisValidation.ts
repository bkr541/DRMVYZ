import type { TrackIntelligenceAnalysis } from './types'

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNonNegative(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function finiteOrNull(value: unknown): boolean {
  return value == null || (typeof value === 'number' && Number.isFinite(value))
}

function validCurve(value: unknown): boolean {
  return Array.isArray(value) && value.every(point => (
    record(point) &&
    typeof point.timeSec === 'number' && Number.isFinite(point.timeSec) &&
    typeof point.value === 'number' && Number.isFinite(point.value)
  ))
}

function validSection(value: unknown): boolean {
  return record(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.type === 'string' &&
    typeof value.startSec === 'number' && Number.isFinite(value.startSec) &&
    typeof value.endSec === 'number' && Number.isFinite(value.endSec) &&
    value.endSec > value.startSec
}

/**
 * Runtime boundary for untrusted localStorage/database cache payloads.
 * It is deliberately lenient about optional fields from older schemas, but
 * strict about the arrays and curves used immediately during track loading.
 */
export function isUsableTrackAnalysis(value: unknown): value is TrackIntelligenceAnalysis {
  if (!record(value)) return false
  if (typeof value.analysisVersion !== 'string' || !finiteNonNegative(value.durationMs)) return false
  if (!finiteOrNull(value.bpm) || !finiteOrNull(value.bpmConfidence)) return false
  if (!Array.isArray(value.beatGrid) || !Array.isArray(value.downbeats) || !Array.isArray(value.sections)) return false
  if (!value.sections.every(validSection)) return false

  const energy = value.energyCurves
  const spectral = value.spectralCurves
  const harmonic = value.harmonic
  if (!record(energy) || !record(spectral) || !record(harmonic)) return false
  if (!validCurve(energy.instant) || !validCurve(energy.shortTerm) || !validCurve(energy.bass) ||
      !validCurve(energy.mid) || !validCurve(energy.high)) return false
  if (!validCurve(spectral.centroid) || !validCurve(spectral.flux) || !validCurve(spectral.complexity)) return false
  if (!Array.isArray(harmonic.keyChanges) || !Array.isArray(harmonic.chordProgression) ||
      !validCurve(harmonic.pitchCurve) || !validCurve(harmonic.melodyContourCurve)) return false

  if (value.phrases != null && !Array.isArray(value.phrases)) return false
  if (value.semanticMoments != null && !Array.isArray(value.semanticMoments)) return false
  if (value.warnings != null && !Array.isArray(value.warnings)) return false
  if (value.errors != null && !Array.isArray(value.errors)) return false
  return true
}
