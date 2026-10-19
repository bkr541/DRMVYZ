import { describe, expect, it } from 'vitest'
import { createU2NetInput, normalizeU2NetMask, resolveBackgroundRemovalWasmUrl } from './removeImageBackground'

describe('background-removal model preparation', () => {
  it('resolves the emitted ONNX runtime binary against HTTP and Electron app origins', () => {
    const developmentUrl = resolveBackgroundRemovalWasmUrl('http://127.0.0.1:5173/media')
    const packagedUrl = resolveBackgroundRemovalWasmUrl('drmvyz-app://app/index.html')

    expect(developmentUrl).toMatch(/^http:\/\/127\.0\.0\.1:5173\/.+\.wasm(?:\?.*)?$/)
    expect(packagedUrl).toMatch(/^drmvyz-app:\/\/app\/.+\.wasm(?:\?.*)?$/)
  })

  it('creates a planar 320x320 normalized tensor without producing NaN for a black image', () => {
    const pixels = new Uint8ClampedArray(320 * 320 * 4)
    const input = createU2NetInput(pixels)

    expect(input).toHaveLength(3 * 320 * 320)
    expect(Number.isFinite(input[0])).toBe(true)
    expect(input[0]).toBeCloseTo(-0.485 / 0.229)
  })

  it('normalizes the foreground prediction to an alpha mask', () => {
    expect([...normalizeU2NetMask(new Float32Array([2, 4, 6]))]).toEqual([0, 128, 255])
    expect([...normalizeU2NetMask(new Float32Array([3, 3]))]).toEqual([0, 0])
  })
})
