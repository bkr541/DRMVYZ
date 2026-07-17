// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FEEDBACK_KALEIDOSCOPE } from '../scenes'
import { ShaderCompilePanel } from './ShaderCompilePanel'
import { ShaderPassInspector } from './ShaderPassInspector'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('Shader renderer diagnostics layout', () => {
  it('uses the native diagnostics grid for compile, performance, and pass details', async () => {
    await act(async () => root.render(
      <div className="rv-show-director-performance-status rv-shader-diagnostics">
        <ShaderCompilePanel
          definition={FEEDBACK_KALEIDOSCOPE}
          status={{ state: 'ok', lastOkAt: '2026-07-17T14:31:42.000Z' }}
        />
        <ShaderPassInspector
          definition={FEEDBACK_KALEIDOSCOPE}
          qualityTier="ultra"
          metrics={{
            cpuPrepMs: 0.3,
            gpuMs: 0.9,
            totalMs: 1.2,
            passCount: FEEDBACK_KALEIDOSCOPE.passes?.length ?? 1,
            renderTargetCount: 2,
            textureMb: 29.32,
            internalW: 1596,
            internalH: 1204,
            consecutiveSlowFrames: 0,
          }}
          passData={(FEEDBACK_KALEIDOSCOPE.passes ?? []).map(pass => ({
            passId: pass.id,
            compileState: 'ok',
            textureW: 1596,
            textureH: 1204,
          }))}
        />
      </div>,
    ))

    expect(container.querySelector('.rv-shader-compile-grid.rv-show-director-performance-status__grid')).not.toBeNull()
    expect(container.querySelector('.rv-shader-diagnostics-grid.rv-show-director-performance-status__grid')).not.toBeNull()
    expect(container.querySelectorAll('.rv-shader-pass-card')).toHaveLength(FEEDBACK_KALEIDOSCOPE.passes?.length ?? 1)
    expect(container.querySelector('.rv-shader-pass-row')).toBeNull()
    expect(container.textContent).toContain('No errors or warnings.')
    expect(container.textContent).toContain('Render Passes')
    expect(container.textContent).toContain('ultra')
  })
})
