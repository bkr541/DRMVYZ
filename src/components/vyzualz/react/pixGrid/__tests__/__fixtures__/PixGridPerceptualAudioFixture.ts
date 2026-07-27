export type PixGridPerceptualAudioFixtureKind = 'quiet' | 'kick' | 'snare' | 'hat' | 'bass'

export interface PixGridPerceptualAnalyserFrame {
  freqBuf: Uint8Array<ArrayBuffer>
  timeBuf: Uint8Array<ArrayBuffer>
}

export interface PixGridPerceptualAnalyserFixture {
  sampleRate: number
  calibration: PixGridPerceptualAnalyserFrame
  baseline: readonly PixGridPerceptualAnalyserFrame[]
  event: readonly PixGridPerceptualAnalyserFrame[]
}

const SAMPLE_RATE = 48_000
const FREQUENCY_BINS = 1_024
const FFT_SIZE = FREQUENCY_BINS * 2

function setBand(buffer: Uint8Array<ArrayBuffer>, loHz: number, hiHz: number, value: number): void {
  const nyquist = SAMPLE_RATE / 2
  const start = Math.max(0, Math.floor((loHz / nyquist) * buffer.length))
  const end = Math.min(buffer.length - 1, Math.ceil((hiHz / nyquist) * buffer.length))
  for (let index = start; index <= end; index += 1) buffer[index] = value
}

function deterministicNoise(index: number, seed: number): number {
  const value = Math.sin((index + seed * 17) * 12.9898) * 43_758.5453
  return (value - Math.floor(value)) * 2 - 1
}

function analyserFrame(
  low: number,
  mid: number,
  high: number,
  kind: PixGridPerceptualAudioFixtureKind,
  frameIndex: number,
): PixGridPerceptualAnalyserFrame {
  const freqBuf = new Uint8Array(FREQUENCY_BINS).fill(4) as Uint8Array<ArrayBuffer>
  setBand(freqBuf, 20, 250, low)
  setBand(freqBuf, 250, 4_000, mid)
  setBand(freqBuf, 4_000, 20_000, high)

  const timeBuf = new Uint8Array(FFT_SIZE) as Uint8Array<ArrayBuffer>
  for (let index = 0; index < FFT_SIZE; index += 1) {
    const time = index / SAMPLE_RATE
    const phase = frameIndex / 60
    const sample = kind === 'snare'
      ? deterministicNoise(index, frameIndex) * 0.18
      : kind === 'hat'
        ? deterministicNoise(index * 7, frameIndex) * 0.11
        : kind === 'kick'
          ? Math.sin((time + phase) * Math.PI * 2 * 58) * Math.exp(-index / 680) * 0.24
          : kind === 'bass'
            ? Math.sin((time + phase) * Math.PI * 2 * 82) * 0.18
            : Math.sin((time + phase) * Math.PI * 2 * 110) * 0.025
    timeBuf[index] = Math.max(0, Math.min(255, Math.round(128 + sample * 127)))
  }
  return { freqBuf, timeBuf }
}

function eventFrames(kind: PixGridPerceptualAudioFixtureKind): readonly PixGridPerceptualAnalyserFrame[] {
  if (kind === 'kick') return [analyserFrame(42, 20, 16, kind, 61)]
  if (kind === 'snare') return [analyserFrame(24, 34, 16, kind, 61)]
  if (kind === 'hat') return [analyserFrame(24, 20, 36, kind, 61)]
  if (kind === 'bass') {
    return [28, 32, 36, 40, 44, 48, 48, 48, 48, 48, 48, 48]
      .map((low, index) => analyserFrame(low, 20, 16, kind, 61 + index))
  }
  return [analyserFrame(24, 20, 16, 'quiet', 61)]
}

/**
 * Repository-owned deterministic audio/analyser fixture. The initial peak establishes the
 * running normalization range, sixty ordinary frames settle the live filters, and the final
 * frames model ordinary-strength percussion or sustained bass rather than 1.0-only inputs.
 */
export function createPixGridPerceptualAnalyserFixture(
  kind: PixGridPerceptualAudioFixtureKind,
): PixGridPerceptualAnalyserFixture {
  return {
    sampleRate: SAMPLE_RATE,
    calibration: analyserFrame(180, 160, 140, 'quiet', 0),
    baseline: Array.from({ length: 60 }, (_, index) => analyserFrame(24, 20, 16, 'quiet', index + 1)),
    event: eventFrames(kind),
  }
}
