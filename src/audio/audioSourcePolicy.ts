import type { AppView } from '../components/vyzualz/appView'

export const SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE =
  'An audio track cannot be loaded while in Show Manager. Navigate to another workspace such as React, VYZUALZ, or Media Manager to load a different track.'

export type AudioSourceMutationAuthority = 'user' | 'showManagerLinkedTrack'

export interface AudioSourceMutationOptions {
  authority?: AudioSourceMutationAuthority
  notifyOnBlocked?: boolean
}

interface AudioSourcePolicyState {
  appView: AppView | null
  linkedAudioTrackId: string | null
  blockedAttemptId: number
  blockedMessage: string | null
}

let state: AudioSourcePolicyState = {
  appView: null,
  linkedAudioTrackId: null,
  blockedAttemptId: 0,
  blockedMessage: null,
}

const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach(listener => listener())
}

function normalizeTrackId(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized || null
}

export function setAudioSourcePolicyAppView(appView: AppView | null): void {
  if (state.appView === appView) return
  state = {
    ...state,
    appView,
    linkedAudioTrackId: appView === 'showManager' ? state.linkedAudioTrackId : null,
    blockedMessage: appView === 'showManager' ? state.blockedMessage : null,
  }
  emit()
}

export function setShowManagerLinkedAudioTrackId(trackId: string | null): void {
  const linkedAudioTrackId = normalizeTrackId(trackId)
  if (state.linkedAudioTrackId === linkedAudioTrackId) return
  state = { ...state, linkedAudioTrackId }
  emit()
}

export function isShowManagerAudioSourceLocked(): boolean {
  return state.appView === 'showManager'
}

export function getShowManagerLinkedAudioTrackId(): string | null {
  return state.appView === 'showManager' ? state.linkedAudioTrackId : null
}

export function requestAudioSourceMutation(options: AudioSourceMutationOptions = {}): boolean {
  if (state.appView !== 'showManager' || options.authority === 'showManagerLinkedTrack') return true

  if (options.notifyOnBlocked !== false) {
    state = {
      ...state,
      blockedAttemptId: state.blockedAttemptId + 1,
      blockedMessage: SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE,
    }
    emit()
  }
  return false
}

export function isShowManagerTransportReady(activeAudioTrackId: string | null | undefined): boolean {
  if (state.appView !== 'showManager') return true
  const linkedAudioTrackId = state.linkedAudioTrackId
  return linkedAudioTrackId !== null && normalizeTrackId(activeAudioTrackId) === linkedAudioTrackId
}

export function subscribeAudioSourcePolicy(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAudioSourcePolicySnapshot(): string {
  return `${state.appView ?? 'none'}|${state.linkedAudioTrackId ?? 'none'}|${state.blockedAttemptId}`
}

export function getLastAudioSourcePolicyMessage(): string | null {
  return state.blockedMessage
}

export function getAudioSourcePolicyBlockedAttemptId(): number {
  return state.blockedAttemptId
}

export function resetAudioSourcePolicyForTests(): void {
  state = {
    appView: null,
    linkedAudioTrackId: null,
    blockedAttemptId: 0,
    blockedMessage: null,
  }
  emit()
}
