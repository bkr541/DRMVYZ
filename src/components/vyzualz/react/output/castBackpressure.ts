/**
 * The Google Cast live stream's send queue limits (beta remediation PERF-02).
 *
 * The encoder produces a WebM chunk every 250 ms and each is sent to the Cast bridge in order. Chunks of one live WebM stream cannot be dropped
 * without corrupting it, so when the network cannot keep up the queue is not allowed to grow without limit (rising delay, then memory): a few
 * seconds behind, the performer is told; well behind, the session ends with that reason, and casting can be started again.
 */
export const CAST_SEND_QUEUE_LIMITS = Object.freeze({
  /** About 2 seconds of video waiting to be sent. */
  behindChunks: 8,
  /** About 5 seconds waiting, or this much data, ends the session. */
  maxChunks: 20,
  maxBytes: 16 * 1024 * 1024,
})

export type CastSendQueueState = 'ok' | 'behind' | 'overflow'

export function castSendQueueState(pendingChunks: number, pendingBytes: number, limits = CAST_SEND_QUEUE_LIMITS): CastSendQueueState {
  if (pendingChunks > limits.maxChunks || pendingBytes > limits.maxBytes) return 'overflow'
  if (pendingChunks > limits.behindChunks) return 'behind'
  return 'ok'
}
