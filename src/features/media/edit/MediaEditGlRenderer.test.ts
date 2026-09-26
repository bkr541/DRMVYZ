// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { MediaEditRenderer } from './MediaEditGlRenderer'

/** A WebGL2 stand-in: every call succeeds, and `loseContext` is observable. */
function fakeCanvas() {
  const loseContext = vi.fn()
  const gl = new Proxy({}, {
    get(_target, name) {
      if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true
      if (name === 'isContextLost') return () => false
      if (name === 'getExtension') return (extension: string) => (extension === 'WEBGL_lose_context' ? { loseContext } : null)
      if (name === 'COMPILE_STATUS' || name === 'LINK_STATUS') return 1
      return () => ({})
    },
  })
  const canvas = document.createElement('canvas')
  canvas.getContext = (() => gl) as unknown as HTMLCanvasElement['getContext']
  return { canvas, loseContext }
}

describe('MediaEditRenderer.dispose', () => {
  it('releases the GPU context by default (throwaway export canvases)', () => {
    const { canvas, loseContext } = fakeCanvas()
    MediaEditRenderer.create(canvas)!.dispose()
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('keeps the context when told to, so a canvas React remounts (StrictMode) can build a renderer again', () => {
    const { canvas, loseContext } = fakeCanvas()
    const first = MediaEditRenderer.create(canvas)!
    first.dispose(false)
    expect(loseContext).not.toHaveBeenCalled()
    // The second mount on the same element still gets a working renderer.
    const second = MediaEditRenderer.create(canvas)
    expect(second).not.toBeNull()
    second!.dispose()
  })
})
