import { calcRMS, linToDb } from './loudness'

export function calcPhaseCorrelation(
  bufL: Float32Array<ArrayBuffer>,
  bufR: Float32Array<ArrayBuffer>
): number {
  let sumLR = 0, sumL2 = 0, sumR2 = 0
  const len = Math.min(bufL.length, bufR.length)
  for (let i = 0; i < len; i++) {
    sumLR += bufL[i] * bufR[i]
    sumL2 += bufL[i] * bufL[i]
    sumR2 += bufR[i] * bufR[i]
  }
  const denom = Math.sqrt(sumL2 * sumR2)
  return denom < 1e-10 ? 0 : sumLR / denom
}

export function calcStereoReading(
  bufL: Float32Array<ArrayBuffer>,
  bufR: Float32Array<ArrayBuffer>
): import('../types/meters').StereoReading {
  const correlation = calcPhaseCorrelation(bufL, bufR)

  const len = Math.min(bufL.length, bufR.length)
  const mid = new Float32Array(len) as Float32Array<ArrayBuffer>
  const side = new Float32Array(len) as Float32Array<ArrayBuffer>
  for (let i = 0; i < len; i++) {
    mid[i] = (bufL[i] + bufR[i]) * 0.7071
    side[i] = (bufL[i] - bufR[i]) * 0.7071
  }

  const midRMS = calcRMS(mid)
  const sideRMS = calcRMS(side)
  const lRMS = calcRMS(bufL)
  const rRMS = calcRMS(bufR)

  const stereoWidth = midRMS > 1e-6 ? Math.min(sideRMS / midRMS, 1) : 0

  let monoCompatibility: 'good' | 'caution' | 'warning'
  if (correlation > 0.3) monoCompatibility = 'good'
  else if (correlation > -0.1) monoCompatibility = 'caution'
  else monoCompatibility = 'warning'

  return {
    phaseCorrelation: correlation,
    stereoWidth,
    midLevel: linToDb(midRMS),
    sideLevel: linToDb(sideRMS),
    lLevel: linToDb(lRMS),
    rLevel: linToDb(rRMS),
    monoCompatibility,
  }
}
