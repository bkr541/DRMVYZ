import { describe, expect, it } from 'vitest'
import { resolveCinema2StageTransportTrackId } from '../../react/Cinema2Stage'

describe('Cinema2Stage transport identity', () => {
  it('uses the Audio Intelligence source identity when a persisted track has a different database id', () => {
    expect(resolveCinema2StageTransportTrackId('runtime-track-id', 'persisted-audio-id')).toBe('runtime-track-id')
  })

  it('retains the persisted identity fallback for hosts without an Audio Intelligence identity', () => {
    expect(resolveCinema2StageTransportTrackId(null, 'persisted-audio-id')).toBe('persisted-audio-id')
    expect(resolveCinema2StageTransportTrackId(undefined, undefined)).toBeNull()
  })
})
