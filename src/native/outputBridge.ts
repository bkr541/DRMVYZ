export type OutputWindowMode = 'windowed' | 'borderless' | 'fullscreen'
export type OutputAspectRatio = '16:9' | '16:10' | '4:3' | '3:2' | '1:1' | '9:16'
export type OutputTargetKind = 'display' | 'network'
export type OutputProviderId = 'local-display' | 'drmvyz-receiver' | 'airplay' | 'miracast' | 'google-cast' | (string & {})
export type OutputCastState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'failed'

export type OutputProviderState = 'available' | 'unavailable' | 'unsupported' | 'permission-required' | 'initialization-failed'

export interface OutputProviderStatus {
  providerId: OutputProviderId
  label: string
  state: OutputProviderState
  targetCount: number
  message: string | null
}

export interface OutputTarget {
  id: string
  kind: OutputTargetKind
  name: string
  detail: string
  available: boolean
  displayId?: string
  receiverId?: string
  providerId?: OutputProviderId
}

export interface OutputTargetSnapshot {
  targets: OutputTarget[]
  providers: OutputProviderStatus[]
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
  providerId?: OutputProviderId
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
  getTargetSnapshot?: () => Promise<OutputTargetSnapshot>
  getSession: () => Promise<OutputCastSession | null>
  startCast: (request: OutputCastRequest) => Promise<OutputCastSession | null>
  stopCast: () => Promise<null>
  publishOffer: (sessionId: string, offer: RTCSessionDescriptionInit) => Promise<boolean>
  waitForAnswer: (sessionId: string) => Promise<RTCSessionDescriptionInit>
  failSession: (sessionId: string, message: string) => Promise<boolean>
  onTargetsChanged: (callback: (targets: OutputTarget[]) => void) => () => void
  onTargetSnapshotChanged?: (callback: (snapshot: OutputTargetSnapshot) => void) => () => void
  onSessionChanged: (callback: (session: OutputCastSession | null) => void) => () => void
  onReceiverRequested: (callback: (request: OutputReceiverRequest) => void) => () => void
}

export function getNativeOutputBridge(): NativeOutputBridge | null {
  if (typeof window === 'undefined') return null
  return window.drmvyzNative?.output ?? null
}
