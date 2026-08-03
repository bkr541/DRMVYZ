import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  getNativeOutputBridge,
  type NativeOutputBridge,
  type OutputAspectRatio,
  type OutputCastSession,
  type OutputTarget,
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
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

function createRelayCapture(sourceRef: MutableRefObject<HTMLCanvasElement | null>): RelayCapture {
  const relay = document.createElement('canvas')
  relay.width = Math.max(2, sourceRef.current?.width ?? 1920)
  relay.height = Math.max(2, sourceRef.current?.height ?? 1080)
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
      if (relay.width !== source.width || relay.height !== source.height) {
        relay.width = source.width
        relay.height = source.height
      }
      context.drawImage(source, 0, 0, relay.width, relay.height)
    } else {
      context.fillStyle = '#000'
      context.fillRect(0, 0, relay.width, relay.height)
    }
    frameId = window.requestAnimationFrame(render)
  }
  render()
  const stream = relay.captureStream(60)

  return {
    stream,
    stop: () => {
      stopped = true
      window.cancelAnimationFrame(frameId)
      for (const track of stream.getTracks()) track.stop()
    },
  }
}

function useOutputBroadcaster(
  bridge: NativeOutputBridge | null,
  canvas: HTMLCanvasElement | null,
  session: OutputCastSession | null,
) {
  const canvasRef = useRef(canvas)
  const activeRef = useRef<{ sessionId: string; peer: RTCPeerConnection; relay: RelayCapture } | null>(null)

  useEffect(() => {
    canvasRef.current = canvas
  }, [canvas])

  const closeActive = useCallback(() => {
    const active = activeRef.current
    if (!active) return
    active.peer.close()
    active.relay.stop()
    activeRef.current = null
  }, [])

  useEffect(() => {
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
          activeRef.current = { sessionId, peer, relay }
          peer.addEventListener('connectionstatechange', () => {
            if (peer.connectionState !== 'failed') return
            closeActive()
            void bridge.failSession(sessionId, 'The output receiver connection failed').catch(() => false)
          })
          for (const track of relay.stream.getTracks()) peer.addTrack(track, relay.stream)
          const offer = await peer.createOffer()
          await peer.setLocalDescription(offer)
          await waitForIceGatheringComplete(peer)
          if (!peer.localDescription) throw new Error('The output stream could not create an offer')
          await bridge.publishOffer(sessionId, peer.localDescription.toJSON())
          const answer = await bridge.waitForAnswer(sessionId)
          await peer.setRemoteDescription(answer)
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

function groupTargets(targets: OutputTarget[]) {
  return {
    displays: targets.filter(target => target.kind === 'display'),
    network: targets.filter(target => target.kind === 'network'),
  }
}

interface OutputCastModalProps {
  bridge: NativeOutputBridge | null
  canvasReady: boolean
  targets: OutputTarget[]
  session: OutputCastSession | null
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh: () => void
  onCast: (target: OutputTarget, windowMode: OutputWindowMode, aspectRatio: OutputAspectRatio) => void
  onStop: () => void
}

function OutputCastModal({
  bridge,
  canvasReady,
  targets,
  session,
  loading,
  error,
  onClose,
  onRefresh,
  onCast,
  onStop,
}: OutputCastModalProps) {
  const [windowMode, setWindowMode] = useState<OutputWindowMode | null>(null)
  const [aspectRatio, setAspectRatio] = useState<OutputAspectRatio | null>(null)
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null)
  const titleId = 'rv-output-cast-title'
  const groups = useMemo(() => groupTargets(targets), [targets])
  const readyToCast = Boolean(windowMode && aspectRatio && canvasReady && bridge)

  useEffect(() => {
    if (!session || session.state === 'connected' || session.state === 'error' || error) setPendingTargetId(null)
  }, [error, session])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const start = (target: OutputTarget) => {
    if (!windowMode || !aspectRatio || !readyToCast) return
    setPendingTargetId(target.id)
    onCast(target, windowMode, aspectRatio)
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
                {active && session?.state === 'connected' ? 'Live' : pending ? 'Connecting…' : 'Cast'}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return createPortal(
    <div className="rv-cast-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="rv-cast-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="rv-cast-header">
          <div>
            <span className="rv-cast-eyebrow">Live Visual Output</span>
            <h2 id={titleId}>Cast Output</h2>
          </div>
          <button type="button" className="rv-cast-icon-btn" onClick={onClose} aria-label="Close output devices">
            <CloseIcon />
          </button>
        </header>

        {session && (
          <div className={`rv-cast-session rv-cast-session--${session.state}`}>
            <div>
              <span>{session.state === 'connected' ? 'Now casting' : 'Output session'}</span>
              <strong>{session.targetName}</strong>
              <small>{session.windowMode} · {session.aspectRatio}</small>
            </div>
            <button type="button" className="rv-cast-stop" onClick={onStop}>Stop Output</button>
          </div>
        )}

        <div className="rv-cast-scroll">
          <fieldset className="rv-cast-fieldset">
            <legend>Window</legend>
            <div className="rv-cast-option-grid rv-cast-option-grid--window">
              {WINDOW_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={windowMode === option.id ? 'is-selected' : ''}
                  aria-pressed={windowMode === option.id}
                  onClick={() => setWindowMode(option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="rv-cast-fieldset">
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
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="rv-cast-device-heading">
            <div>
              <span>Available Devices</span>
              <small>Select both options above, then choose a device.</small>
            </div>
            <button type="button" className="rv-cast-icon-btn" onClick={onRefresh} aria-label="Refresh output devices">
              <RefreshIcon />
            </button>
          </div>

          {!bridge && (
            <div className="rv-cast-notice">Casting is available in the DRMVYZ desktop app. Browser builds keep the visualizer local.</div>
          )}
          {bridge && !canvasReady && (
            <div className="rv-cast-notice">The active engine is still preparing its live output canvas.</div>
          )}
          {error && <div className="rv-cast-error" role="alert">{error}</div>}

          <section className="rv-cast-device-group" aria-label="Connected displays">
            <h3>Displays</h3>
            {renderTargets(groups.displays, 'No displays are currently available.')}
          </section>

          <section className="rv-cast-device-group" aria-label="Network receivers">
            <h3>Network Receivers</h3>
            {renderTargets(groups.network, 'No DRMVYZ receivers were found on this network.')}
            <p>Open DRMVYZ on another computer to make it discoverable. AirPlay and Miracast screens appear under Displays after the operating system connects them.</p>
          </section>
        </div>
      </section>
    </div>,
    document.body,
  )
}

export interface OutputCastControlProps {
  canvas: HTMLCanvasElement | null
}

export function OutputCastControl({ canvas }: OutputCastControlProps) {
  const bridge = useMemo(() => getNativeOutputBridge(), [])
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<OutputTarget[]>([])
  const [session, setSession] = useState<OutputCastSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useOutputBroadcaster(bridge, canvas, session)

  const refresh = useCallback(async () => {
    if (!bridge) return
    setLoading(true)
    setError(null)
    try {
      setTargets(await bridge.listTargets())
      setSession(await bridge.getSession())
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not discover output devices')
    } finally {
      setLoading(false)
    }
  }, [bridge])

  useEffect(() => {
    if (!bridge) return
    const unsubscribeTargets = bridge.onTargetsChanged(setTargets)
    const unsubscribeSession = bridge.onSessionChanged(setSession)
    void refresh()
    return () => {
      unsubscribeTargets()
      unsubscribeSession()
    }
  }, [bridge, refresh])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const startCast = useCallback(async (
    target: OutputTarget,
    windowMode: OutputWindowMode,
    aspectRatio: OutputAspectRatio,
  ) => {
    if (!bridge) return
    setError(null)
    try {
      const nextSession = await bridge.startCast({ targetId: target.id, windowMode, aspectRatio })
      setSession(nextSession)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not start output')
    }
  }, [bridge])

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

  return (
    <>
      <button
        type="button"
        className={`rv-cast-trigger${session?.state === 'connected' ? ' is-active' : ''}`}
        aria-label={session?.state === 'connected' ? `Output casting to ${session.targetName}` : 'Cast visual output'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={session?.state === 'connected' ? `Casting to ${session.targetName}` : 'Cast visual output'}
        onClick={() => setOpen(true)}
      >
        <CastIcon />
        {session?.state === 'connected' && <span className="rv-cast-live-dot" aria-hidden="true" />}
      </button>
      {open && (
        <OutputCastModal
          bridge={bridge}
          canvasReady={canvas !== null}
          targets={targets}
          session={session}
          loading={loading}
          error={error}
          onClose={() => setOpen(false)}
          onRefresh={() => void refresh()}
          onCast={(target, windowMode, aspectRatio) => void startCast(target, windowMode, aspectRatio)}
          onStop={() => void stopCast()}
        />
      )}
    </>
  )
}
