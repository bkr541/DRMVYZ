import type { CinemaEventId } from './CinemaIdentifiers'
import type { CinemaFrameContext, CinemaMusicalClockId } from './CinemaRendererContracts'

const IMPULSE_KEYS = Object.freeze([
  'beat', 'downbeat', 'kick', 'snare', 'transient', 'sectionStart', 'dropStart',
  'lyricCue', 'lyricWord', 'phrase4', 'phrase8',
] as const)

const CLOCK_KEYS = Object.freeze([
  'beat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase',
] as const satisfies readonly CinemaMusicalClockId[])

/**
 * Last-line runtime protection for every Cinema consumer. A deterministic event
 * identity can pass once, even if a caller accidentally reuses a frame snapshot.
 */
export class CinemaImpulseGate {
  private readonly consumed = new Map<string, CinemaEventId>()

  consume(frame: Readonly<CinemaFrameContext>): Readonly<CinemaFrameContext> {
    // Safe-output and older harness frames may intentionally provide only the
    // transport/viewport subset. They carry no impulses to consume.
    if (!frame.impulses || !frame.music?.clocks) return frame
    if (frame.transport.reset.required) {
      this.consumed.clear()
      return suppressFrameEvents(frame)
    }

    let changed = false
    const impulses = { ...frame.impulses }
    for (const key of IMPULSE_KEYS) {
      const active = frame.impulses[key]
      const eventId = frame.impulses.eventIds[key]
      const accepted = this.accept(`impulse:${key}`, active, eventId)
      if (accepted !== active) changed = true
      impulses[key] = accepted
    }

    const states = { ...frame.music.clocks.states }
    const clockFlags = { ...frame.music.clocks }
    for (const key of CLOCK_KEYS) {
      const clock = frame.music.clocks.states[key]
      const accepted = this.accept(`clock:${key}`, clock.hit, clock.eventId)
      if (accepted !== clock.hit) changed = true
      if (accepted !== clock.hit) states[key] = { ...clock, hit: accepted }
      clockFlags[key] = accepted
    }

    if (!changed) return frame
    return {
      ...frame,
      impulses: { ...impulses, eventIds: frame.impulses.eventIds },
      music: {
        ...frame.music,
        clocks: { ...clockFlags, states },
      },
    }
  }

  reset(): void {
    this.consumed.clear()
  }

  private accept(key: string, active: boolean, eventId: CinemaEventId | null): boolean {
    if (!active || eventId == null) return false
    if (this.consumed.get(key) === eventId) return false
    this.consumed.set(key, eventId)
    return true
  }
}

function suppressFrameEvents(frame: Readonly<CinemaFrameContext>): Readonly<CinemaFrameContext> {
  const hasImpulse = IMPULSE_KEYS.some(key => frame.impulses[key])
  const hasClock = CLOCK_KEYS.some(key => frame.music.clocks.states[key].hit)
  if (!hasImpulse && !hasClock) return frame
  const impulses = { ...frame.impulses }
  for (const key of IMPULSE_KEYS) impulses[key] = false
  const states = { ...frame.music.clocks.states }
  const clocks = { ...frame.music.clocks }
  for (const key of CLOCK_KEYS) {
    states[key] = { ...states[key], hit: false }
    clocks[key] = false
  }
  return {
    ...frame,
    impulses: { ...impulses, eventIds: frame.impulses.eventIds },
    music: { ...frame.music, clocks: { ...clocks, states } },
  }
}
