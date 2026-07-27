import { ShaderWaveformTextureXY } from '../audio/ShaderWaveformTextureXY'
import {
  buildSoundDrawingVectorscopeSegments,
  requiredSegmentFloats,
  type SoundDrawingVectorscopeColor,
} from './soundDrawingVectorscopeGeometry'
import type { GeometryPassInput } from '../runtime/shaderRuntimeTypes'
import type { ShaderGeometryProvider } from '../rendergraph/ShaderRenderGraph'

// ── soundDrawingVectorscopeRuntime ────────────────────────────────────────────
//
// Composes ShaderWaveformTextureXY + buildSoundDrawingVectorscopeSegments into
// the concrete ShaderGeometryProvider the 'draw' pass of
// soundDrawingVectorscope.ts needs at ShaderRenderGraph.execute() time.
//
// ReactFrameContext.timeDomainData is a single mono Uint8Array (the Web Audio
// AnalyserNode has no stereo XY concept) — updateFromMonoWaveform derives a
// second channel via a fixed sample delay, the standard technique for
// approximating oscilloscope XY ("Lissajous") mode from one time-domain
// channel: plotting signal(t) against signal(t - delay) traces a loop whose
// shape tracks the signal's own periodicity.
//
// This module intentionally is NOT wired into ShaderEngineRenderer.render()
// — doing so would touch that render loop's hot path for a scene that isn't
// in the production scene registry. It exists so the geometry-pass capability
// is genuinely exercised end-to-end (see the test suite) and so a future
// integration has a ready-made, already-tested seam: construct one runtime
// per canvas, call updateFromMonoWaveform() once per frame, and pass
// `.provider` as ShaderRenderGraph.execute()'s 4th argument.

const DELAY_SAMPLES = 96

export interface SoundDrawingVectorscopeRuntime {
  /** Pass as ShaderRenderGraph.execute()'s provideGeometry argument. */
  readonly provider: ShaderGeometryProvider
  /** The two-channel waveform texture this runtime owns and keeps updated. */
  readonly waveformTexture: ShaderWaveformTextureXY
  /** Call once per frame, before execute(), with the current mono time-domain buffer. */
  updateFromMonoWaveform(mono: Uint8Array | null, color: SoundDrawingVectorscopeColor): void
  dispose(): void
}

export function createSoundDrawingVectorscopeRuntime(
  gl: WebGL2RenderingContext,
  drawPassId: string,
): SoundDrawingVectorscopeRuntime {
  const waveformTexture = new ShaderWaveformTextureXY(gl)
  const sampleCount = waveformTexture.sampleCount

  // Reused every frame — no allocation in updateFromMonoWaveform's hot path.
  const channelA = new Float32Array(sampleCount)
  const channelB = new Float32Array(sampleCount)
  const segments = new Float32Array(requiredSegmentFloats(sampleCount))
  let segmentCount = 0

  function updateFromMonoWaveform(mono: Uint8Array | null, color: SoundDrawingVectorscopeColor): void {
    const available = mono ? mono.length : 0

    for (let i = 0; i < sampleCount; i++) {
      channelA[i] = i < available ? (mono![i] - 128) / 128 : 0
      const delayedIndex = i - DELAY_SAMPLES
      channelB[i] = delayedIndex >= 0 && delayedIndex < available ? (mono![delayedIndex] - 128) / 128 : 0
    }

    waveformTexture.update(channelA, channelB)
    segmentCount = buildSoundDrawingVectorscopeSegments(channelA, channelB, sampleCount, color, segments)
  }

  const provider: ShaderGeometryProvider = (passId): GeometryPassInput | null => {
    if (passId !== drawPassId) return null
    return { data: segments, count: segmentCount }
  }

  return {
    provider,
    waveformTexture,
    updateFromMonoWaveform,
    dispose() {
      waveformTexture.dispose()
    },
  }
}
