import type { VzEffectModule, VzFrameContext } from './types'
import { resolveSpectrumBarsParams } from '../../../types/effectParams'

interface SpectrumBarsParams extends Record<string, unknown> {
  amount: number
}

// Per-canvas smoothing state: stores previous frame bar heights
const sbStateMap = new WeakMap<CanvasRenderingContext2D, { heights: Float32Array }>()

export const spectrumBarsModule: VzEffectModule<SpectrumBarsParams> = {
  id:          'spectrumBars',
  label:       'Spectrum Bars',
  category:    'audioReactive',
  renderPhase: 'postMedia',
  chainName:   'Spectrum Bars',
  effectKey:   'spectrumBars',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: SpectrumBarsParams) {
    const { W, H, dpr, freqData, audio: { bass }, masterIntensity, effectParams } = frame
    if (!freqData) return

    const sp = resolveSpectrumBarsParams(effectParams)
    const barCount = Math.min(sp.barCount, Math.floor(freqData.length * 0.6))
    if (barCount < 1) return

    // Per-canvas smoothing buffer
    let state = sbStateMap.get(ctx)
    if (!state || state.heights.length !== barCount) {
      state = { heights: new Float32Array(barCount) }
      sbStateMap.set(ctx, state)
    }

    const { amount } = params
    const barW = (sp.mirrorMode ? W / 2 : W) / barCount

    ctx.save()
    ctx.globalAlpha = amount

    const drawBars = (offsetX: number, flipDir: 1 | -1) => {
      for (let i = 0; i < barCount; i++) {
        const binIdx = Math.floor((i / barCount) * (freqData.length * 0.65))
        const freq   = freqData[binIdx] / 255
        const target = Math.max(2 * dpr, freq * H * 0.35 * masterIntensity *
          (i < barCount * 0.15 ? 1 + bass * 1.2 : 1))

        // Apply smoothing: lerp toward target
        state!.heights[i] = sp.smoothing > 0
          ? state!.heights[i] * sp.smoothing + target * (1 - sp.smoothing)
          : target
        const bh = state!.heights[i]

        const x     = offsetX + (flipDir === 1 ? i : barCount - 1 - i) * barW
        const alpha = 0.4 + freq * 0.6
        const grad  = ctx.createLinearGradient(0, H, 0, H - bh)
        grad.addColorStop(0, `rgba(74,199,219,${alpha * 0.85})`)
        grad.addColorStop(1, `rgba(74,199,219,${alpha * 0.15})`)
        ctx.fillStyle = grad
        if (freq > 0.55) {
          ctx.shadowColor = '#4ac7db'
          ctx.shadowBlur  = 6 * dpr * freq * amount
        }
        ctx.fillRect(x, H - bh, Math.max(1, barW - 1), bh)
        ctx.shadowBlur = 0
      }
    }

    if (sp.mirrorMode) {
      drawBars(0, -1)           // left half — mirrored
      drawBars(W / 2, 1)        // right half — normal
    } else {
      drawBars(0, 1)
    }

    ctx.globalAlpha = 1
    ctx.restore()
  },
}
