import { describe, it, expect, vi } from 'vitest'
import { detectShaderFloatTargetCapability, resolveShaderTextureFormat } from '../ShaderCapabilities'

function makeGl(extensions: Set<string>) {
  return {
    getExtension: (name: string) => (extensions.has(name) ? {} : null),
  } as unknown as WebGL2RenderingContext
}

describe('detectShaderFloatTargetCapability', () => {
  it('reports both capabilities false when neither extension is present', () => {
    const cap = detectShaderFloatTargetCapability(makeGl(new Set()))
    expect(cap.colorBufferFloat).toBe(false)
    expect(cap.floatBlend).toBe(false)
  })

  it('reports colorBufferFloat true when EXT_color_buffer_float is present', () => {
    const cap = detectShaderFloatTargetCapability(makeGl(new Set(['EXT_color_buffer_float'])))
    expect(cap.colorBufferFloat).toBe(true)
    expect(cap.floatBlend).toBe(false)
  })

  it('reports floatBlend true when EXT_float_blend is present', () => {
    const cap = detectShaderFloatTargetCapability(makeGl(new Set(['EXT_float_blend'])))
    expect(cap.floatBlend).toBe(true)
  })

  it('reports both true when both extensions are present', () => {
    const cap = detectShaderFloatTargetCapability(makeGl(new Set(['EXT_color_buffer_float', 'EXT_float_blend'])))
    expect(cap.colorBufferFloat).toBe(true)
    expect(cap.floatBlend).toBe(true)
  })
})

describe('resolveShaderTextureFormat', () => {
  it('passes through rgba8 and r8 unconditionally (never float, nothing to gate)', () => {
    const cap = { colorBufferFloat: false, floatBlend: false }
    expect(resolveShaderTextureFormat('rgba8', false, cap)).toBe('rgba8')
    expect(resolveShaderTextureFormat('r8', true, cap)).toBe('r8')
  })

  it('keeps rgba16f when colorBufferFloat is available and no blending is needed', () => {
    const cap = { colorBufferFloat: true, floatBlend: false }
    expect(resolveShaderTextureFormat('rgba16f', false, cap)).toBe('rgba16f')
  })

  it('falls back to rgba8 when colorBufferFloat is unavailable', () => {
    const cap = { colorBufferFloat: false, floatBlend: false }
    expect(resolveShaderTextureFormat('rgba16f', false, cap)).toBe('rgba8')
    expect(resolveShaderTextureFormat('rgba32f', false, cap)).toBe('rgba8')
  })

  it('falls back to rgba8 when blending is needed but floatBlend is unavailable, even with colorBufferFloat present', () => {
    const cap = { colorBufferFloat: true, floatBlend: false }
    expect(resolveShaderTextureFormat('rgba16f', true, cap)).toBe('rgba8')
  })

  it('keeps rgba16f when blending is needed and both extensions are present', () => {
    const cap = { colorBufferFloat: true, floatBlend: true }
    expect(resolveShaderTextureFormat('rgba16f', true, cap)).toBe('rgba16f')
  })

  it('calls the warn callback exactly when a fallback occurs, and not otherwise', () => {
    const cap = { colorBufferFloat: false, floatBlend: false }
    const warn = vi.fn()
    resolveShaderTextureFormat('rgba16f', false, cap, warn)
    expect(warn).toHaveBeenCalledTimes(1)

    const warnOk = vi.fn()
    resolveShaderTextureFormat('rgba8', false, cap, warnOk)
    expect(warnOk).not.toHaveBeenCalled()

    const warnFloatOk = vi.fn()
    resolveShaderTextureFormat('rgba16f', false, { colorBufferFloat: true, floatBlend: true }, warnFloatOk)
    expect(warnFloatOk).not.toHaveBeenCalled()
  })
})
