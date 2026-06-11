// Stem intelligence: curve interpolation, runtime values, backend interface.
//
// Heavy stem separation (demucs, spleeter, openunmix) belongs on a backend
// worker/server — this file provides the runtime consumer side only.
//
// Recommended backend tools (NOT implemented here):
//   - demucs (https://github.com/facebookresearch/demucs) — best quality
//   - openunmix (https://github.com/sigsep/open-unmix-pytorch)
//   - spleeter (https://github.com/deezer/spleeter)
//   - torchaudio stem separation
//
// When stem curves are available, StemCurveInterpolator samples them at the
// current audio time and populates the MIStems frame values.

import type { StemFeatureCurve, StemTrackCurves, MIStems, FeatureCurve, AnalysisStatus } from './types'

// ── Curve interpolation helper ────────────────────────────────────────────────

function interpolateCurve(curve: FeatureCurve, timeSec: number): number {
  if (curve.length === 0) return 0
  if (timeSec <= curve[0].timeSec) return curve[0].value
  if (timeSec >= curve[curve.length - 1].timeSec) return curve[curve.length - 1].value

  let lo = 0, hi = curve.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid].timeSec <= timeSec) lo = mid; else hi = mid
  }
  const t = (timeSec - curve[lo].timeSec) / (curve[hi].timeSec - curve[lo].timeSec + 1e-12)
  return curve[lo].value + t * (curve[hi].value - curve[lo].value)
}

function sampleStemTrack(
  track: StemTrackCurves,
  timeSec: number,
): { energy: number; rms: number; transient: boolean } {
  const energy    = interpolateCurve(track.energy,    timeSec)
  const rms       = interpolateCurve(track.rms,       timeSec)
  const rawTrans  = interpolateCurve(track.transient, timeSec)
  return { energy, rms, transient: rawTrans > 0.5 }
}

// ── Stem curve interpolator ───────────────────────────────────────────────────

export class StemCurveInterpolator {
  private curves: StemFeatureCurve | null = null
  private prevVocalEnergy  = 0
  private vocalActivityEma = 0

  setData(stemCurves: StemFeatureCurve | null): void {
    this.curves = stemCurves
  }

  hasData(): boolean {
    return this.curves !== null
  }

  sampleAt(timeSec: number): MIStems {
    const zero: MIStems = {
      vocals: 0, drums: 0, bass: 0, instruments: 0, other: 0,
      vocalEnergy: 0, drumEnergy: 0, bassStemEnergy: 0, instrumentEnergy: 0, otherStemEnergy: 0,
      vocalActivity: 0, drumTransient: false, bassStemTransient: false,
    }

    if (this.curves === null) return zero

    const v  = sampleStemTrack(this.curves.vocals,      timeSec)
    const d  = sampleStemTrack(this.curves.drums,       timeSec)
    const b  = sampleStemTrack(this.curves.bass,        timeSec)
    const in_ = sampleStemTrack(this.curves.instruments, timeSec)
    const o  = sampleStemTrack(this.curves.other,       timeSec)

    // Vocal activity: slow EMA of vocal energy for sustained presence
    this.vocalActivityEma = 0.05 * v.energy + 0.95 * this.vocalActivityEma

    return {
      vocals:           v.energy,
      drums:            d.energy,
      bass:             b.energy,
      instruments:      in_.energy,
      other:            o.energy,
      vocalEnergy:      v.energy,
      drumEnergy:       d.energy,
      bassStemEnergy:   b.energy,
      instrumentEnergy: in_.energy,
      otherStemEnergy:  o.energy,
      vocalActivity:    Math.min(1, this.vocalActivityEma * 2),
      drumTransient:    d.transient,
      bassStemTransient: b.transient,
    }
  }

  reset(): void {
    this.prevVocalEnergy  = 0
    this.vocalActivityEma = 0
  }
}

// ── Backend interface ─────────────────────────────────────────────────────────
// Implement this interface in a Supabase Edge Function, a local Python
// server, or a Web Worker running demucs WASM if/when available.

export interface StemAnalysisBackend {
  /**
   * Queue a stem analysis job for a track.
   * The backend should decode the audio, run separation, and store curves
   * via saveStemFeatureCurves when done.
   */
  queueStemAnalysis(trackId: string, audioFile: File): Promise<void>

  /** Returns current analysis status for a track. */
  getStemAnalysisStatus(trackId: string): Promise<AnalysisStatus>

  /**
   * Store pre-computed stem feature curves (called by backend when done,
   * or when importing pre-analyzed data).
   */
  saveStemFeatureCurves(trackId: string, curves: StemFeatureCurve): Promise<void>

  /** Retrieve stored stem curves for a track, if available. */
  getStemFeatureCurves(trackId: string): Promise<StemFeatureCurve | null>
}

// ── Null implementation (no backend wired up) ─────────────────────────────────

export const nullStemBackend: StemAnalysisBackend = {
  queueStemAnalysis(_trackId, _file) {
    return Promise.reject(new Error(
      'No stem analysis backend is configured. ' +
      'Implement StemAnalysisBackend and set it via setStemAnalysisBackend().'
    ))
  },
  getStemAnalysisStatus(_trackId) {
    return Promise.resolve('not_analyzed' as AnalysisStatus)
  },
  saveStemFeatureCurves(_trackId, _curves) {
    return Promise.reject(new Error('No stem analysis backend configured.'))
  },
  getStemFeatureCurves(_trackId) {
    return Promise.resolve(null)
  },
}

// ── Singleton backend registry ────────────────────────────────────────────────

let _backend: StemAnalysisBackend = nullStemBackend

export function setStemAnalysisBackend(backend: StemAnalysisBackend): void {
  _backend = backend
}

export function getStemAnalysisBackend(): StemAnalysisBackend {
  return _backend
}

// ── Helper: build empty StemFeatureCurve ─────────────────────────────────────

function emptyTrack(): StemTrackCurves {
  return { energy: [], rms: [], transient: [] }
}

export function emptyStems(): StemFeatureCurve {
  return {
    vocals:      emptyTrack(),
    drums:       emptyTrack(),
    bass:        emptyTrack(),
    instruments: emptyTrack(),
    other:       emptyTrack(),
  }
}
