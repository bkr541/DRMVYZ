export type OutputWindowMode = 'windowed' | 'borderless' | 'fullscreen'
export type OutputAspectRatio = '16:9' | '16:10' | '4:3' | '3:2' | '1:1' | '9:16'
export type OutputTargetKind = 'display' | 'network'
export type OutputCastState = 'connecting' | 'connected' | 'stopping' | 'error'

export interface OutputTarget {
  id: string
  kind: OutputTargetKind
  name: string
  detail: string
  available: boolean
  displayId?: string
  receiverId?: string
}

export interface OutputCastRequest {
  targetId: string
  windowMode: OutputWindowMode
  aspectRatio: OutputAspectRatio
}

export interface OutputCastSession {
  id: string
  targetId: string
  targetName: string
  windowMode: OutputWindowMode
  aspectRatio: OutputAspectRatio
  state: OutputCastState
  error: string | null
}

export interface OutputReceiverRequest {
  sessionId: string
}

export interface NativeOutputBridge {
  listTargets: () => Promise<OutputTarget[]>
  getSession: () => Promise<OutputCastSession | null>
  startCast: (request: OutputCastRequest) => Promise<OutputCastSession | null>
  stopCast: () => Promise<null>
  publishOffer: (sessionId: string, offer: RTCSessionDescriptionInit) => Promise<boolean>
  waitForAnswer: (sessionId: string) => Promise<RTCSessionDescriptionInit>
  failSession: (sessionId: string, message: string) => Promise<boolean>
  onTargetsChanged: (callback: (targets: OutputTarget[]) => void) => () => void
  onSessionChanged: (callback: (session: OutputCastSession | null) => void) => () => void
  onReceiverRequested: (callback: (request: OutputReceiverRequest) => void) => () => void
}

export function getNativeOutputBridge(): NativeOutputBridge | null {
  if (typeof window === 'undefined') return null
  return window.drmvyzNative?.output ?? null
}
