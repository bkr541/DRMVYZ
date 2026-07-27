import { describe, it, expect } from 'vitest'
import { ShaderWaveformTextureXY, WAVEFORM_XY_SAMPLE_COUNT_DEFAULT, WAVEFORM_XY_MIN_SAMPLE_COUNT } from '../ShaderWaveformTextureXY'

function makeGl() {
  const texSubImage2DCalls: unknown[][] = []
  const texImage2DCalls: unknown[][] = []
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
    texImage2D: (...args: unknown[]) => { texImage2DCalls.push(args) },
    texSubImage2D: (...args: unknown[]) => { texSubImage2DCalls.push(args) },

    _texSubImage2DCalls: texSubImage2DCalls,
    _texImage2DCalls: texImage2DCalls,
  }
  return gl as unknown as WebGL2RenderingContext & typeof gl
}

const FLOAT_CAPABLE = { colorBufferFloat: true, floatBlend: true }
const NO_FLOAT = { colorBufferFloat: false, floatBlend: false }

describe('ShaderWaveformTextureXY', () => {
  it('defaults to WAVEFORM_XY_SAMPLE_COUNT_DEFAULT (>= 2048)', () => {
    const tex = new ShaderWaveformTextureXY(makeGl(), undefined, FLOAT_CAPABLE)
    expect(tex.sampleCount).toBe(WAVEFORM_XY_SAMPLE_COUNT_DEFAULT)
    expect(tex.sampleCount).toBeGreaterThanOrEqual(2048)
  })

  it('never allows a sample count below WAVEFORM_XY_MIN_SAMPLE_COUNT', () => {
    const tex = new ShaderWaveformTextureXY(makeGl(), 16, FLOAT_CAPABLE)
    expect(tex.sampleCount).toBe(WAVEFORM_XY_MIN_SAMPLE_COUNT)
  })

  it('respects a larger explicit sample count', () => {
    const tex = new ShaderWaveformTextureXY(makeGl(), 4096, FLOAT_CAPABLE)
    expect(tex.sampleCount).toBe(4096)
  })

  it('uses RG16F float storage when the device reports float-target capability', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTextureXY(gl, 2048, FLOAT_CAPABLE)
    expect(tex.usesFloatStorage).toBe(true)
    const [, , internalFormat] = gl._texImage2DCalls[0]
    expect(internalFormat).toBe(gl.RG16F)
  })

  it('falls back to RGBA8 (packed) storage when float-target capability is unavailable', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTextureXY(gl, 2048, NO_FLOAT)
    expect(tex.usesFloatStorage).toBe(false)
    const [, , internalFormat] = gl._texImage2DCalls[0]
    expect(internalFormat).toBe(gl.RGBA8)
  })

  it('reuses the same channel buffer objects across updates (no per-frame allocation)', () => {
    const tex = new ShaderWaveformTextureXY(makeGl(), 2048, FLOAT_CAPABLE)
    const refA = tex.channelABuffer
    const refB = tex.channelBBuffer
    tex.update(new Float32Array(2048).fill(0.5), new Float32Array(2048).fill(-0.5))
    tex.update(new Float32Array(2048).fill(0.1), new Float32Array(2048).fill(0.2))
    expect(tex.channelABuffer).toBe(refA)
    expect(tex.channelBBuffer).toBe(refB)
  })

  it('uses texSubImage2D (not a fresh texImage2D) for updates', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTextureXY(gl, 2048, FLOAT_CAPABLE)
    const imageCallsBefore = gl._texImage2DCalls.length
    tex.update(new Float32Array(2048), new Float32Array(2048))
    expect(gl._texSubImage2DCalls.length).toBe(1)
    expect(gl._texImage2DCalls.length).toBe(imageCallsBefore) // unchanged — no re-allocation
  })

  it('fills both channels with silence (0) when null is passed', () => {
    const tex = new ShaderWaveformTextureXY(makeGl(), 2048, FLOAT_CAPABLE)
    tex.update(new Float32Array(2048).fill(0.9), new Float32Array(2048).fill(0.9))
    tex.update(null, null)
    expect(tex.channelABuffer.every(v => v === 0)).toBe(true)
    expect(tex.channelBBuffer.every(v => v === 0)).toBe(true)
  })

  it('zero-fills the tail when input is shorter than sampleCount', () => {
    const tex = new ShaderWaveformTextureXY(makeGl(), 2048, FLOAT_CAPABLE)
    const short = new Float32Array(8).fill(0.7)
    tex.update(short, short)
    expect(tex.channelABuffer[0]).toBeCloseTo(0.7)
    expect(tex.channelABuffer[8]).toBe(0)
    expect(tex.channelABuffer[2047]).toBe(0)
  })

  it('clamps out-of-range samples to [-1, 1] in the float storage path', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTextureXY(gl, 2048, FLOAT_CAPABLE)
    tex.update(new Float32Array(2048).fill(5), new Float32Array(2048).fill(-5))
    const [, , , , , , , , uploadBuf] = gl._texSubImage2DCalls[0] as [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, Float32Array]
    expect(uploadBuf[0]).toBe(1)   // channel A clamped to +1
    expect(uploadBuf[1]).toBe(-1)  // channel B clamped to -1
  })

  it('RGBA8 fallback packs each channel as a 16-bit value reconstructible from its (hi,lo) byte pair', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTextureXY(gl, 2048, NO_FLOAT)
    const valueA = 0.42
    const valueB = -0.17
    const a = new Float32Array(2048); a[0] = valueA
    const b = new Float32Array(2048); b[0] = valueB
    tex.update(a, b)
    const [, , , , , , , , uploadBuf] = gl._texSubImage2DCalls[0] as [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, Uint8Array]
    const [hiA, loA, hiB, loB] = [uploadBuf[0], uploadBuf[1], uploadBuf[2], uploadBuf[3]]
    const reconstructedA = ((hiA * 256 + loA) / 65535) * 2 - 1
    const reconstructedB = ((hiB * 256 + loB) / 65535) * 2 - 1
    expect(reconstructedA).toBeCloseTo(valueA, 3)
    expect(reconstructedB).toBeCloseTo(valueB, 3)
  })

  it('dispose() deletes the underlying texture', () => {
    let deleted = false
    const gl = makeGl()
    gl.deleteTexture = () => { deleted = true }
    const tex = new ShaderWaveformTextureXY(gl, 2048, FLOAT_CAPABLE)
    tex.dispose()
    expect(deleted).toBe(true)
  })
})
