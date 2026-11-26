import type { Cinema2ParameterId } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ParameterState } from '../../parameters/Cinema2ParameterState'
import type { Cinema2CameraFraming } from '../../spatial/Cinema2CameraRuntime'
import { resolveCinema2SayItTextLayout } from '../sayIt/Cinema2SayItTextLayout'
import { LIVEWIRE_FLOOR_Y } from './Cinema2LivewireBridge'
import { LIVEWIRE_GLYPH_METRICS } from './Cinema2LivewireGlyphs'

/** Read the exact authored layout used by the native glyph module. Cache on
 * edits, not audio frames; no saved settings, camera transforms or clocks are
 * mutated here. The shared camera owns the final view and projection. */
export function createLivewireCameraFraming(state: Cinema2ParameterState): () => Readonly<Cinema2CameraFraming> {
  let revision = -1
  let cached: Readonly<Cinema2CameraFraming>
  const get = (name: string) => state.getValue(`livewire-${name}` as Cinema2ParameterId)
  const number = (name: string, fallback: number) => {
    const value = get(name)
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  }
  return () => {
    const next = state.getPersistentRevision()
    if (next === revision) return cached
    revision = next
    const alignment = get('alignment')
    const layout = resolveCinema2SayItTextLayout({ line1: get('text'), line2: get('line-2-text') }, {
      alignment: alignment === 'left' || alignment === 'right' ? alignment : 'center',
      lineMode: get('line-mode') === 'one' ? 'one' : 'two',
      tracking: number('tracking', 0.04), lineSpacing: number('line-spacing', 0.84), glyphScale: number('glyph-scale', 0.42),
    }, LIVEWIRE_GLYPH_METRICS)
    const bottom = LIVEWIRE_FLOOR_Y + 0.027
    // The bridge rests the actual glyph bounds at bottom. Metal bevels extend
    // at most 0.288 local units along Z; allow 0.30 for both faces.
    const depth = 0.30 * Math.max(0, ...layout.glyphs.map(glyph => glyph.scale))
    const width = layout.width / 2
    cached = {
      target: [0, bottom + layout.height * 0.43, 0],
      min: [-width, bottom, -depth], max: [width, bottom + layout.height, depth],
    }
    return cached
  }
}
