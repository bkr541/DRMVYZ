import {
  laserDmxRendererFallbackReason,
  type LaserDmxRendererFallbackCode,
} from './LaserDmxRendererBackend'

export type LaserDmxWebGLFailureClassification = 'transient' | 'session-stable'

export interface LaserDmxWebGLRecoveryState {
  failureCode: LaserDmxRendererFallbackCode | null
  failureReason: string | null
  failureClassification: LaserDmxWebGLFailureClassification | null
  failureTimestampMs: number | null
  retryCount: number
  nextRetryAtMs: number | null
  lastSuccessfulInitializationMs: number | null
  contextLossCount: number
  finalFallbackReason: string | null
}

export interface LaserDmxWebGLFailureInput {
  code: LaserDmxRendererFallbackCode
  reason?: string | null
  nowMs: number
  contextLossCount?: number
}

export const LASER_DMX_WEBGL_AUTOMATIC_RETRY_BACKOFF_MS = Object.freeze([1_000, 3_000, 8_000])
export const LASER_DMX_WEBGL_MAX_AUTOMATIC_RETRIES = LASER_DMX_WEBGL_AUTOMATIC_RETRY_BACKOFF_MS.length

export function createLaserDmxWebGLRecoveryState(): LaserDmxWebGLRecoveryState {
  return {
    failureCode: null,
    failureReason: null,
    failureClassification: null,
    failureTimestampMs: null,
    retryCount: 0,
    nextRetryAtMs: null,
    lastSuccessfulInitializationMs: null,
    contextLossCount: 0,
    finalFallbackReason: null,
  }
}

export function classifyLaserDmxWebGLRecoveryFailure(
  code: LaserDmxRendererFallbackCode,
): LaserDmxWebGLFailureClassification {
  switch (code) {
    case 'webgl2-unavailable':
    case 'shader-compile-failed':
    case 'repeated-context-loss':
    case 'forced-canvas2d':
      return 'session-stable'
    case 'context-lost':
    case 'gpu-resource-allocation-failed':
    case 'runtime-render-failed':
      return 'transient'
  }
}

function nextRetryAtMs(state: LaserDmxWebGLRecoveryState, nowMs: number): number | null {
  if (state.failureClassification !== 'transient') return null
  if (state.retryCount >= LASER_DMX_WEBGL_MAX_AUTOMATIC_RETRIES) return null
  return nowMs + LASER_DMX_WEBGL_AUTOMATIC_RETRY_BACKOFF_MS[state.retryCount]!
}

export function recordLaserDmxWebGLFailure(
  previous: LaserDmxWebGLRecoveryState,
  input: LaserDmxWebGLFailureInput,
): LaserDmxWebGLRecoveryState {
  const failureClassification = classifyLaserDmxWebGLRecoveryFailure(input.code)
  const next: LaserDmxWebGLRecoveryState = {
    ...previous,
    failureCode: input.code,
    failureReason: input.reason?.trim() || laserDmxRendererFallbackReason(input.code),
    failureClassification,
    failureTimestampMs: input.nowMs,
    contextLossCount: Math.max(previous.contextLossCount, input.contextLossCount ?? 0),
    finalFallbackReason: null,
  }
  const retryAt = nextRetryAtMs(next, input.nowMs)
  return {
    ...next,
    nextRetryAtMs: retryAt,
    finalFallbackReason: retryAt == null
      ? (failureClassification === 'session-stable'
          ? next.failureReason
          : `${next.failureReason} Automatic WebGL retry limit reached.`)
      : null,
  }
}

export function canAutomaticallyRetryLaserDmxWebGL(
  state: LaserDmxWebGLRecoveryState,
  nowMs: number,
): boolean {
  return state.failureClassification === 'transient'
    && state.nextRetryAtMs != null
    && state.retryCount < LASER_DMX_WEBGL_MAX_AUTOMATIC_RETRIES
    && nowMs >= state.nextRetryAtMs
}

export function beginAutomaticLaserDmxWebGLRetry(
  state: LaserDmxWebGLRecoveryState,
): LaserDmxWebGLRecoveryState {
  if (state.failureClassification !== 'transient') return state
  return {
    ...state,
    retryCount: Math.min(LASER_DMX_WEBGL_MAX_AUTOMATIC_RETRIES, state.retryCount + 1),
    nextRetryAtMs: null,
    finalFallbackReason: null,
  }
}

export function beginManualLaserDmxWebGLRetry(
  state: LaserDmxWebGLRecoveryState,
): LaserDmxWebGLRecoveryState {
  return {
    ...state,
    failureCode: null,
    failureReason: null,
    failureClassification: null,
    failureTimestampMs: null,
    retryCount: 0,
    nextRetryAtMs: null,
    finalFallbackReason: null,
  }
}

export function recordLaserDmxWebGLInitializationSuccess(
  state: LaserDmxWebGLRecoveryState,
  nowMs: number,
  contextLossCount = state.contextLossCount,
): LaserDmxWebGLRecoveryState {
  return {
    ...createLaserDmxWebGLRecoveryState(),
    lastSuccessfulInitializationMs: nowMs,
    contextLossCount: Math.max(state.contextLossCount, contextLossCount),
  }
}

export function canManuallyRetryLaserDmxWebGL(state: LaserDmxWebGLRecoveryState): boolean {
  return state.failureCode != null && state.failureClassification === 'transient'
}
