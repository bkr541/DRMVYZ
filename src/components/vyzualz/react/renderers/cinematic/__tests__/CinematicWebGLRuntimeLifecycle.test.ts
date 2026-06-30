import { describe, expect, it } from 'vitest'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import { cinematicLifecycleResetReason } from '../CinematicWebGLRuntime'

function frame(input: {
  timingDiscontinuity?: boolean
  resetReasons?: Array<'seek' | 'trackReplacement' | 'transportRestart' | 'worldReplacement' | 'presetReplacement'>
}): CinematicFrameContext {
  return {
    timingDiscontinuity: input.timingDiscontinuity,
    musicalAudio: input.resetReasons ? { resetReasons: input.resetReasons } : undefined,
  } as unknown as CinematicFrameContext
}

describe('Cinematic WebGL lifecycle reset metadata', () => {
  it('preserves the concrete timing and Music Intelligence reset reason', () => {
    expect(cinematicLifecycleResetReason(frame({ timingDiscontinuity: true, resetReasons: ['seek'] })))
      .toBe('timingDiscontinuity')
    expect(cinematicLifecycleResetReason(frame({ resetReasons: ['seek'] }))).toBe('seek')
    expect(cinematicLifecycleResetReason(frame({ resetReasons: ['presetReplacement'] }))).toBe('presetReplacement')
    expect(cinematicLifecycleResetReason(frame({ resetReasons: ['worldReplacement'] }))).toBe('worldReplacement')
  })

  it('uses a deterministic safety priority when multiple reset reasons share a frame', () => {
    expect(cinematicLifecycleResetReason(frame({
      resetReasons: ['transportRestart', 'seek', 'trackReplacement'],
    }))).toBe('trackReplacement')
    expect(cinematicLifecycleResetReason(frame({}))).toBeNull()
  })
})
