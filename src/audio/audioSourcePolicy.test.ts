import { beforeEach, describe, expect, it } from 'vitest'
import {
  getAudioSourcePolicyBlockedAttemptId,
  getLastAudioSourcePolicyMessage,
  isShowManagerAudioSourceLocked,
  isShowManagerTransportReady,
  requestAudioSourceMutation,
  resetAudioSourcePolicyForTests,
  setAudioSourcePolicyAppView,
  setShowManagerLinkedAudioTrackId,
  SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE,
} from './audioSourcePolicy'

beforeEach(() => resetAudioSourcePolicyForTests())

describe('audioSourcePolicy', () => {
  it('blocks user source replacement throughout Show Manager, including its empty state', () => {
    setAudioSourcePolicyAppView('showManager')

    expect(isShowManagerAudioSourceLocked()).toBe(true)
    expect(requestAudioSourceMutation()).toBe(false)
    expect(getAudioSourcePolicyBlockedAttemptId()).toBe(1)
    expect(getLastAudioSourcePolicyMessage()).toBe(SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE)
    expect(isShowManagerTransportReady('track-a')).toBe(false)
  })

  it('allows only the explicit linked-track authority and gates transport to that linked identity', () => {
    setAudioSourcePolicyAppView('showManager')
    setShowManagerLinkedAudioTrackId('track-b')

    expect(requestAudioSourceMutation({ authority: 'showManagerLinkedTrack' })).toBe(true)
    expect(getAudioSourcePolicyBlockedAttemptId()).toBe(0)
    expect(isShowManagerTransportReady('track-a')).toBe(false)
    expect(isShowManagerTransportReady('track-b')).toBe(true)
  })

  it('restores normal source mutation immediately outside Show Manager', () => {
    setAudioSourcePolicyAppView('showManager')
    expect(requestAudioSourceMutation()).toBe(false)

    setAudioSourcePolicyAppView('react')

    expect(isShowManagerAudioSourceLocked()).toBe(false)
    expect(requestAudioSourceMutation()).toBe(true)
    expect(getLastAudioSourcePolicyMessage()).toBeNull()
    expect(isShowManagerTransportReady('unrelated-track')).toBe(true)
  })
})
