import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { NoticeCard } from '../controls/NoticeCard'
import {
  CANVAS_OUTPUT_AVAILABLE,
  isCanvasFracturesOutputDeferred,
  isCanvasOutputAvailable,
  type CanvasOutputCapability,
} from '../canvasFracturesOutputContract'
import {
  getNativeOutputBridge,
  type NativeOutputBridge,
  type OutputAspectRatio,
  type OutputCastSession,
  type OutputProviderId,
  type OutputProviderStatus,
  type OutputTarget,
  type OutputTransportStats,
  type OutputWindowMode,
} from '../../../../native/outputBridge'

const WINDOW_OPTIONS: ReadonlyArray<{ id: OutputWindowMode; label: string; description: string }> = [
  { id: 'windowed', label: 'Window', description: 'Standard movable output window' },
  { id: 'borderless', label: 'Borderless', description: 'Clean edge-to-edge display window' },
  { id: 'fullscreen', label: 'Full Screen', description: 'Take over the selected screen' },
]

const ASPECT_OPTIONS: readonly OutputAspectRatio[] = ['16:9', '16:10', '4:3', '3:2', '1:1', '9:16']

function CastIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 15.05C3.96089 15.246 4.84294 15.7202 5.53638 16.4136C6.22982 17.1071 6.70403 17.9891 6.9 18.95M3 11C5.03079 11.2259 6.92428 12.136 8.36911 13.5809M10.95 18.95C10.8756 18.2814 10.7271 17.6277 10.5097 17M3 18.95H3.01M3 8V5H21V8M14 19H21V12" />
    </svg>
  )
}

function WindowModeIcon({ mode }: { mode: OutputWindowMode }) {
  if (mode === 'windowed') {
    return (
      <svg viewBox="0 0 28 22" aria-hidden="true">
        <rect x="3" y="4" width="22" height="15" rx="1.5" />
        <path d="M3 8h22M6 6h.01M9 6h.01" />
      </svg>
    )
  }

  if (mode === 'borderless') {
    return (
      <svg viewBox="0 0 28 22" aria-hidden="true">
        <path d="M4 8V4h4M20 4h4v4M24 14v4h-4M8 18H4v-4" />
        <rect x="6.5" y="6.5" width="15" height="9" rx=".8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 28 22" aria-hidden="true">
      <path d="M4 9V4h5M19 4h5v5M24 13v5h-5M9 18H4v-5M10 8 6 4M18 8l4-4M18 14l4 4M10 14l-4 4" />
    </svg>
  )
}

const ASPECT_ICON_SIZES: Record<OutputAspectRatio, { width: number; height: number }> = {
  '16:9': { width: 27, height: 15 },
  '16:10': { width: 27, height: 17 },
  '4:3': { width: 24, height: 18 },
  '3:2': { width: 24, height: 16 },
  '1:1': { width: 18, height: 18 },
  '9:16': { width: 12, height: 21 },
}

function AspectRatioIcon({ ratio }: { ratio: OutputAspectRatio }) {
  const size = ASPECT_ICON_SIZES[ratio]
  return (
    <svg viewBox="0 0 32 24" aria-hidden="true">
      <rect
        x={(32 - size.width) / 2}
        y={(24 - size.height) / 2}
        width={size.width}
        height={size.height}
        rx="1"
      />
    </svg>
  )
}

function AvailableDevicesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="7" r="2.5" />
      <circle cx="17" cy="8" r="2" />
      <path d="M3.5 18v-2.2A3.8 3.8 0 0 1 7.3 12h1.4a3.8 3.8 0 0 1 3.8 3.8V18M14 18v-1.6a3 3 0 0 1 3-3h.8a2.7 2.7 0 0 1 2.7 2.7V18" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M15.5 6.5V3.7m0 0h-2.8m2.8 0A7 7 0 1 0 17 10" />
    </svg>
  )
}

function DisplayIcon({ network }: { network: boolean }) {
  return network ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17.5a3.2 3.2 0 0 1 3.2 3.2M4 13a7.7 7.7 0 0 1 7.7 7.7M4 8.5V5h16v14h-5" />
      <circle cx="4" cy="20.7" r=".8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <path d="M9 21h6M12 17v4" />
    </svg>
  )
}

function waitForIceGatheringComplete(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', handleChange)
      resolve()
    }, 3_500)
    const handleChange = () => {
      if (peer.iceGatheringState !== 'complete') return
      window.clearTimeout(timeout)
      peer.removeEventListener('icegatheringstatechange', handleChange)
      resolve()
    }
    peer.addEventListener('icegatheringstatechange', handleChange)
  })
}

interface RelayCapture {
  stream: MediaStream
  stop: () => void
}

const RECEIVER_MAX_LONG_EDGE = 1920
const RECEIVER_MAX_SHORT_EDGE = 1080
const RECEIVER_MAX_FPS = 60
const RECEIVER_MAX_BITRATE_BPS = 12_000_000
const RECEIVER_STATS_INTERVAL_MS = 2_000
const RECEIVER_DISCONNECT_GRACE_MS = 3_000

function fitRelaySize(width: number, height: number): { width: number; height: number } {
  const safeWidth = Math.max(2, width || 1920)
  const safeHeight = Math.max(2, height || 1080)
  const landscape = safeWidth >= safeHeight
  const maxWidth = landscape ? RECEIVER_MAX_LONG_EDGE : RECEIVER_MAX_SHORT_EDGE
  const maxHeight = landscape ? RECEIVER_MAX_SHORT_EDGE : RECEIVER_MAX_LONG_EDGE
  const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight)
  return {
    width: Math.max(2, Math.round(safeWidth * scale)),
    height: Math.max(2, Math.round(safeHeight * scale)),
  }
}

function createRelayCapture(sourceRef: MutableRefObject<HTMLCanvasElement | null>): RelayCapture {
  const relay = document.createElement('canvas')
  const initial = fitRelaySize(sourceRef.current?.width ?? 1920, sourceRef.current?.height ?? 1080)
  relay.width = initial.width
  relay.height = initial.height
  const context = relay.getContext('2d', { alpha: false })
  if (!context || typeof relay.captureStream !== 'function') {
    throw new Error('Canvas streaming is unavailable in this runtime')
  }

  let stopped = false
  let frameId = 0
  const render = () => {
    if (stopped) return
    const source = sourceRef.current
    if (source && source.width > 0 && source.height > 0) {
      const next = fitRelaySize(source.width, source.height)
      if (relay.width !== next.width || relay.height !== next.height) {
        relay.width = next.width
        relay.height = next.height
      }
      context.drawImage(source, 0, 0, relay.width, relay.height)
    } else {
      context.fillStyle = '#000'
      context.fillRect(0, 0, relay.width, relay.height)
    }
    frameId = window.requestAnimationFrame(render)
  }
  render()
  const stream = relay.captureStream(RECEIVER_MAX_FPS)
  for (const track of stream.getVideoTracks()) {
    try { track.contentHint = 'motion' } catch { /* Older Chromium may reject contentHint. */ }
    void track.applyConstraints?.({ frameRate: { ideal: RECEIVER_MAX_FPS, max: RECEIVER_MAX_FPS } }).catch(() => undefined)
  }

  return {
    stream,
    stop: () => {
      stopped = true
      window.cancelAnimationFrame(frameId)
      for (const track of stream.getTracks()) track.stop()
    },
  }
}

async function configureVideoSender(sender: RTCRtpSender): Promise<void> {
  try {
    const parameters = sender.getParameters()
    if (!parameters.encodings || parameters.encodings.length === 0) parameters.encodings = [{}]
    parameters.encodings = parameters.encodings.map(encoding => ({
      ...encoding,
      maxBitrate: RECEIVER_MAX_BITRATE_BPS,
      maxFramerate: RECEIVER_MAX_FPS,
    }))
    await sender.setParameters(parameters)
  } catch {
    // SDP/WebRTC negotiation remains authoritative if sender hints are unsupported.
  }
}

async function collectTransportStats(
  peer: RTCPeerConnection,
  previous: { bytesSent: number; timestamp: number } | null,
): Promise<{ stats: OutputTransportStats; sample: { bytesSent: number; timestamp: number } | null }> {
  const reports = await peer.getStats()
  let outbound: (RTCStats & Record<string, unknown>) | null = null
  let remoteInbound: (RTCStats & Record<string, unknown>) | null = null
  reports.forEach(report => {
    const value = report as RTCStats & Record<string, unknown>
    if (value.type === 'outbound-rtp' && (value.kind === 'video' || value.mediaType === 'video') && !value.isRemote) outbound = value
    if (value.type === 'remote-inbound-rtp' && (value.kind === 'video' || value.mediaType === 'video')) remoteInbound = value
  })

  const selectedOutbound = outbound as (RTCStats & Record<string, unknown>) | null
  const selectedRemoteInbound = remoteInbound as (RTCStats & Record<string, unknown>) | null
  const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
  const bytesSent = number(selectedOutbound?.bytesSent)
  const timestamp = number(selectedOutbound?.timestamp) ?? Date.now()
  let bitrateKbps: number | null = null
  if (bytesSent !== null && previous && timestamp > previous.timestamp && bytesSent >= previous.bytesSent) {
    bitrateKbps = ((bytesSent - previous.bytesSent) * 8) / (timestamp - previous.timestamp)
  }
  const sample = bytesSent === null ? previous : { bytesSent, timestamp }
  const roundTripTime = number(selectedRemoteInbound?.roundTripTime)
  return {
    stats: {
      timestampMs: Date.now(),
      width: number(selectedOutbound?.frameWidth),
      height: number(selectedOutbound?.frameHeight),
      framesPerSecond: number(selectedOutbound?.framesPerSecond),
      bitrateKbps,
      roundTripTimeMs: roundTripTime === null ? null : roundTripTime * 1000,
      packetsLost: number(selectedRemoteInbound?.packetsLost),
    },
    sample,
  }
}

function useOutputBroadcaster(
  bridge: NativeOutputBridge | null,
  canvas: HTMLCanvasElement | null,
  session: OutputCastSession | null,
) {
  const canvasRef = useRef(canvas)
  const activeRef = useRef<{
    sessionId: string
    peer: RTCPeerConnection
    relay: RelayCapture
    statsTimer: number | null
    disconnectTimer: number | null
  } | null>(null)

  useLayoutEffect(() => {
    canvasRef.current = canvas
  }, [canvas])

  const closeActive = useCallback(() => {
    const active = activeRef.current
    if (!active) return
    if (active.statsTimer !== null) window.clearInterval(active.statsTimer)
    if (active.disconnectTimer !== null) window.clearTimeout(active.disconnectTimer)
    active.peer.close()
    active.relay.stop()
    activeRef.current = null
  }, [])

  useLayoutEffect(() => {
    if (session) return
    closeActive()
  }, [closeActive, session])

  useEffect(() => {
    if (!bridge) return
    return bridge.onReceiverRequested(({ sessionId }) => {
      void (async () => {
        closeActive()
        try {
          if (!canvasRef.current) throw new Error('The live visualizer has not published an output canvas yet')
          if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC output is unavailable in this runtime')
          const relay = createRelayCapture(canvasRef)
          const peer = new RTCPeerConnection({ iceServers: [] })
          activeRef.current = { sessionId, peer, relay, statsTimer: null, disconnectTimer: null }
          let previousStats: { bytesSent: number; timestamp: number } | null = null

          const failAfterGrace = () => {
            const active = activeRef.current
            if (!active || active.sessionId !== sessionId || active.disconnectTimer !== null) return
            active.disconnectTimer = window.setTimeout(() => {
              const current = activeRef.current
              if (!current || current.sessionId !== sessionId) return
              if (current.peer.connectionState === 'connected') {
                current.disconnectTimer = null
                return
              }
              closeActive()
              void bridge.failSession(sessionId, 'The output receiver connection was lost and did not recover').catch(() => false)
            }, RECEIVER_DISCONNECT_GRACE_MS)
          }

          peer.addEventListener('connectionstatechange', () => {
            const active = activeRef.current
            if (!active || active.sessionId !== sessionId) return
            if (peer.connectionState === 'connected') {
              if (active.disconnectTimer !== null) window.clearTimeout(active.disconnectTimer)
              active.disconnectTimer = null
              return
            }
            if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') failAfterGrace()
            if (peer.connectionState === 'closed') closeActive()
          })

          const senders = relay.stream.getTracks().map(track => peer.addTrack(track, relay.stream))
          await Promise.all(senders.filter(sender => sender.track?.kind === 'video').map(configureVideoSender))
          const offer = await peer.createOffer()
          await peer.setLocalDescription(offer)
          await waitForIceGatheringComplete(peer)
          if (!peer.localDescription) throw new Error('The output stream could not create an offer')
          await bridge.publishOffer(sessionId, peer.localDescription.toJSON())
          const answer = await bridge.waitForAnswer(sessionId)
          await peer.setRemoteDescription(answer)

          if (bridge.reportStats) {
            const active = activeRef.current
            if (active && active.sessionId === sessionId) {
              const sampleStats = async () => {
                const current = activeRef.current
                if (!current || current.sessionId !== sessionId || current.peer.connectionState !== 'connected') return
                try {
                  const result = await collectTransportStats(current.peer, previousStats)
                  previousStats = result.sample
                  await bridge.reportStats?.(sessionId, result.stats)
                } catch {
                  // Diagnostics are advisory and must never tear down a healthy session.
                }
              }
              active.statsTimer = window.setInterval(() => void sampleStats(), RECEIVER_STATS_INTERVAL_MS)
              void sampleStats()
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'The output stream could not start'
          closeActive()
          await bridge.failSession(sessionId, message).catch(() => false)
        }
      })()
    })
  }, [bridge, closeActive])

  useEffect(() => closeActive, [closeActive])
}

const GOOGLE_CAST_MAX_LONG_EDGE = 1280
const GOOGLE_CAST_MAX_SHORT_EDGE = 720
const GOOGLE_CAST_MAX_FPS = 30
const GOOGLE_CAST_VIDEO_BITRATE_BPS = 6_000_000
const GOOGLE_CAST_CHUNK_INTERVAL_MS = 250

function fitGoogleCastRelaySize(width: number, height: number): { width: number; height: number } {
  const safeWidth = Math.max(2, width || 1280)
  const safeHeight = Math.max(2, height || 720)
  const landscape = safeWidth >= safeHeight
  const maxWidth = landscape ? GOOGLE_CAST_MAX_LONG_EDGE : GOOGLE_CAST_MAX_SHORT_EDGE
  const maxHeight = landscape ? GOOGLE_CAST_MAX_SHORT_EDGE : GOOGLE_CAST_MAX_LONG_EDGE
  const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight)
  return {
    width: Math.max(2, Math.round(safeWidth * scale)),
    height: Math.max(2, Math.round(safeHeight * scale)),
  }
}

function createGoogleCastRelayCapture(sourceRef: MutableRefObject<HTMLCanvasElement | null>): RelayCapture {
  const relay = document.createElement('canvas')
  const initial = fitGoogleCastRelaySize(sourceRef.current?.width ?? 1280, sourceRef.current?.height ?? 720)
  relay.width = initial.width
  relay.height = initial.height
  const context = relay.getContext('2d', { alpha: false })
  if (!context || typeof relay.captureStream !== 'function') throw new Error('Canvas capture is unavailable for Google Cast in this runtime')

  let stopped = false
  let frameId = 0
  const render = () => {
    if (stopped) return
    const source = sourceRef.current
    if (source && source.width > 0 && source.height > 0) {
      const next = fitGoogleCastRelaySize(source.width, source.height)
      if (relay.width !== next.width || relay.height !== next.height) {
        relay.width = next.width
        relay.height = next.height
      }
      context.drawImage(source, 0, 0, relay.width, relay.height)
    } else {
      context.fillStyle = '#000'
      context.fillRect(0, 0, relay.width, relay.height)
    }
    frameId = window.requestAnimationFrame(render)
  }
  render()
  const stream = relay.captureStream(GOOGLE_CAST_MAX_FPS)
  for (const track of stream.getVideoTracks()) {
    try { track.contentHint = 'motion' } catch { /* Chromium versions differ here. */ }
    void track.applyConstraints?.({ frameRate: { ideal: GOOGLE_CAST_MAX_FPS, max: GOOGLE_CAST_MAX_FPS } }).catch(() => undefined)
  }
  return {
    stream,
    stop: () => {
      stopped = true
      window.cancelAnimationFrame(frameId)
      for (const track of stream.getTracks()) track.stop()
    },
  }
}

function chooseGoogleCastMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']
  if (typeof MediaRecorder.isTypeSupported !== 'function') return candidates[0]
  return candidates.find(candidate => MediaRecorder.isTypeSupported(candidate)) ?? null
}

function useGoogleCastBroadcaster(
  bridge: NativeOutputBridge | null,
  canvas: HTMLCanvasElement | null,
  session: OutputCastSession | null,
) {
  const canvasRef = useRef(canvas)
  const activeRef = useRef<{
    sessionId: string
    relay: RelayCapture
    recorder: MediaRecorder
    statsTimer: number | null
    publishedBytes: number
    lastStatsBytes: number
    lastStatsAt: number
    publishChain: Promise<void>
  } | null>(null)

  useLayoutEffect(() => {
    canvasRef.current = canvas
  }, [canvas])

  const closeActive = useCallback(() => {
    const active = activeRef.current
    if (!active) return
    activeRef.current = null
    if (active.statsTimer !== null) window.clearInterval(active.statsTimer)
    if (active.recorder.state !== 'inactive') {
      try { active.recorder.stop() } catch { /* Recorder may already be tearing down. */ }
    }
    active.relay.stop()
    void bridge?.endGoogleCastStream?.(active.sessionId).catch(() => false)
  }, [bridge])

  const activeSessionId = session?.providerId === 'google-cast'
    && session.transport === 'google-cast-webm'
    && (session.state === 'connecting' || session.state === 'connected')
    ? session.id
    : null

  useEffect(() => {
    if (!bridge || !activeSessionId) {
      closeActive()
      return
    }
    if (activeRef.current?.sessionId === activeSessionId) return
    if (activeRef.current) closeActive()

    const sessionId = activeSessionId
    let cancelled = false
    let failing = false
    void (async () => {
      let pendingRelay: RelayCapture | null = null
      try {
        if (!canvasRef.current) throw new Error('The live visualizer has not published an output canvas yet')
        if (!bridge.beginGoogleCastStream || !bridge.publishGoogleCastChunk || !bridge.endGoogleCastStream) {
          throw new Error('This DRMVYZ build does not expose the Google Cast live media bridge')
        }
        const mimeType = chooseGoogleCastMimeType()
        if (!mimeType) throw new Error('This Chromium runtime cannot encode a Google Cast compatible WebM stream')
        const relay = createGoogleCastRelayCapture(canvasRef)
        pendingRelay = relay
        const recorder = new MediaRecorder(relay.stream, {
          mimeType,
          videoBitsPerSecond: GOOGLE_CAST_VIDEO_BITRATE_BPS,
        })
        const active = {
          sessionId,
          relay,
          recorder,
          statsTimer: null as number | null,
          publishedBytes: 0,
          lastStatsBytes: 0,
          lastStatsAt: Date.now(),
          publishChain: Promise.resolve(),
        }
        activeRef.current = active
        pendingRelay = null

        const fail = async (message: string) => {
          if (failing || cancelled) return
          failing = true
          closeActive()
          await bridge.failSession(sessionId, message).catch(() => false)
        }

        recorder.addEventListener('dataavailable', event => {
          if (!event.data || event.data.size === 0) return
          active.publishChain = active.publishChain.then(async () => {
            if (cancelled || activeRef.current !== active) return
            const bytes = new Uint8Array(await event.data.arrayBuffer())
            const accepted = await bridge.publishGoogleCastChunk?.(sessionId, bytes)
            if (accepted === false) throw new Error('Google Cast live media transport stopped accepting encoded frames')
            active.publishedBytes += bytes.byteLength
          }).catch(error => {
            void fail(error instanceof Error ? error.message : 'Google Cast live media transport failed')
          })
        })
        recorder.addEventListener('error', event => {
          const recorderError = (event as Event & { error?: DOMException }).error
          void fail(recorderError?.message || 'The Google Cast live encoder failed')
        })

        await bridge.beginGoogleCastStream(sessionId, {
          mimeType: recorder.mimeType || mimeType,
          width: (relay.stream.getVideoTracks()[0]?.getSettings().width ?? canvasRef.current?.width ?? 1280),
          height: (relay.stream.getVideoTracks()[0]?.getSettings().height ?? canvasRef.current?.height ?? 720),
          framesPerSecond: GOOGLE_CAST_MAX_FPS,
        })
        if (cancelled || activeRef.current !== active) {
          closeActive()
          return
        }
        recorder.start(GOOGLE_CAST_CHUNK_INTERVAL_MS)

        if (bridge.reportStats) {
          active.statsTimer = window.setInterval(() => {
            if (activeRef.current !== active) return
            const now = Date.now()
            const elapsedMs = Math.max(1, now - active.lastStatsAt)
            const bytes = Math.max(0, active.publishedBytes - active.lastStatsBytes)
            const settings = relay.stream.getVideoTracks()[0]?.getSettings()
            active.lastStatsAt = now
            active.lastStatsBytes = active.publishedBytes
            void bridge.reportStats?.(sessionId, {
              timestampMs: now,
              width: settings?.width ?? null,
              height: settings?.height ?? null,
              framesPerSecond: settings?.frameRate ?? GOOGLE_CAST_MAX_FPS,
              bitrateKbps: (bytes * 8) / elapsedMs,
              roundTripTimeMs: null,
              packetsLost: null,
            }).catch(() => false)
          }, RECEIVER_STATS_INTERVAL_MS)
        }
      } catch (error) {
        pendingRelay?.stop()
        const message = error instanceof Error ? error.message : 'Google Cast live output could not start'
        closeActive()
        await bridge.failSession(sessionId, message).catch(() => false)
      }
    })()

    return () => {
      cancelled = true
      if (activeRef.current?.sessionId === sessionId) closeActive()
    }
  }, [activeSessionId, bridge, closeActive])

  useEffect(() => closeActive, [closeActive])
}

function groupTargets(targets: OutputTarget[]) {
  return {
    displays: targets.filter(target => target.kind === 'display'),
    network: targets.filter(target => target.kind === 'network' && target.providerId !== 'google-cast'),
  }
}

type CastPopoverPlacement = 'top' | 'bottom'

interface CastPopoverPosition {
  top: number
  left: number
  arrowLeft: number
  placement: CastPopoverPlacement
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

interface OutputCastPopoverProps {
  anchor: HTMLElement | null
  bridge: NativeOutputBridge | null
  canvasReady: boolean
  targets: OutputTarget[]
  session: OutputCastSession | null
  loading: boolean
  error: string | null
  providerStatuses: OutputProviderStatus[]
  onClose: () => void
  onRefresh: () => void
  onProviderAction: (providerId: OutputProviderId, actionId: string, payload?: unknown) => Promise<void>
  onCast: (target: OutputTarget, windowMode: OutputWindowMode, aspectRatio: OutputAspectRatio) => void
  onStop: () => void
}

function OutputCastPopover({
  anchor,
  bridge,
  canvasReady,
  targets,
  session,
  loading,
  error,
  providerStatuses,
  onClose,
  onRefresh,
  onProviderAction,
  onCast,
  onStop,
}: OutputCastPopoverProps) {
  const [windowMode, setWindowMode] = useState<OutputWindowMode | null>(null)
  const [aspectRatio, setAspectRatio] = useState<OutputAspectRatio | null>(null)
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null)
  const [pendingProviderAction, setPendingProviderAction] = useState<string | null>(null)
  const [position, setPosition] = useState<CastPopoverPosition | null>(null)
  const popoverRef = useRef<HTMLElement | null>(null)
  const titleId = 'rv-output-cast-title'
  const groups = useMemo(() => groupTargets(targets), [targets])
  const airplayProvider = useMemo(() => providerStatuses.find(status => status.providerId === 'airplay') ?? null, [providerStatuses])
  const miracastProvider = useMemo(() => providerStatuses.find(status => status.providerId === 'miracast') ?? null, [providerStatuses])
  const googleCastProvider = useMemo(() => providerStatuses.find(status => status.providerId === 'google-cast') ?? null, [providerStatuses])
  const providerIssues = useMemo(() => providerStatuses.filter(status => {
    if ((status.providerId === 'airplay' || status.providerId === 'miracast') && status.state === 'unsupported') return false
    return status.state !== 'available' || Boolean(status.message)
  }), [providerStatuses])
  const airplayAction = airplayProvider?.capabilities?.actions.includes('open-system-picker') ? 'open-system-picker' : null
  const airplayActionAvailable = airplayProvider?.state === 'available' || airplayProvider?.state === 'initialization-failed'
  const miracastAction = miracastProvider?.capabilities?.actions.includes('open-system-picker') ? 'open-system-picker' : null
  const miracastActionAvailable = miracastProvider?.state === 'available' || miracastProvider?.state === 'initialization-failed'
  const googleCastAction = googleCastProvider?.capabilities?.actions.includes('open-picker') ? 'open-picker' : null
  const googleCastActionAvailable = googleCastProvider?.state === 'available' || googleCastProvider?.state === 'initialization-failed'
  const readyToCast = Boolean(windowMode && aspectRatio && canvasReady && bridge)
  const showWirelessDisplays = Boolean(
    (airplayProvider && airplayProvider.state !== 'unsupported')
      || (miracastProvider && miracastProvider.state !== 'unsupported')
      || googleCastProvider,
  )

  useEffect(() => {
    if (!session || session.state === 'connected' || session.state === 'failed' || error) setPendingTargetId(null)
  }, [error, session])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (popoverRef.current?.contains(target) || anchor?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown, true)
    }
  }, [anchor, onClose])

  const updatePosition = useCallback(() => {
    const popover = popoverRef.current
    if (!anchor || !popover) return

    const viewportMargin = 12
    const anchorGap = 11
    const anchorRect = anchor.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    const availableAbove = anchorRect.top - viewportMargin - anchorGap
    const availableBelow = window.innerHeight - anchorRect.bottom - viewportMargin - anchorGap
    const placement: CastPopoverPlacement =
      popoverRect.height <= availableAbove || availableAbove >= availableBelow ? 'top' : 'bottom'
    const preferredTop = placement === 'top'
      ? anchorRect.top - popoverRect.height - anchorGap
      : anchorRect.bottom + anchorGap
    const preferredLeft = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2
    const top = clamp(preferredTop, viewportMargin, window.innerHeight - popoverRect.height - viewportMargin)
    const left = clamp(preferredLeft, viewportMargin, window.innerWidth - popoverRect.width - viewportMargin)
    const arrowLeft = clamp(anchorRect.left + anchorRect.width / 2 - left, 18, popoverRect.width - 18)

    setPosition({ top, left, arrowLeft, placement })
  }, [anchor])

  useLayoutEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePosition)
    if (popoverRef.current) observer?.observe(popoverRef.current)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      observer?.disconnect()
    }
  }, [updatePosition])

  const start = (target: OutputTarget) => {
    if (!windowMode || !aspectRatio || !readyToCast) return
    setPendingTargetId(target.id)
    onCast(target, windowMode, aspectRatio)
  }

  const performProviderAction = async (providerId: OutputProviderId, actionId: string, payload?: unknown) => {
    const key = `${providerId}:${actionId}`
    if (pendingProviderAction) return
    setPendingProviderAction(key)
    try {
      await onProviderAction(providerId, actionId, payload)
    } finally {
      setPendingProviderAction(null)
    }
  }

  const renderTargets = (items: OutputTarget[], emptyCopy: string) => {
    if (loading) return <div className="rv-cast-empty">Searching for output devices…</div>
    if (items.length === 0) return <div className="rv-cast-empty">{emptyCopy}</div>
    return (
      <div className="rv-cast-device-list">
        {items.map(target => {
          const active = session?.targetId === target.id
          const pending = pendingTargetId === target.id && session?.state !== 'connected'
          return (
            <button
              key={target.id}
              type="button"
              className={`rv-cast-device${active ? ' is-active' : ''}`}
              disabled={!readyToCast || !target.available || Boolean(pendingTargetId && !active)}
              onClick={() => start(target)}
            >
              <span className="rv-cast-device-icon"><DisplayIcon network={target.kind === 'network'} /></span>
              <span className="rv-cast-device-copy">
                <strong>{target.name}</strong>
                <span>{target.detail}</span>
              </span>
              <span className="rv-cast-device-state">
                {active && session?.state === 'connected'
                  ? 'Live'
                  : pending
                    ? 'Connecting…'
                    : target.kind === 'network' && target.receiverPaired === false
                      ? 'Pair & Cast'
                      : 'Cast'}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const popoverStyle = {
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    visibility: position ? 'visible' : 'hidden',
    '--rv-cast-arrow-left': `${position?.arrowLeft ?? 24}px`,
  } as CSSProperties
  const placement = position?.placement ?? 'top'

  return createPortal(
    <section
      ref={popoverRef}
      className={`rv-cast-popover rv-cast-popover--${placement}`}
      style={popoverStyle}
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className="rv-cast-popover-surface">
        <div className="rv-cast-popover-grid">
          <div className="rv-cast-config-panel">
            <header className="rv-cast-compact-title">
              <span className="rv-cast-compact-title-icon"><CastIcon /></span>
              <h2 id={titleId}>Cast Output</h2>
            </header>

            <fieldset className="rv-cast-fieldset">
              <legend>Window</legend>
              <div className="rv-cast-option-grid rv-cast-option-grid--window">
                {WINDOW_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={windowMode === option.id ? 'is-selected' : ''}
                    aria-label={`${option.label}: ${option.description}`}
                    aria-pressed={windowMode === option.id}
                    title={option.description}
                    onClick={() => setWindowMode(option.id)}
                  >
                    <span className="rv-cast-option-icon"><WindowModeIcon mode={option.id} /></span>
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="rv-cast-fieldset rv-cast-fieldset--aspect">
              <legend>Aspect Ratio</legend>
              <div className="rv-cast-option-grid rv-cast-option-grid--aspect">
                {ASPECT_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    className={aspectRatio === option ? 'is-selected' : ''}
                    aria-pressed={aspectRatio === option}
                    onClick={() => setAspectRatio(option)}
                  >
                    <span className="rv-cast-aspect-icon"><AspectRatioIcon ratio={option} /></span>
                    <strong>{option}</strong>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="rv-cast-devices-panel">
            <div className="rv-cast-device-heading">
              <div>
                <span className="rv-cast-device-heading-title">
                  <AvailableDevicesIcon />
                  <span>Available Devices</span>
                </span>
                <small>Select both options, then choose a device.</small>
              </div>
              <button type="button" className="rv-cast-icon-btn" onClick={onRefresh} aria-label="Refresh output devices">
                <RefreshIcon />
              </button>
            </div>

            {session && (
              <div className={`rv-cast-session rv-cast-session--${session.state}`}>
                <div>
                  <span>{session.state === 'connected' ? 'Now casting' : session.state === 'failed' ? 'Output failed' : session.state === 'disconnecting' ? 'Stopping output' : 'Connecting output'}</span>
                  <strong>{session.targetName}</strong>
                  <small>{session.windowMode} · {session.aspectRatio}</small>
                  {session.error && <small role="alert">{session.error}</small>}
                  {session.stats && (
                    <small>
                      {[session.stats.width && session.stats.height ? `${Math.round(session.stats.width)}×${Math.round(session.stats.height)}` : null,
                        session.stats.framesPerSecond !== null ? `${Math.round(session.stats.framesPerSecond)} fps` : null,
                        session.stats.bitrateKbps !== null ? `${(session.stats.bitrateKbps / 1000).toFixed(1)} Mbps` : null,
                        session.stats.roundTripTimeMs !== null ? `${Math.round(session.stats.roundTripTimeMs)} ms` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  )}
                </div>
                <button type="button" className="rv-cast-stop" onClick={onStop}>Stop Output</button>
              </div>
            )}

            {!bridge && (
              <NoticeCard tone="info" role="status" title="Desktop app required">Casting is available in the DRMVYZ desktop app. Browser builds keep the visualizer local.</NoticeCard>
            )}
            {bridge && !canvasReady && (
              <NoticeCard tone="info" role="status" title="Output canvas preparing">The active engine is still preparing its live output canvas.</NoticeCard>
            )}
            {error && <NoticeCard tone="error" role="alert" title="Casting error">{error}</NoticeCard>}
            {providerIssues.map(status => (
              <NoticeCard key={status.providerId} tone="warning" role="status" title={status.label}>
                {status.message ?? 'This output provider is currently unavailable.'}
              </NoticeCard>
            ))}

            {showWirelessDisplays && (
              <section className="rv-cast-device-group" aria-label="Wireless displays">
                <h3>Wireless Displays</h3>
                {airplayProvider && airplayProvider.state !== 'unsupported' && (
                  <>
                    <button
                      type="button"
                      className="rv-cast-provider-action"
                      disabled={!bridge?.performProviderAction || !airplayAction || !airplayActionAvailable || Boolean(pendingProviderAction)}
                      onClick={() => airplayAction && void performProviderAction('airplay', airplayAction)}
                    >
                      <span className="rv-cast-device-icon"><DisplayIcon network /></span>
                      <span className="rv-cast-device-copy">
                        <strong>Open macOS Displays</strong>
                        <span>Open macOS Displays to mirror or extend to an AirPlay display.</span>
                      </span>
                      <span className="rv-cast-device-state">
                        {pendingProviderAction === 'airplay:open-system-picker' ? 'Opening…' : 'Open'}
                      </span>
                    </button>
                    <p>macOS owns AirPlay screen-mirroring selection. Once macOS connects a wireless display, DRMVYZ exposes it once under Local Displays and uses the canonical output-window path.</p>
                  </>
                )}

                {miracastProvider && miracastProvider.state !== 'unsupported' && (
                  <>
                    <button
                      type="button"
                      className="rv-cast-provider-action"
                      disabled={!bridge?.performProviderAction || !miracastAction || !miracastActionAvailable || Boolean(pendingProviderAction)}
                      onClick={() => miracastAction && void performProviderAction('miracast', miracastAction)}
                    >
                      <span className="rv-cast-device-icon"><DisplayIcon network /></span>
                      <span className="rv-cast-device-copy">
                        <strong>Open Windows Displays</strong>
                        <span>Open Windows Displays and use Connect under Multiple displays.</span>
                      </span>
                      <span className="rv-cast-device-state">
                        {pendingProviderAction === 'miracast:open-system-picker' ? 'Opening…' : 'Open'}
                      </span>
                    </button>
                    <p>Windows owns Miracast negotiation. After Windows connects or extends the wireless display, DRMVYZ exposes that OS display once under Local Displays.</p>
                  </>
                )}

                {googleCastProvider && (
                  <>
                    <button
                      type="button"
                      className="rv-cast-provider-action"
                      disabled={!bridge?.performProviderAction || !googleCastAction || !googleCastActionAvailable || !readyToCast || Boolean(pendingProviderAction) || Boolean(session)}
                      onClick={() => googleCastAction && void performProviderAction('google-cast', googleCastAction, { windowMode, aspectRatio })}
                    >
                      <span className="rv-cast-device-icon"><DisplayIcon network /></span>
                      <span className="rv-cast-device-copy">
                        <strong>Choose Google Cast Device</strong>
                        <span>{googleCastProvider.state === 'configuration-required'
                          ? 'Configure the Cast receiver app ID and HTTPS sender companion first.'
                          : 'Choose a Cast device in the supported browser Web Sender companion.'}</span>
                      </span>
                      <span className="rv-cast-device-state">
                        {pendingProviderAction === 'google-cast:open-picker' ? 'Opening…' : googleCastProvider.state === 'available' || googleCastProvider.state === 'initialization-failed' ? 'Choose' : 'Setup'}
                      </span>
                    </button>
                    <p>Google Cast stays distinct from OS wireless-display mirroring: the official Web Sender companion owns the Cast session while DRMVYZ serves the tokenized canonical live output stream.</p>
                  </>
                )}
              </section>
            )}

            <section className="rv-cast-device-group" aria-label="Local displays">
              <h3>Local Displays</h3>
              {renderTargets(groups.displays, 'No local displays are currently available.')}
            </section>

            <section className="rv-cast-device-group" aria-label="DRMVYZ receivers">
              <h3>DRMVYZ Receivers</h3>
              {renderTargets(groups.network, 'No DRMVYZ receivers were found on this network.')}
              <p>Open DRMVYZ on another computer to make it discoverable. Each Receiver V2 display is selectable independently; first use asks the receiving computer to approve pairing.</p>
            </section>
          </div>
        </div>
      </div>
    </section>,
    document.body,
  )
}

export interface OutputCastControlProps {
  canvas: HTMLCanvasElement | null
  capability?: CanvasOutputCapability
}

export function OutputCastControl({
  canvas,
  capability = CANVAS_OUTPUT_AVAILABLE,
}: OutputCastControlProps) {
  const bridge = useMemo(() => getNativeOutputBridge(), [])
  const outputAvailable = isCanvasOutputAvailable(capability)
  const safeCanvas = outputAvailable ? canvas : null
  const outputAvailableRef = useRef(outputAvailable)
  const refreshGenerationRef = useRef(0)
  const unmountStopTimerRef = useRef<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<OutputTarget[]>([])
  const [session, setSession] = useState<OutputCastSession | null>(null)
  const [providerStatuses, setProviderStatuses] = useState<OutputProviderStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useOutputBroadcaster(outputAvailable ? bridge : null, safeCanvas, outputAvailable ? session : null)
  useGoogleCastBroadcaster(outputAvailable ? bridge : null, safeCanvas, outputAvailable ? session : null)

  useLayoutEffect(() => {
    outputAvailableRef.current = outputAvailable
    if (outputAvailable) return
    refreshGenerationRef.current += 1
    setOpen(false)
    setTargets([])
    setProviderStatuses([])
    setLoading(false)
    setError(null)
    setSession(null)
    if (bridge) void bridge.stopCast().catch(() => null)
  }, [bridge, outputAvailable])

  const refresh = useCallback(async () => {
    if (!bridge || !outputAvailable) return
    const generation = ++refreshGenerationRef.current
    setLoading(true)
    setError(null)
    try {
      const snapshot = bridge.getTargetSnapshot
        ? await bridge.getTargetSnapshot()
        : { targets: await bridge.listTargets(), providers: [] }
      const nextSession = await bridge.getSession()
      if (!outputAvailableRef.current || generation !== refreshGenerationRef.current) return
      setTargets(snapshot.targets)
      setProviderStatuses(snapshot.providers)
      setSession(nextSession)
    } catch (value) {
      if (outputAvailableRef.current && generation === refreshGenerationRef.current) {
        setError(value instanceof Error ? value.message : 'Could not discover output devices')
      }
    } finally {
      if (outputAvailableRef.current && generation === refreshGenerationRef.current) setLoading(false)
    }
  }, [bridge, outputAvailable])

  useEffect(() => {
    if (!bridge || !outputAvailable) return
    const unsubscribeTargets = bridge.onTargetsChanged((nextTargets) => {
      if (outputAvailableRef.current) setTargets(nextTargets)
    })
    const unsubscribeSnapshot = bridge.onTargetSnapshotChanged?.((snapshot) => {
      if (!outputAvailableRef.current) return
      setTargets(snapshot.targets)
      setProviderStatuses(snapshot.providers)
    })
    const unsubscribeSession = bridge.onSessionChanged((nextSession) => {
      if (outputAvailableRef.current) setSession(nextSession)
    })
    void refresh()
    return () => {
      unsubscribeTargets()
      unsubscribeSnapshot?.()
      unsubscribeSession()
    }
  }, [bridge, outputAvailable, refresh])

  useEffect(() => {
    if (open && outputAvailable) void refresh()
  }, [open, outputAvailable, refresh])

  useEffect(() => {
    if (!bridge || !outputAvailable) return
    if (unmountStopTimerRef.current !== null) {
      window.clearTimeout(unmountStopTimerRef.current)
      unmountStopTimerRef.current = null
    }
    return () => {
      refreshGenerationRef.current += 1
      unmountStopTimerRef.current = window.setTimeout(() => {
        unmountStopTimerRef.current = null
        void bridge.stopCast().catch(() => null)
      }, 0)
    }
  }, [bridge, outputAvailable])

  const performProviderAction = useCallback(async (providerId: OutputProviderId, actionId: string, payload?: unknown) => {
    if (!bridge?.performProviderAction || !outputAvailable) return
    setError(null)
    try {
      const result = await bridge.performProviderAction(providerId, actionId, payload)
      if (result.session && outputAvailableRef.current) setSession(result.session)
      await refresh()
    } catch (value) {
      if (outputAvailableRef.current) {
        setError(value instanceof Error ? value.message : 'Could not open the output provider action')
      }
    }
  }, [bridge, outputAvailable, refresh])

  const startCast = useCallback(async (
    target: OutputTarget,
    windowMode: OutputWindowMode,
    aspectRatio: OutputAspectRatio,
  ) => {
    if (!bridge || !outputAvailable || !safeCanvas) return
    setError(null)
    try {
      const nextSession = await bridge.startCast({ targetId: target.id, windowMode, aspectRatio })
      if (!outputAvailableRef.current) {
        await bridge.stopCast().catch(() => null)
        return
      }
      setSession(nextSession)
    } catch (value) {
      if (outputAvailableRef.current) {
        setError(value instanceof Error ? value.message : 'Could not start output')
      }
    }
  }, [bridge, outputAvailable, safeCanvas])

  const stopCast = useCallback(async () => {
    if (!bridge) return
    setError(null)
    try {
      await bridge.stopCast()
      setSession(null)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not stop output')
    }
  }, [bridge])

  if (!outputAvailable) {
    const fracturesDeferred = isCanvasFracturesOutputDeferred(capability)
    return (
      <button
        type="button"
        className={fracturesDeferred ? 'rv-canvas-cast-deferred' : 'rv-cast-trigger'}
        disabled
        aria-label={fracturesDeferred ? 'Fractures cast unavailable' : 'Cast output unavailable'}
        title={fracturesDeferred
          ? 'Fractures cast and production output are intentionally unavailable in the current MVP.'
          : 'The active Canvas renderer has not published a supported output.'}
      >
        {fracturesDeferred ? 'Cast unavailable for Fractures' : <CastIcon />}
      </button>
    )
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`rv-cast-trigger${session?.state === 'connected' ? ' is-active' : ''}`}
        aria-label={session?.state === 'connected' ? `Output casting to ${session.targetName}` : 'Cast visual output'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={session?.state === 'connected' ? `Casting to ${session.targetName}` : 'Cast visual output'}
        onClick={() => setOpen(value => !value)}
      >
        <CastIcon />
        {session?.state === 'connected' && <span className="rv-cast-live-dot" aria-hidden="true" />}
      </button>
      {open && (
        <OutputCastPopover
          anchor={triggerRef.current}
          bridge={bridge}
          canvasReady={safeCanvas !== null}
          targets={targets}
          session={session}
          loading={loading}
          error={error}
          providerStatuses={providerStatuses}
          onClose={() => setOpen(false)}
          onRefresh={() => void refresh()}
          onProviderAction={performProviderAction}
          onCast={(target, windowMode, aspectRatio) => void startCast(target, windowMode, aspectRatio)}
          onStop={() => void stopCast()}
        />
      )}
    </>
  )
}
