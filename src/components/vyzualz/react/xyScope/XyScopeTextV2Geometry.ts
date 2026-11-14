import type { XyScopeGlyphGeometry } from './XyScopeGeometry'
import type { XyScopePointBuffers, XyScopeScopeFrame } from './XyScopeMotion'
import type { TextV2PerformanceFrame } from './XyScopeTextV2Performance'
import type { XyScopeTextV2Settings } from './XyScopeTextV2Settings'
const TAU = Math.PI * 2

/** Filter signed samples before bending outlines: adjacent vertices move together. */
function signedSample(samples: Float32Array, u: number, gain: number): number {
  const p = Math.max(0, Math.min(1, u)) * (samples.length - 1)
  const a = Math.floor(p), mix = p - a
  let left = 0, right = 0
  for (let j = -4; j <= 4; j++) {
    left += samples[Math.max(0, Math.min(samples.length - 1, a + j))]
    right += samples[Math.max(0, Math.min(samples.length - 1, a + j + 1))]
  }
  return Math.tanh((left + (right - left) * mix) * gain / 9)
}

/** Continuous bounded deflection of real font paths; never a point scatter or unrelated cloud. */
export function computeTextV2GlyphPoints(
  glyph: XyScopeGlyphGeometry, index: number, count: number, scope: XyScopeScopeFrame,
  frame: TextV2PerformanceFrame, settings: XyScopeTextV2Settings,
  out: XyScopePointBuffers, width: number, height: number, passIndex = 1,
): void {
  const c = frame.controls, w = frame.weights
  const localMix = settings.grouping === 'word' ? 0 : settings.grouping === 'letters' ? 1 : .62
  const offset = index * .61803398875 + c.channelOffset
  const passPhase = passIndex * .27
  const localPhase = (offset + passPhase) * TAU
  const phase = (frame.phase + passPhase) * TAU
  const focus = index % 4 === 0 ? frame.bass : index % 4 === 1 ? frame.mid : index % 4 === 2 ? frame.high : frame.impact
  const channelLevel = frame.level * (1 - c.audioFocus * localMix * .45) + focus * c.audioFocus * localMix * .45
  const channelGain = .6 + channelLevel * .4 * c.channelDepth
  const amount = frame.amount * Math.min(1.25, channelGain)
  const protection = c.strokeProtection * (.6 + c.transientReadability * .4)
  // Excursion is capped relative to cap height, regardless of input gain or track loudness.
  const passDepth = passIndex === 0 ? .1 : passIndex === 1 ? 1 : 1.18
  const radius = Math.min(glyph.heightPx * .3, glyph.heightPx * (.012 + settings.abstraction * .45) * amount * (.4 + c.deflection * .6) * passDepth)
  const cos = Math.cos(c.angle), sin = Math.sin(c.angle)
  const actualSignal = scope.source !== 'fallback'

  for (let contour = 0; contour < glyph.starts.length - 1; contour++) {
    const from = glyph.starts[contour], to = glyph.starts[contour + 1]
    for (let i = from; i < to; i++) {
      const u = (i - from) / Math.max(1, to - from - 1)
      const globalU = (index + u) / Math.max(1, count)
      const window = Math.sin(Math.PI * u) ** 2 // joins each contour without a long closing jump
      const carrier = Math.sin(TAU * 2 * globalU + phase)
      const local = Math.sin(TAU * (2 + index % 3) * u + phase + localPhase)
      const grouped = carrier * (1 - localMix) + local * localMix
      const sampleU = (u + passIndex * .11) % 1
      const mid = actualSignal ? signedSample(scope.trace, sampleU, scope.traceGain) : Math.sin(TAU * 3 * u + phase) * frame.mid
      const side = actualSignal ? signedSample(scope.cloudX, sampleU, scope.cloudGain) : Math.cos(TAU * 2 * u + phase) * frame.high
      const midSigned = actualSignal ? signedSample(scope.cloudY, sampleU, scope.cloudGain) : mid
      const ribbon = Math.sin(TAU * (2 + Math.round(frame.mid * 2)) * u + phase + localPhase * localMix) * (.45 + frame.mid * .55)
      const impact = Math.sin(TAU * 5 * u - phase + localPhase * localMix) * frame.impact
      const reform = Math.sin(TAU * 2 * u + phase) * Math.cos(TAU * 3 * u - phase + localPhase * localMix)
      let normal = w[0] * (grouped * .45 + mid * c.waveformDetail)
        + w[1] * (side * c.stereoCoupling + grouped * .35)
        + w[2] * (ribbon * c.accentFolds + mid * .35)
        + w[3] * (impact + grouped * .22 + mid * .3)
        + w[4] * (reform * (.5 + c.departure * .8) + mid * .5)
      let tangent = w[1] * midSigned * c.stereoCoupling + w[2] * ribbon * .3
        + w[3] * impact * .2 + w[4] * reform * c.crossModulation
      normal += mid * c.waveformDetail * .22 + grouped * c.crossModulation * .22
      tangent += side * c.crossModulation * .25
      const pass = .5 + .5 * Math.cos(TAU * (u - frame.scanPhase))
      const guard = (1 - protection * .22) * (1 - c.protectedPasses * pass * .12)
      const nx = glyph.nx[i], ny = glyph.ny[i]
      const bendX = (nx * normal - ny * tangent) * radius * window * guard
      const bendY = (ny * normal + nx * tangent) * radius * window * guard
      let dx = Math.tanh((bendX * cos - bendY * sin) / Math.max(1, radius)) * radius
      let dy = Math.tanh((bendX * sin + bendY * cos) / Math.max(1, radius)) * radius
      const bound = glyph.heightPx * .24
      const limit = Math.min(1, bound / Math.max(1e-6, Math.hypot(dx, dy)))
      dx *= limit; dy *= limit
      const x = glyph.centerX + glyph.x[i] * (1 + (c.xScale - 1) * amount) + dx
      const y = glyph.y[i] * (1 + (c.yScale - 1) * amount) + dy
      out.x[i] = Math.max(-width * .47, Math.min(width * .47, x))
      out.y[i] = Math.max(-height * .47, Math.min(height * .47, y))
      out.form[i] = 0 // keep original contour closure and character topology
      out.dissolved[i] = 0
      out.gap[i] = 0
    }
  }
}
