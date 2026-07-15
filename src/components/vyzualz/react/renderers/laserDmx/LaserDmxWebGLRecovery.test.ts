import { describe, expect, it } from 'vitest'
import {
  beginAutomaticLaserDmxWebGLRetry,
  beginManualLaserDmxWebGLRetry,
  canAutomaticallyRetryLaserDmxWebGL,
  canManuallyRetryLaserDmxWebGL,
  createLaserDmxWebGLRecoveryState,
  LASER_DMX_WEBGL_AUTOMATIC_RETRY_BACKOFF_MS,
  LASER_DMX_WEBGL_MAX_AUTOMATIC_RETRIES,
  recordLaserDmxWebGLFailure,
  recordLaserDmxWebGLInitializationSuccess,
} from './LaserDmxWebGLRecovery'

describe('LaserDMX bounded WebGL recovery', () => {
  it('uses stepped cooldowns and stops automatic retry after the bounded limit', () => {
    let state = recordLaserDmxWebGLFailure(createLaserDmxWebGLRecoveryState(), {
      code: 'gpu-resource-allocation-failed',
      nowMs: 1_000,
    })
    expect(state.failureClassification).toBe('transient')
    expect(state.nextRetryAtMs).toBe(1_000 + LASER_DMX_WEBGL_AUTOMATIC_RETRY_BACKOFF_MS[0]!)
    expect(canAutomaticallyRetryLaserDmxWebGL(state, state.nextRetryAtMs! - 1)).toBe(false)

    for (let retry = 1; retry <= LASER_DMX_WEBGL_MAX_AUTOMATIC_RETRIES; retry += 1) {
      state = beginAutomaticLaserDmxWebGLRetry(state)
      expect(state.retryCount).toBe(retry)
      state = recordLaserDmxWebGLFailure(state, {
        code: 'gpu-resource-allocation-failed',
        nowMs: 2_000 * retry,
      })
    }
    expect(state.nextRetryAtMs).toBeNull()
    expect(state.finalFallbackReason).toContain('retry limit reached')
    expect(canAutomaticallyRetryLaserDmxWebGL(state, Number.MAX_SAFE_INTEGER)).toBe(false)
    expect(canManuallyRetryLaserDmxWebGL(state)).toBe(true)
  })

  it('does not automatically retry session-stable capability and shader failures', () => {
    for (const code of ['webgl2-unavailable', 'shader-compile-failed', 'repeated-context-loss'] as const) {
      const state = recordLaserDmxWebGLFailure(createLaserDmxWebGLRecoveryState(), { code, nowMs: 500 })
      expect(state.failureClassification, code).toBe('session-stable')
      expect(state.nextRetryAtMs, code).toBeNull()
      expect(state.finalFallbackReason, code).toBeTruthy()
      expect(canManuallyRetryLaserDmxWebGL(state), code).toBe(false)
    }
  })

  it('manual retry clears retryable failure memory and success clears cooldown while retaining lifecycle history', () => {
    const failed = recordLaserDmxWebGLFailure(createLaserDmxWebGLRecoveryState(), {
      code: 'context-lost',
      nowMs: 2_000,
      contextLossCount: 1,
    })
    const manual = beginManualLaserDmxWebGLRetry({ ...failed, retryCount: 2 })
    expect(manual).toMatchObject({ failureCode: null, retryCount: 0, nextRetryAtMs: null, contextLossCount: 1 })
    const recovered = recordLaserDmxWebGLInitializationSuccess(manual, 3_000, 1)
    expect(recovered).toMatchObject({
      failureCode: null,
      lastSuccessfulInitializationMs: 3_000,
      contextLossCount: 1,
      finalFallbackReason: null,
    })
  })
})
