import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { resolveRawCinema2MainframeBeatClock } from '../mainframe/Cinema2MainframePatternEngine'

/** The speed the ambient motion runs at with no tempo to follow: 120 BPM. */
const AMBIENT_BPM = 120
const clampBpm = (bpm: number) => Number.isFinite(bpm) ? Math.max(40, Math.min(220, bpm)) : AMBIENT_BPM

/**
 * The clock the core's animation and the extra elements (orbit rings, dial, dust, inner shell) run on, in beats. It is the one clock for all of them, so they
 * stay in step. It follows the shared tempo while BPM Sync is on and a tempo is known, and runs at 120 BPM otherwise, so the sculpture is alive with or
 * without music (with no track it runs on the frame timestamps). It stands still while a track is paused, and Motion Speed scales it. It makes no musical decisions: the beats are the shared clock's.
 */
export class Cinema2InertiaFlow {
  private clock = 0
  private lastFrame = -1
  private lastTimestamp: number | null = null

  update(frame: Cinema2ModuleFrameReadContext, sync: boolean, speed: number): number {
    if (frame.frameId === this.lastFrame) return this.clock
    this.lastFrame = frame.frameId
    const transport = frame.transport
    // With no track the runtime reports no frame delta, so the idle sculpture runs on the frame timestamps; with a track it uses the frame's own delta (which the runtime
    // holds at zero while the track is paused or its analysis is not running).
    const idleDelta = this.lastTimestamp == null ? 0 : (frame.timestampMs - this.lastTimestamp) / 1000
    this.lastTimestamp = frame.timestampMs
    if (transport?.sourcePresent && transport.paused) return this.clock
    const raw = transport?.sourcePresent ? frame.deltaTimeSec : idleDelta
    const delta = Math.max(0, Math.min(0.1, Number.isFinite(raw) ? raw : 0))
    const effective = sync && transport?.bpmSync !== false
    const clock = effective ? resolveRawCinema2MainframeBeatClock(frame, true) : null
    const bpm = clock && clock.source !== 'visual-fallback-120' ? clampBpm(clock.bpm) : AMBIENT_BPM
    this.clock += delta * bpm / 60 * Math.max(0, speed)
    return this.clock
  }

  reset(): void { this.clock = 0; this.lastFrame = -1; this.lastTimestamp = null }
}
