import { useWebCast, CAST_ORIGIN, type WebCastController } from './useWebCast'
import { webCastQrPath } from './webCastQr'
import './WebCast.css'
import { CastPreviewWindow } from './CastPreviewWindow'
import { BRAND_RECEIVERS } from '../../../../brand'
import { isCanvasFrameReady } from '../../../../lib/canvasFrameReadiness'
import { FrameCadence } from '../../../../lib/frameCadence'
import { startRelayFramePump } from './relayFramePump'
import { castSendQueueState } from './castBackpressure'
import { notify } from '../../../../stores/notificationStore'
import { copyPerformanceFrame, performanceOutputSize } from './performanceOutputGeometry'
import { recordPerformanceEvent, setPerformanceCastActive } from '../../../../lib/performanceTelemetry'
import { CastLoadShedder, bindCadenceToPressure } from '../../../../lib/castLoadShedding'
import { CastReconnector } from '../../../../lib/castSelfHealing'
import { useReactBackgrounded } from '../reactBackground'
import { setPerformancePressure } from '../../../../lib/performancePressure'
import { AppIcon } from '../../../shared/icons/AppIcon'
import {
  useCallback,
  useId,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react'
import { createPortal, flushSync } from 'react-dom'
import { DrawerNotice } from '../../shared/DrawerNotice'
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
  type OutputCastRequest,
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

const CAST_CATEGORIES = [
  { id: 'web', label: 'Browser' },
  { id: 'wireless', label: 'Wireless' },
  { id: 'local', label: 'Local' },
  { id: 'receiver', label: 'Receivers' },
] as const
type CastCategory = typeof CAST_CATEGORIES[number]['id']

function CastIcon() { return <AppIcon kind="cast" /> }

function WindowModeIcon({ mode }: { mode: OutputWindowMode }) {
  return <AppIcon kind={mode === 'windowed' ? 'window' : mode === 'borderless' ? 'borderless' : 'expand'} />
}

const ASPECT_ICON_KINDS = {
  '16:9': 'ratio16x9', '16:10': 'ratio16x10', '4:3': 'ratio4x3',
  '3:2': 'ratio3x2', '1:1': 'ratio1x1', '9:16': 'ratio9x16',
} as const

function AspectRatioIcon({ ratio }: { ratio: OutputAspectRatio }) {
  return <AppIcon kind={ASPECT_ICON_KINDS[ratio]} />
}

function AvailableDevicesIcon() { return <AppIcon kind="people" /> }

function RefreshIcon() { return <AppIcon kind="sync" /> }

function CloseIcon() { return <AppIcon kind="close" /> }

// Activity/pulse line — labels the Current Devices status record, distinct
// from Available Devices' circle-and-people glyph.
function CurrentDevicesIcon() { return <AppIcon kind="waveform" /> }

// Approved provider artwork, sharing the production icon family.
function AppleLogoIcon() { return <AppIcon kind="apple" /> }

function WindowsLogoIcon() { return <AppIcon kind="windows" /> }

// The provider label and actions remain unchanged.
function GoogleLogoIcon() { return <AppIcon kind="google" /> }

// Wider gap around each "·" separator in session detail lines than a plain
// space allows — browsers collapse consecutive regular spaces, so this
// joins with non-breaking spaces to actually render the extra padding.
function joinWithDot(parts: readonly string[]): string {
  return parts.join('  ·  ')
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
  canvas: HTMLCanvasElement
  stream: MediaStream
  stop: () => void
}

const RECEIVER_MAX_FPS = 60
const RECEIVER_MAX_BITRATE_BPS = 12_000_000
const RECEIVER_STATS_INTERVAL_MS = 2_000
const RECEIVER_DISCONNECT_GRACE_MS = 3_000

function createRelayCapture(sourceRef: MutableRefObject<HTMLCanvasElement | null>, aspectRatio: OutputAspectRatio): RelayCapture {
  const relay = document.createElement('canvas')
  const size = performanceOutputSize(aspectRatio)
  relay.width = size.width
  relay.height = size.height
  const context = relay.getContext('2d', { alpha: false })
  if (!context || typeof relay.captureStream !== 'function') {
    throw new Error('Canvas streaming is unavailable in this runtime')
  }

  const cadence = new FrameCadence(RECEIVER_MAX_FPS)
  // At severe overload (a cast that cannot keep up, a GPU that just restarted) the relay copies and encodes half as many frames until it passes.
  const unbindPressure = bindCadenceToPressure(cadence, RECEIVER_MAX_FPS)
  const copyFrame = (source: HTMLCanvasElement | null) => {
    if (source && isCanvasFrameReady(source)) copyPerformanceFrame(context, source, size)
  }
  const stopPump = startRelayFramePump({ sourceRef, cadence, copy: copyFrame, onError: error => console.warn('[cast] relay frame copy failed', error) })
  const stream = relay.captureStream(RECEIVER_MAX_FPS)
  for (const track of stream.getVideoTracks()) {
    try { track.contentHint = 'motion' } catch { /* Older Chromium may reject contentHint. */ }
    void track.applyConstraints?.({ frameRate: { ideal: RECEIVER_MAX_FPS, max: RECEIVER_MAX_FPS } }).catch(() => undefined)
  }

  return {
    canvas: relay,
    stream,
    stop: () => {
      stopPump()
      unbindPressure()
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
  previewSourceRef: MutableRefObject<HTMLCanvasElement | null>,
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
    if (previewSourceRef.current === active.relay.canvas) previewSourceRef.current = null
    activeRef.current = null
  }, [previewSourceRef])

  useLayoutEffect(() => {
    if (session) return
    closeActive()
  }, [closeActive, session])

  useEffect(() => {
    if (!bridge) return
    return bridge.onReceiverRequested(({ sessionId, aspectRatio }) => {
      void (async () => {
        closeActive()
        try {
          if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC output is unavailable in this runtime')
          const relay = createRelayCapture(canvasRef, aspectRatio)
          const peer = new RTCPeerConnection({ iceServers: [] })
          activeRef.current = { sessionId, peer, relay, statsTimer: null, disconnectTimer: null }
          previewSourceRef.current = relay.canvas
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
          if (activeRef.current?.sessionId === sessionId) closeActive()
          await bridge.failSession(sessionId, message).catch(() => false)
        }
      })()
    })
  }, [bridge, closeActive, previewSourceRef])

  useEffect(() => closeActive, [closeActive])
}

const GOOGLE_CAST_MAX_FPS = 30
const GOOGLE_CAST_VIDEO_BITRATE_BPS = 6_000_000
const GOOGLE_CAST_CHUNK_INTERVAL_MS = 250

function createGoogleCastRelayCapture(sourceRef: MutableRefObject<HTMLCanvasElement | null>, aspectRatio: OutputAspectRatio): RelayCapture {
  const relay = document.createElement('canvas')
  const size = performanceOutputSize(aspectRatio, 'google-cast-webm')
  relay.width = size.width
  relay.height = size.height
  const context = relay.getContext('2d', { alpha: false })
  if (!context || typeof relay.captureStream !== 'function') throw new Error('Canvas capture is unavailable for Google Cast in this runtime')

  const cadence = new FrameCadence(GOOGLE_CAST_MAX_FPS)
  const copyFrame = (source: HTMLCanvasElement | null) => {
    if (source && isCanvasFrameReady(source)) copyPerformanceFrame(context, source, size)
  }
  const stopPump = startRelayFramePump({ sourceRef, cadence, copy: copyFrame, onError: error => console.warn('[cast] Google Cast relay frame copy failed', error) })
  const stream = relay.captureStream(GOOGLE_CAST_MAX_FPS)
  for (const track of stream.getVideoTracks()) {
    try { track.contentHint = 'motion' } catch { /* Chromium versions differ here. */ }
    void track.applyConstraints?.({ frameRate: { ideal: GOOGLE_CAST_MAX_FPS, max: GOOGLE_CAST_MAX_FPS } }).catch(() => undefined)
  }
  return {
    canvas: relay,
    stream,
    stop: () => {
      stopPump()
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
  previewSourceRef: MutableRefObject<HTMLCanvasElement | null>,
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
    /** Encoded chunks waiting to be sent, bounded by castBackpressure.ts. */
    pendingChunks: number
    pendingBytes: number
    warnedBehind: boolean
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
    if (previewSourceRef.current === active.relay.canvas) previewSourceRef.current = null
    void bridge?.endGoogleCastStream?.(active.sessionId).catch(() => false)
  }, [bridge, previewSourceRef])

  const activeSessionId = session?.providerId === 'google-cast'
    && session.transport === 'google-cast-webm'
    && (session.state === 'connecting' || session.state === 'connected')
    ? session.id
    : null

  const activeAspectRatio = activeSessionId ? session?.aspectRatio : null
  useEffect(() => {
    if (!bridge || !activeSessionId || !activeAspectRatio) {
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
        if (!bridge.beginGoogleCastStream || !bridge.publishGoogleCastChunk || !bridge.endGoogleCastStream) {
          throw new Error('This STAGELESS build does not expose the Google Cast live media bridge')
        }
        const mimeType = chooseGoogleCastMimeType()
        if (!mimeType) throw new Error('This Chromium runtime cannot encode a Google Cast compatible WebM stream')
        const relay = createGoogleCastRelayCapture(canvasRef, activeAspectRatio)
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
          pendingChunks: 0,
          pendingBytes: 0,
          warnedBehind: false,
        }
        activeRef.current = active
        previewSourceRef.current = relay.canvas
        pendingRelay = null

        const fail = async (message: string) => {
          if (failing || cancelled) return
          failing = true
          closeActive()
          await bridge.failSession(sessionId, message).catch(() => false)
        }

        recorder.addEventListener('dataavailable', event => {
          if (!event.data || event.data.size === 0) return
          const size = event.data.size
          active.pendingChunks += 1
          active.pendingBytes += size
          const queue = castSendQueueState(active.pendingChunks, active.pendingBytes)
          if (queue === 'overflow') {
            void fail('Casting stopped because the network could not keep up with the video. Check the connection to the Cast device, then cast again.')
            return
          }
          if (queue === 'behind' && !active.warnedBehind) {
            active.warnedBehind = true
            notify('react', { tone: 'warning', title: 'Casting is falling behind', message: 'The network to the Cast device is slower than the video. The picture on the TV may lag; casting stops if it falls too far behind.' })
          }
          active.publishChain = active.publishChain.then(async () => {
            if (cancelled || activeRef.current !== active) return
            const bytes = new Uint8Array(await event.data.arrayBuffer())
            const accepted = await bridge.publishGoogleCastChunk?.(sessionId, bytes)
            if (accepted === false) throw new Error('Google Cast live media transport stopped accepting encoded frames')
            active.publishedBytes += bytes.byteLength
          }).finally(() => {
            active.pendingChunks -= 1
            active.pendingBytes -= size
            if (active.pendingChunks === 0) active.warnedBehind = false
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
  }, [activeSessionId, activeAspectRatio, bridge, closeActive, previewSourceRef])

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

function WebCastSection({ controller, aspect, canvasReady, nativeBusy, hidden }: { controller: WebCastController; aspect: OutputAspectRatio | null; canvasReady: boolean; nativeBusy: boolean; hidden: boolean }) {
  const {view} = controller
  const link = view.session ? `${CAST_ORIGIN}/#${view.session.token}` : ''
  const qr = useMemo(() => link ? webCastQrPath(link) : '', [link])
  const [copyResult, setCopyResult] = useState<{ sessionId: string; success: boolean } | null>(null)
  const [showLink, setShowLink] = useState(false)
  const linkId = useId()
  useEffect(() => { setCopyResult(null); setShowLink(false) }, [link])
  const copied = copyResult?.sessionId === view.session?.id && copyResult?.success === true
  const copyFailed = copyResult?.sessionId === view.session?.id && copyResult?.success === false
  const copyCode = async () => {
    const session = view.session
    if (!session) return
    try {
      const nativeCopy = getNativeOutputBridge()?.copyWebCastCode
      if (nativeCopy) await nativeCopy(session.code)
      else await navigator.clipboard.writeText(session.code)
      setCopyResult({ sessionId: session.id, success: true })
    } catch {
      setCopyResult({ sessionId: session.id, success: false })
    }
  }
  return <section className="rv-cast-device-category rv-cast-category--web" aria-label="Web casting" hidden={hidden}>
    <span className="rv-cast-device-category-hdr">Web Casting</span>
    <div className={`rv-webcast-card${view.session || view.busy || view.error || nativeBusy || !controller.configured ? ' rv-webcast-card--expanded' : ''}`}>
      <div className="rv-webcast-header"><span className="rv-cast-tile-icon"><CastIcon /></span><div><strong>STAGELESS Cast</strong><small>Live visuals on any compatible browser. No receiver app required.</small></div></div>
      {!view.session ? <button type="button" className="rv-webcast-action" disabled={view.busy || nativeBusy || !canvasReady || !controller.configured} onClick={() => void controller.start(aspect ?? '16:9')}>{view.busy ? 'Creating session…' : 'Create Cast Session'}</button> : <>
        <div className="rv-webcast-pair">
          <svg role="img" aria-label="Scan to join this cast" viewBox="0 0 45 45" shapeRendering="crispEdges"><rect width="45" height="45" fill="white"/><path d={qr} fill="#000"/></svg>
          <div>
            <small>Open cast.stagelessstudio.com</small>
            <strong className="rv-webcast-code">{view.session.code}</strong>
            <div className="rv-webcast-session-actions" role="group" aria-label="Cast session actions">
              <button className={`rv-cast-icon-btn${copied ? ' is-active' : ''}`} type="button" aria-label="Copy session code" title={copied ? 'Session code copied' : 'Copy session code'} onClick={() => void copyCode()}><AppIcon kind={copied ? 'check' : 'copy'} /></button>
              <button className={`rv-cast-icon-btn${showLink ? ' is-active' : ''}`} type="button" aria-label={showLink ? 'Hide session URL' : 'Show session URL'} title={showLink ? 'Hide session URL' : 'Show session URL'} aria-expanded={showLink} aria-controls={showLink ? linkId : undefined} onClick={() => setShowLink(value => !value)}><AppIcon kind={showLink ? 'eyeOff' : 'eye'} /></button>
              <button className="rv-cast-icon-btn" type="button" aria-label="Launch session in browser" title="Launch session in browser" onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}><AppIcon kind="open" /></button>
            </div>
            {copied && <small role="status">Session code copied.</small>}
            {copyFailed && <small role="alert" className="rv-webcast-error">Could not copy the session code. Select the code to copy it manually.</small>}
          </div>
        </div>
        {showLink && <input id={linkId} className="rv-webcast-link" aria-label="Secure cast link" readOnly value={link} onFocus={event => event.currentTarget.select()} />}
        <p className="rv-webcast-status" role="status">{view.status} · {view.aspect} · up to 60 fps</p>
        {view.status === 'Receiver requests access' && <div className="rv-webcast-actions"><button type="button" className="rv-webcast-action" onClick={()=>void controller.decide(true)}>Approve receiver</button><button type="button" className="rv-cast-stop" onClick={()=>void controller.decide(false)}>Deny</button></div>}
        {view.receiverId && view.status !== 'Receiver requests access' && <button type="button" className="rv-webcast-action" onClick={()=>void controller.decide(false)}>Disconnect receiver</button>}
        <button type="button" className="rv-cast-stop" onClick={()=>controller.stop()}>Stop Web Cast</button>
      </>}
      {view.busy && <button type="button" className="rv-cast-stop" onClick={()=>controller.stop()}>Cancel</button>}
      {!controller.configured && <small>Sign-in service is not configured in this build.</small>}
      {nativeBusy && !view.session && <small>Stop the current native output before starting a web cast.</small>}
      {view.error && <small role="alert" className="rv-webcast-error">{view.error}</small>}
    </div>
  </section>
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
  webCast: WebCastController
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
  webCast,
}: OutputCastPopoverProps) {
  const [category, setCategory] = useState<CastCategory>('web')
  const categoryHidden = (value: CastCategory) => category !== value
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
  const readyToCast = Boolean(windowMode && aspectRatio && canvasReady && bridge && !webCast.active)
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
  }, [updatePosition, category])

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
      <div className="rv-cast-tile-grid">
        {items.map(target => {
          const active = session?.targetId === target.id
          const pending = pendingTargetId === target.id && session?.state !== 'connected'
          const isLive = active && session?.state === 'connected'
          const stateLabel = isLive
            ? 'Live'
            : pending
              ? 'Connecting…'
              : target.kind === 'network' && target.receiverPaired === false
                ? 'Pair & Cast'
                : 'Cast'
          return (
            <button
              key={target.id}
              type="button"
              className={`rv-cast-tile${active ? ' is-active' : ''}`}
              disabled={!readyToCast || !target.available || Boolean(pendingTargetId && !active)}
              title={target.detail}
              onClick={() => start(target)}
            >
              <span className="rv-cast-tile-icon"><AppIcon kind={target.kind === 'network' ? 'cast' : 'monitor'} /></span>
              <span className="rv-cast-device-copy"><strong>{target.name}</strong></span>
              <span className={`rv-cast-tile-pill${isLive ? ' is-live' : ''}`}>{stateLabel}</span>
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

  const sessionResolutionLabel = session?.stats?.width && session.stats?.height
    ? `${Math.round(session.stats.width)}×${Math.round(session.stats.height)}`
    : null
  const sessionStatsParts = session?.stats
    ? [
        session.stats.framesPerSecond !== null ? `${Math.round(session.stats.framesPerSecond)} fps` : null,
        session.stats.bitrateKbps !== null ? `${(session.stats.bitrateKbps / 1000).toFixed(1)} Mbps` : null,
        session.stats.roundTripTimeMs !== null ? `${Math.round(session.stats.roundTripTimeMs)} ms` : null,
      ].filter((part): part is string => Boolean(part))
    : []
  const sessionWindowModeLabel = session
    ? WINDOW_OPTIONS.find(option => option.id === session.windowMode)?.label ?? session.windowMode
    : null
  const sessionStatusLabel = session
    ? session.state === 'connected' ? 'Now casting'
      : session.state === 'failed' ? 'Output failed'
      : session.state === 'disconnecting' ? 'Stopping output'
      : 'Connecting output'
    : null

  return createPortal(
    <section
      ref={popoverRef}
      className={`rv-cast-popover rv-cast-popover--${placement} rv-cast-layout--tabs`}
      style={popoverStyle}
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className="rv-cast-popover-surface">
        <header className="rv-cast-compact-title">
          <span className="rv-cast-compact-title-icon"><CastIcon /></span>
          <h2 id={titleId}>Cast Output</h2>
          <button type="button" className="rv-cast-icon-btn rv-cast-icon-btn--close" onClick={onClose} aria-label="Close cast panel" title="Close cast panel">
            <CloseIcon />
          </button>
        </header>
        <div className="rv-cast-panel-body">
          {/* Degrouped — no enclosing background/border box; Window and
              Aspect Ratio sit directly in one plain row. */}
          <div className="rv-cast-settings-bar">
            <fieldset className="rv-cast-rail-section">
              <legend>Window</legend>
              <div className="rv-cast-rail-group">
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
                    <WindowModeIcon mode={option.id} />
                    <span className="rv-cast-rail-option-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <span className="rv-cast-rail-divider" aria-hidden="true" />
            <fieldset className="rv-cast-rail-section">
              <legend>Aspect Ratio</legend>
              <div className="rv-cast-rail-group rv-cast-rail-group--aspect">
                {ASPECT_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    className={aspectRatio === option ? 'is-selected' : ''}
                    aria-pressed={aspectRatio === option}
                    onClick={() => setAspectRatio(option)}
                  >
                    <AspectRatioIcon ratio={option} />
                    <span className="rv-cast-rail-option-label">{option}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {!readyToCast && bridge && canvasReady && !webCast.active && (!windowMode || !aspectRatio) && (
            <p className="rv-cast-device-note rv-cast-format-hint">Select a window mode and aspect ratio to cast to a display.</p>
          )}

          {/* Current status — devices already in use or being negotiated,
              not "available" ones, so this sits above (not under) Available
              Devices. Styled like a record in a list: a standalone colored
              bar, a flat background matching .vz-track-row (the user's
              Audio Track card background in Media Manager), and one
              neutral gray border shared by every state — state reads
              through the bar/pill color alone. */}
          {session && (
            <div className="rv-cast-status-section">
              <span className="rv-cast-device-heading-title">
                <CurrentDevicesIcon />
                <span>Current Devices</span>
              </span>
              <div className={`rv-cast-session rv-cast-session--${session.state}`}>
                <span className="rv-cast-session-bar" aria-hidden="true" />
                <div className="rv-cast-session-info">
                  <div className="rv-cast-session-name-row">
                    <strong>{session.targetName}</strong>
                    <span className="rv-cast-session-status">
                      <span className="rv-cast-session-status-dot" aria-hidden="true" />
                      {sessionStatusLabel}
                    </span>
                  </div>
                  <small><span className="rv-cast-session-field-label">Window</span>{sessionWindowModeLabel}</small>
                  <small>
                    <span className="rv-cast-session-field-label">Aspect Ratio</span>
                    {sessionResolutionLabel ? joinWithDot([session.aspectRatio, sessionResolutionLabel]) : session.aspectRatio}
                  </small>
                  {sessionStatsParts.length > 0 && (
                    <small><span className="rv-cast-session-field-label">Stats</span>{joinWithDot(sessionStatsParts)}</small>
                  )}
                </div>
                <button type="button" className="rv-cast-stop" onClick={onStop}>Stop Output</button>
              </div>
            </div>
          )}

          <div className="rv-cast-devices-section">
            <div className="rv-cast-device-heading">
              <span className="rv-cast-device-heading-title">
                <AvailableDevicesIcon />
                <span>Available Devices</span>
              </span>
              <button type="button" className="rv-cast-icon-btn" onClick={onRefresh} aria-label="Refresh output devices">
                <RefreshIcon />
              </button>
            </div>

            <div className="rv-right-subtabs rv-cast-category-tabs" role="group" aria-label="Output categories">
              {CAST_CATEGORIES.map(option => (
                <button key={option.id} type="button" className={category === option.id ? 'is-active' : ''}
                  aria-pressed={category === option.id} onClick={() => setCategory(option.id)}>{option.label}</button>
              ))}
            </div>

            {!bridge && (
              <DrawerNotice tone="info" role="status" title="Browser output">STAGELESS Cast works in your browser. Local and native wireless displays require the desktop app.</DrawerNotice>
            )}
            {bridge && !canvasReady && (
              <DrawerNotice tone="info" role="status" title="Output canvas preparing">The active engine is still preparing its live output canvas.</DrawerNotice>
            )}
            {providerIssues.map(status => (
              <DrawerNotice key={status.providerId} tone="warning" role="status" title={status.label}>
                {status.message ?? 'This output provider is currently unavailable.'}
              </DrawerNotice>
            ))}

            <div className="rv-cast-destination-layout">
              <WebCastSection controller={webCast} aspect={aspectRatio} canvasReady={canvasReady}
                nativeBusy={Boolean(session || pendingTargetId || pendingProviderAction)}
                hidden={categoryHidden('web') && !webCast.active && !webCast.view.session && !webCast.view.busy && !webCast.view.error} />

              {showWirelessDisplays && (
                <section className="rv-cast-device-category rv-cast-category--wireless" aria-label="Wireless displays" hidden={categoryHidden('wireless')}>
                  <span className="rv-cast-device-category-hdr">Wireless Displays</span>
                  <div className="rv-cast-tile-grid">
                    {airplayProvider && airplayProvider.state !== 'unsupported' && (
                      <button
                        type="button"
                        className="rv-cast-tile"
                        disabled={!bridge?.performProviderAction || !airplayAction || !airplayActionAvailable || Boolean(pendingProviderAction)}
                        onClick={() => airplayAction && void performProviderAction('airplay', airplayAction)}
                      >
                        <span className="rv-cast-tile-icon"><AppleLogoIcon /></span>
                        <span className="rv-cast-device-copy"><strong>Open macOS Displays</strong>
                        <span className="rv-cast-tile-detail">Mirror or extend to an AirPlay display.</span></span>
                        <span className="rv-cast-tile-pill">
                          {pendingProviderAction === 'airplay:open-system-picker' ? 'Opening…' : 'Open'}
                        </span>
                      </button>
                    )}

                    {miracastProvider && miracastProvider.state !== 'unsupported' && (
                      <button
                        type="button"
                        className="rv-cast-tile"
                        disabled={!bridge?.performProviderAction || !miracastAction || !miracastActionAvailable || Boolean(pendingProviderAction)}
                        onClick={() => miracastAction && void performProviderAction('miracast', miracastAction)}
                      >
                        <span className="rv-cast-tile-icon"><WindowsLogoIcon /></span>
                        <span className="rv-cast-device-copy"><strong>Open Windows Displays</strong>
                        <span className="rv-cast-tile-detail">Use Connect under Multiple displays.</span></span>
                        <span className="rv-cast-tile-pill">
                          {pendingProviderAction === 'miracast:open-system-picker' ? 'Opening…' : 'Open'}
                        </span>
                      </button>
                    )}

                    {googleCastProvider && (
                      <button
                        type="button"
                        className="rv-cast-tile"
                        disabled={!bridge?.performProviderAction || !googleCastAction || !googleCastActionAvailable || !readyToCast || Boolean(pendingProviderAction) || Boolean(session)}
                        onClick={() => googleCastAction && void performProviderAction('google-cast', googleCastAction, { windowMode, aspectRatio })}
                      >
                        <span className="rv-cast-tile-icon"><GoogleLogoIcon /></span>
                        <span className="rv-cast-device-copy"><strong>Choose Google Cast Device</strong>
                        <span className="rv-cast-tile-detail">{googleCastProvider.state === 'configuration-required'
                          ? 'Configure the Cast receiver app ID and HTTPS sender companion first.'
                          : 'Choose a Cast device in the supported browser Web Sender companion.'}</span></span>
                        <span className={`rv-cast-tile-pill${googleCastProvider.state === 'available' || googleCastProvider.state === 'initialization-failed' ? '' : ' is-muted'}`}>
                          {pendingProviderAction === 'google-cast:open-picker' ? 'Opening…' : googleCastProvider.state === 'available' || googleCastProvider.state === 'initialization-failed' ? 'Choose' : 'Setup'}
                        </span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              {category === 'wireless' && !showWirelessDisplays && (
                <div className="rv-cast-empty">No wireless display providers are available on this device.</div>
              )}
              <section className="rv-cast-device-category rv-cast-category--local" aria-label="Local displays" hidden={categoryHidden('local')}>
                <span className="rv-cast-device-category-hdr">Local Displays</span>
                {renderTargets(groups.displays, 'No local displays are currently available.')}
              </section>

              <section className="rv-cast-device-category rv-cast-category--receiver" aria-label="STAGELESS receivers" hidden={categoryHidden('receiver')}>
                <span className="rv-cast-device-category-hdr">{BRAND_RECEIVERS}</span>
                {renderTargets(groups.network, 'No STAGELESS receivers were found on this network.')}
                <p className="rv-cast-device-note">Open STAGELESS on another computer to make it discoverable. Each Receiver V2 display is selectable independently; first use asks the receiving computer to approve pairing.</p>
              </section>
            </div>
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
  onPerformanceAspectChange?: (aspectRatio: OutputAspectRatio | null) => void
}

export function OutputCastControl({
  canvas,
  capability = CANVAS_OUTPUT_AVAILABLE,
  onPerformanceAspectChange,
}: OutputCastControlProps) {
  const backgrounded = useReactBackgrounded()
  const bridge = useMemo(() => getNativeOutputBridge(), [])
  const outputAvailable = isCanvasOutputAvailable(capability)
  const safeCanvas = outputAvailable ? canvas : null
  const webSourceRef = useRef(safeCanvas)
  useLayoutEffect(() => { webSourceRef.current = safeCanvas }, [safeCanvas])
  const outputAvailableRef = useRef(outputAvailable)
  const refreshGenerationRef = useRef(0)
  const sessionRevisionRef = useRef(0)
  const unmountStopTimerRef = useRef<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const previewId = useId()
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null)
  const previewSourceRef = useRef<HTMLCanvasElement | null>(null)
  const webCast = useWebCast(aspect => {
    const relay = createRelayCapture(webSourceRef, aspect)
    previewSourceRef.current = relay.canvas
    return { stream: relay.stream, stop: () => { relay.stop(); if (previewSourceRef.current === relay.canvas) previewSourceRef.current = null } }
  }, outputAvailable)
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null)
  const [targets, setTargets] = useState<OutputTarget[]>([])
  const [session, setSession] = useState<OutputCastSession | null>(null)
  // Lock before asking native to open a receiver; native registration can race the startCast reply.
  const [pendingAspectRatio, setPendingAspectRatio] = useState<OutputAspectRatio | null>(null)
  const activeAspectRatio = outputAvailable ? webCast.view.aspect ?? pendingAspectRatio ?? (
    session && (session.state === 'connecting' || session.state === 'connected' || session.state === 'disconnecting')
      ? session.aspectRatio : null
  ) : null
  useLayoutEffect(() => { onPerformanceAspectChange?.(activeAspectRatio) }, [activeAspectRatio, onPerformanceAspectChange])
  useLayoutEffect(() => () => onPerformanceAspectChange?.(null), [onPerformanceAspectChange])
  // Self-healing: remembers the cast the user started and brings it back (same target, window and aspect ratio) if the session fails on its own.
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge
  const canvasAvailableRef = useRef(false)
  const reconnectorRef = useRef<CastReconnector<OutputCastRequest> | null>(null)
  if (!reconnectorRef.current) {
    reconnectorRef.current = new CastReconnector<OutputCastRequest>({
      start: async (request) => {
        const active = bridgeRef.current
        if (!active || !outputAvailableRef.current || !canvasAvailableRef.current) return false
        sessionRevisionRef.current += 1
        flushSync(() => setPendingAspectRatio(request.aspectRatio))
        try {
          await active.stopCast().catch(() => null)
          if (!outputAvailableRef.current) return false
          const revision = sessionRevisionRef.current
          const next = await active.startCast(request)
          if (!outputAvailableRef.current) { await active.stopCast().catch(() => null); return false }
          if (revision === sessionRevisionRef.current) { sessionRevisionRef.current += 1; setSession(next) }
          return next !== null && next.state !== 'failed'
        } finally {
          setPendingAspectRatio(null)
        }
      },
    })
  }
  const [providerStatuses, setProviderStatuses] = useState<OutputProviderStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastStatsLogRef = useRef(0)
  const castState = outputAvailable ? session?.state ?? 'disconnected' : 'unavailable'
  const castId = session?.id ?? null
  const castTransport = session?.transport ?? 'webrtc'
  useEffect(() => { reconnectorRef.current?.observe(castState) }, [castState, castId])
  useEffect(() => {
    const active = webCast.active || castState === 'connecting' || castState === 'connected'
    setPerformanceCastActive(active)
    recordPerformanceEvent('cast', 'cast-state', { state: webCast.active ? 'web-cast-active' : castState, transport: webCast.active ? 'web-cast-webrtc' : castTransport, sessionId: castId })
    return () => setPerformanceCastActive(false)
  }, [castState, castId, castTransport, webCast.active])
  useEffect(() => {
    if (!session?.stats || performance.now() - lastStatsLogRef.current < 10_000) return
    lastStatsLogRef.current = performance.now()
    recordPerformanceEvent('cast', 'cast-summary', { state: session.state, transport: castTransport,
      width: session.stats.width, height: session.stats.height, fps: session.stats.framesPerSecond,
      bitrateKbps: session.stats.bitrateKbps, packetsLost: session.stats.packetsLost })
  }, [session, castTransport])

  // A cast whose frame rate collapses means the GPU is doing too much at once (rendering, copying, encoding). Report it, so every renderer sheds load and the relay
  // halves its rate until the stream keeps up again. WebRTC only: the Google Cast stream's reported rate is the configured one, not a measurement.
  const loadShedderRef = useRef<CastLoadShedder | null>(null)
  const lastShedStatsRef = useRef<unknown>(null)
  useEffect(() => {
    const shedder = loadShedderRef.current ?? (loadShedderRef.current = new CastLoadShedder())
    const stats = session?.stats ?? null
    if (castTransport !== 'webrtc' || session?.state !== 'connected') {
      lastShedStatsRef.current = null
      if (shedder.reset().changed) { setPerformancePressure('cast', 0); recordPerformanceEvent('cast', 'load-shedding', { level: 0, reason: 'cast-ended' }) }
      return
    }
    // One reading per stats report, however many times the session object changes in between.
    if (!stats || stats === lastShedStatsRef.current) return
    lastShedStatsRef.current = stats
    const state = shedder.observe({ fps: stats.framesPerSecond, connected: true, visible: typeof document === 'undefined' || document.visibilityState !== 'hidden' })
    if (!state.changed) return
    setPerformancePressure('cast', state.level)
    recordPerformanceEvent('cast', 'load-shedding', { level: state.level, relayFps: state.targetFps, measuredFps: stats.framesPerSecond })
  }, [session, castTransport])
  useEffect(() => () => { loadShedderRef.current?.reset(); setPerformancePressure('cast', 0) }, [])

  useEffect(() => { if (session && session.state !== 'failed' && webCast.active) webCast.stop('Native output took over the cast.') }, [session, webCast.active, webCast.stop])
  const liveSessionId = outputAvailable ? (session?.state === 'connected' ? session.id : webCast.view.status === 'Now casting' ? webCast.view.session?.id ?? null : null) : null
  const castConnected = liveSessionId !== null
  const previewOpen = castConnected && previewSessionId === liveSessionId
  useEffect(() => {
    if (!castConnected) setPreviewSessionId(null)
  }, [castConnected])
  const closePreview = () => {
    setPreviewSessionId(null)
    previewTriggerRef.current?.focus({ preventScroll: true })
  }

  canvasAvailableRef.current = safeCanvas !== null
  useOutputBroadcaster(outputAvailable ? bridge : null, safeCanvas, outputAvailable ? session : null, previewSourceRef)
  useGoogleCastBroadcaster(outputAvailable ? bridge : null, safeCanvas, outputAvailable ? session : null, previewSourceRef)

  useLayoutEffect(() => {
    outputAvailableRef.current = outputAvailable
    if (outputAvailable) return
    refreshGenerationRef.current += 1
    setOpen(false)
    setTargets([])
    setProviderStatuses([])
    setLoading(false)
    setError(null)
    sessionRevisionRef.current += 1
    setSession(null)
    setPendingAspectRatio(null)
    reconnectorRef.current?.forget()
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
      const revision = sessionRevisionRef.current
      const nextSession = await bridge.getSession()
      if (!outputAvailableRef.current || generation !== refreshGenerationRef.current) return
      setTargets(snapshot.targets)
      setProviderStatuses(snapshot.providers)
      if (revision === sessionRevisionRef.current) setSession(nextSession)
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
      if (outputAvailableRef.current) { sessionRevisionRef.current += 1; setSession(nextSession) }
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
        reconnectorRef.current?.forget()
        void bridge.stopCast().catch(() => null)
      }, 0)
    }
  }, [bridge, outputAvailable])

  const performProviderAction = useCallback(async (providerId: OutputProviderId, actionId: string, payload?: unknown) => {
    if (!bridge?.performProviderAction || !outputAvailable || (providerId === 'google-cast' && webCast.active)) return
    setError(null)
    try {
      const revision = sessionRevisionRef.current
      const result = await bridge.performProviderAction(providerId, actionId, payload)
      if (result.session && outputAvailableRef.current && revision === sessionRevisionRef.current) {
        sessionRevisionRef.current += 1
        setSession(result.session)
      }
      await refresh()
    } catch (value) {
      if (outputAvailableRef.current) {
        setError(value instanceof Error ? value.message : 'Could not open the output provider action')
      }
    }
  }, [bridge, outputAvailable, refresh, webCast.active])

  const startCast = useCallback(async (
    target: OutputTarget,
    windowMode: OutputWindowMode,
    aspectRatio: OutputAspectRatio,
  ) => {
    if (!bridge || !outputAvailable || !safeCanvas || webCast.active) return
    setError(null)
    const request: OutputCastRequest = { targetId: target.id, windowMode, aspectRatio }
    reconnectorRef.current?.remember(request)
    sessionRevisionRef.current += 1
    flushSync(() => setPendingAspectRatio(aspectRatio))
    try {
      const revision = sessionRevisionRef.current
      const nextSession = await bridge.startCast(request)
      if (!outputAvailableRef.current) {
        await bridge.stopCast().catch(() => null)
        return
      }
      if (revision === sessionRevisionRef.current) { sessionRevisionRef.current += 1; setSession(nextSession) }
    } catch (value) {
      reconnectorRef.current?.forget()
      if (outputAvailableRef.current) {
        setError(value instanceof Error ? value.message : 'Could not start output')
      }
    } finally {
      setPendingAspectRatio(null)
    }
  }, [bridge, outputAvailable, safeCanvas, webCast.active])

  const stopCast = useCallback(async () => {
    if (!bridge) return
    setError(null)
    reconnectorRef.current?.forget()
    sessionRevisionRef.current += 1
    try {
      await bridge.stopCast()
      sessionRevisionRef.current += 1
      setSession(null)
      setPendingAspectRatio(null)
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
        className={`rv-cast-trigger${castConnected ? ' is-active' : ''}`}
        aria-label={session?.state === 'connected' ? `Output casting to ${session.targetName}` : webCast.active ? 'STAGELESS Cast session active' : 'Cast visual output'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={session?.state === 'connected' ? `Casting to ${session.targetName}` : 'Cast visual output'}
        onClick={() => setOpen(value => !value)}
      >
        <CastIcon />
        {castConnected && <span className="rv-cast-live-dot" aria-hidden="true" />}
      </button>
      {castConnected && (
        <button ref={previewTriggerRef} type="button" className={`rv-cast-trigger${previewOpen ? ' is-active' : ''}`}
          aria-label={previewOpen ? 'Hide cast preview' : 'Show cast preview'} title={previewOpen ? 'Hide cast preview' : 'Show cast preview'}
          aria-pressed={previewOpen} aria-expanded={previewOpen} aria-controls={previewOpen ? previewId : undefined}
          onClick={() => setPreviewSessionId(previewOpen ? null : liveSessionId)}>
          <AppIcon kind="eye" />
        </button>
      )}
      {previewOpen && !backgrounded && (
        <CastPreviewWindow key={liveSessionId} id={previewId} anchor={previewTriggerRef.current}
          sourceRef={previewSourceRef} onClose={closePreview} />
      )}
      {open && !backgrounded && (
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
          webCast={webCast}
        />
      )}
      {/* Failures are listed here, outside the popover, so they stay in the Notifications drawer after it is closed. */}
      {webCast.view.error && !open && <DrawerNotice tone="error" role="alert" title="STAGELESS Cast">{webCast.view.error}</DrawerNotice>}
      {error && <DrawerNotice tone="error" role="alert" title="Casting error">{error}</DrawerNotice>}
      {session?.error && (
        <DrawerNotice tone="error" role="alert" title={session.state === 'failed' ? 'Output failed' : 'Output problem'}>
          {session.error}
        </DrawerNotice>
      )}
    </>
  )
}
