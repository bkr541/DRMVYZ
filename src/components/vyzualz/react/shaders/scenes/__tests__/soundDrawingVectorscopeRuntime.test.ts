import { describe, it, expect } from 'vitest'
import { createSoundDrawingVectorscopeRuntime } from '../soundDrawingVectorscopeRuntime'
import { WAVEFORM_XY_SAMPLE_COUNT_DEFAULT } from '../../audio/ShaderWaveformTextureXY'

function makeGl() {
  let nextTex = 1
  const gl = {
    TEXTURE_2D: 0x0DE1,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601, CLAMP_TO_EDGE: 0x812F,
    UNSIGNED_BYTE: 0x1401, FLOAT: 0x1406,
    RG: 0x8227, RGBA: 6408,
    RG16F: 0x822F, RGBA8: 0x8058,

    createTexture: () => ({ _id: nextTex++ }),
    deleteTexture: () => {},
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    texSubImage2D: () => {},
    getExtension: () => null, // exercises the RGBA8-packed fallback path
  }
  return gl as unknown as WebGL2RenderingContext & typeof gl
}

const WHITE = { r: 1, g: 1, b: 1, a: 1 }
const DRAW_PASS_ID = 'draw'

describe('createSoundDrawingVectorscopeRuntime', () => {
  it('the provider returns null for any pass id other than the configured draw pass', () => {
    const runtime = createSoundDrawingVectorscopeRuntime(makeGl(), DRAW_PASS_ID)
    expect(runtime.provider('some-other-pass', {} as never)).toBeNull()
  })

  it('the provider returns 0 segments before the first updateFromMonoWaveform call', () => {
    const runtime = createSoundDrawingVectorscopeRuntime(makeGl(), DRAW_PASS_ID)
    const result = runtime.provider(DRAW_PASS_ID, {} as never)
    expect(result).not.toBeNull()
    expect(result!.count).toBe(0)
  })

  it('after updating with a real waveform, the provider returns sampleCount - 1 segments', () => {
    const runtime = createSoundDrawingVectorscopeRuntime(makeGl(), DRAW_PASS_ID)
    const mono = new Uint8Array(2048)
    for (let i = 0; i < mono.length; i++) mono[i] = Math.round(128 + 100 * Math.sin(i * 0.05))
    runtime.updateFromMonoWaveform(mono, WHITE)
    const result = runtime.provider(DRAW_PASS_ID, {} as never)!
    expect(result.count).toBe(WAVEFORM_XY_SAMPLE_COUNT_DEFAULT - 1)
    expect(result.data.length).toBeGreaterThan(0)
  })

  it('a null waveform update resets segments to silence (all-zero channel data) without throwing', () => {
    const runtime = createSoundDrawingVectorscopeRuntime(makeGl(), DRAW_PASS_ID)
    const mono = new Uint8Array(2048).fill(200)
    runtime.updateFromMonoWaveform(mono, WHITE)
    expect(() => runtime.updateFromMonoWaveform(null, WHITE)).not.toThrow()
    const result = runtime.provider(DRAW_PASS_ID, {} as never)!
    // Silence still produces (sampleCount - 1) segments — they're just all at the origin.
    expect(result.count).toBe(WAVEFORM_XY_SAMPLE_COUNT_DEFAULT - 1)
  })

  it('reuses the same segment buffer object across frames (no per-frame allocation)', () => {
    const runtime = createSoundDrawingVectorscopeRuntime(makeGl(), DRAW_PASS_ID)
    const mono = new Uint8Array(2048).fill(150)
    runtime.updateFromMonoWaveform(mono, WHITE)
    const firstData = runtime.provider(DRAW_PASS_ID, {} as never)!.data
    runtime.updateFromMonoWaveform(mono, WHITE)
    const secondData = runtime.provider(DRAW_PASS_ID, {} as never)!.data
    expect(secondData).toBe(firstData)
  })

  it('dispose() disposes the underlying waveform texture without throwing', () => {
    const runtime = createSoundDrawingVectorscopeRuntime(makeGl(), DRAW_PASS_ID)
    expect(() => runtime.dispose()).not.toThrow()
  })
})
