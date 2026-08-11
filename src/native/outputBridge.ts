export type OutputWindowMode = 'windowed' | 'borderless' | 'fullscreen'
export type OutputAspectRatio = '16:9' | '16:10' | '4:3' | '3:2' | '1:1' | '9:16'
export type OutputTargetKind = 'display' | 'network'
export type OutputProviderId = 'local-display' | 'drmvyz-receiver' | 'airplay' | 'miracast' | 'google-cast' | (string & {})
export type OutputCastState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'failed'

export type OutputProviderState = 'available' | 'unavailable' | 'unsupported' | 'permission-required' | 'configuration-required' | 'initialization-failed'

export interface OutputProviderCapabilities {
  targetEnumeration: boolean
  sessions: boolean
  picker: boolean
  actions: string[]
}

export interface OutputProviderStatus {
  providerId: OutputProviderId
  label: string
  state: OutputProviderState
  targetCount: number
  message: string | null
  capabilities?: OutputProviderCapabilities
}

export interface OutputProviderActionResult {
  providerId: OutputProviderId
  actionId: string
  state: string
  message?: string | null
  targetId?: string | null
  session?: OutputCastSession | null
}

export interface OutputTarget {
  id: string
  kind: OutputTargetKind
  name: string
  detail: string
  available: boolean
  displayId?: string
  receiverId?: string
  receiverDisplayId?: string
  receiverDisplayName?: string
  receiverPaired?: boolean
  receiverProtocolVersion?: number
  googleCastTransactionId?: string
  googleCastReceiverId?: string | null
  receiverVideoCapabilities?: {
    transport?: string
    codecNegotiation?: string
    codecs?: string[]
    maxLongEdge?: number
    maxShortEdge?: number
    maxFps?: number
    maxVideoBitrateKbps?: number
    statsIntervalMs?: number
  }
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


export interface OutputTransportStats {
  timestampMs: number
  width: number | null
  height: number | null
  framesPerSecond: number | null
  bitrateKbps: number | null
  roundTripTimeMs: number | null
  packetsLost: number | null
}

export interface OutputCastSession {
  id: string
  targetId: string
  targetName: string
  providerId?: OutputProviderId
  transport?: 'webrtc' | 'google-cast-webm' | (string & {})
  windowMode: OutputWindowMode
  aspectRatio: OutputAspectRatio
  state: OutputCastState
  error: string | null
  stats?: OutputTransportStats | null
}

export interface OutputReceiverRequest {
  sessionId: string
}

export interface NativeOutputBridge {
  listTargets: () => Promise<OutputTarget[]>
  getTargetSnapshot?: () => Promise<OutputTargetSnapshot>
  getSession: () => Promise<OutputCastSession | null>
  performProviderAction?: (providerId: OutputProviderId, actionId: string, payload?: unknown) => Promise<OutputProviderActionResult>
  startCast: (request: OutputCastRequest) => Promise<OutputCastSession | null>
  stopCast: () => Promise<null>
  publishOffer: (sessionId: string, offer: RTCSessionDescriptionInit) => Promise<boolean>
  waitForAnswer: (sessionId: string) => Promise<RTCSessionDescriptionInit>
  failSession: (sessionId: string, message: string) => Promise<boolean>
  beginGoogleCastStream?: (sessionId: string, metadata: { mimeType: string; width: number; height: number; framesPerSecond: number }) => Promise<{ ok: boolean; mediaUrls?: string[] }>
  publishGoogleCastChunk?: (sessionId: string, chunk: Uint8Array) => Promise<boolean>
  endGoogleCastStream?: (sessionId: string) => Promise<boolean>
  reportStats?: (sessionId: string, stats: OutputTransportStats) => Promise<boolean>
  onTargetsChanged: (callback: (targets: OutputTarget[]) => void) => () => void
  onTargetSnapshotChanged?: (callback: (snapshot: OutputTargetSnapshot) => void) => () => void
  onSessionChanged: (callback: (session: OutputCastSession | null) => void) => () => void
  onReceiverRequested: (callback: (request: OutputReceiverRequest) => void) => () => void
}

export function getNativeOutputBridge(): NativeOutputBridge | null {
  if (typeof window === 'undefined') return null
  return window.drmvyzNative?.output ?? null
}
