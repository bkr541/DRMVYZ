/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { useReactStore } from '../stores/reactStore'
import { useNotificationStore } from '../stores/notificationStore'
import { RECOVERY_SAFE_PRESET_ID, installRendererRecovery } from './rendererRecovery'
import { getPerformancePressure, resetPerformancePressureForTests } from './performancePressure'

describe('recovery start against the real store', () => {
  afterEach(() => { resetPerformancePressureForTests(); window.history.replaceState(null, '', '/') })

  it('opens the light Cinema 2.0 preset, holds reduced quality, tells the user, and removes the flag from the address', () => {
    window.history.replaceState(null, '', '/?recovery=renderer-unresponsive')
    useReactStore.getState().selectReactEngine('pixGrid')
    expect(useReactStore.getState().activeReactEngineId).toBe('pixGrid')

    const stop = installRendererRecovery()
    try {
      expect(window.location.search).toBe('')
      expect(useReactStore.getState().activeReactEngineId).toBe('cinema2')
      expect(useReactStore.getState().cinema2Workspace.activePresetId).toBe(RECOVERY_SAFE_PRESET_ID)
      expect(getPerformancePressure()).toBe(2)
      const notices = useNotificationStore.getState().events.react
      expect(notices.some(event => event.title === 'Recovered from a graphics stall')).toBe(true)
    } finally { stop() }
  })

  it('does nothing without the flag', () => {
    useReactStore.getState().selectReactEngine('pixGrid')
    const stop = installRendererRecovery()
    try {
      expect(useReactStore.getState().activeReactEngineId).toBe('pixGrid')
      expect(getPerformancePressure()).toBe(0)
    } finally { stop() }
  })
})
