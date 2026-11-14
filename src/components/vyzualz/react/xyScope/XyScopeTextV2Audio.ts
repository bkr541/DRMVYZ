import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'

/** Honest signed mono fallback when the synchronized stereo worklet is unavailable. */
export class XyScopeTextV2MonoTap {
  private samples: Float32Array<ArrayBuffer> | null = null
  private sequence = 0
  read(analyser: AnalyserNode | null, audioTimeSeconds: number): StereoScopeFrame | null {
    if (!analyser || analyser.fftSize < 2048 || typeof analyser.getFloatTimeDomainData !== 'function') return null
    if (this.samples?.length !== analyser.fftSize) this.samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(this.samples)
    return {
      left: this.samples, right: this.samples,
      channelCount: 1, sampleRate: analyser.context.sampleRate,
      startFrame: Math.max(0, Math.round(audioTimeSeconds * analyser.context.sampleRate) - this.samples.length),
      sequenceNumber: ++this.sequence, audioTimeSeconds,
    }
  }
}
