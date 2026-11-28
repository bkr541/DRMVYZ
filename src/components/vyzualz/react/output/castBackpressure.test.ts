import { describe, expect, it } from 'vitest'
import { CAST_SEND_QUEUE_LIMITS, castSendQueueState } from './castBackpressure'

describe('Google Cast send queue (PERF-02)', () => {
  it('is fine while it keeps up, warns a couple of seconds behind, and ends the session when it falls well behind or holds too much', () => {
    expect(castSendQueueState(1, 200_000)).toBe('ok')
    expect(castSendQueueState(CAST_SEND_QUEUE_LIMITS.behindChunks + 1, 1_000_000)).toBe('behind')
    expect(castSendQueueState(CAST_SEND_QUEUE_LIMITS.maxChunks + 1, 1_000_000)).toBe('overflow')
    expect(castSendQueueState(3, CAST_SEND_QUEUE_LIMITS.maxBytes + 1)).toBe('overflow')
  })
})
