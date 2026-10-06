import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2AfterhoursRenderBeam } from './Cinema2AfterhoursRenderer'

/**
 * A move shorter than this (world units at the target) is a continuous sweep, not a re-aim: the laser stays lit and follows it. Every
 * programmed hit and step moves a laser much further than this in one frame, so it is only the smooth sweeps that stay lit.
 */
export const CINEMA2_AFTERHOURS_RE_AIM_MIN_TRAVEL = 0.9
/** How long a scanner takes to reach a new point: a fixed settle time plus a little for distance, within a short, fast range. */
const MOVE_BASE_SEC = 0.02
const MOVE_PER_UNIT_SEC = 0.003
const MOVE_MIN_SEC = 0.03
const MOVE_MAX_SEC = 0.06
/**
 * How far ahead of the music the aims are read. A laser that re-aims on the beat goes dark for its trip, so to land lit on the beat (as a
 * programmed show does) it has to set off this much earlier: a typical trip plus a frame or two, since a laser is only switched back on at
 * the first frame after it arrives.
 */
export const CINEMA2_AFTERHOURS_AIM_LEAD_SEC = 0.06

/** Seconds a laser takes to travel `distance` world units to its next point. */
export function cinema2AfterhoursMoveDurationSec(distance: number): number {
  return Math.min(MOVE_MAX_SEC, Math.max(MOVE_MIN_SEC, MOVE_BASE_SEC + MOVE_PER_UNIT_SEC * Math.max(0, distance)))
}

interface BeamState {
  /** The aim the pattern last commanded. */
  commanded: Cinema2Vector3
  /** Seconds of travel left; the laser is dark until it reaches 0. */
  travelLeft: number
}

/**
 * Makes the lasers move the way a DMX laser does: it never travels while lit.
 *
 * The pattern engine commands an aim and, on a hit or a step, that aim jumps. A real scanner cannot teleport, so the moment a lit laser is told
 * to go somewhere new this switches it off, lets it travel, and switches it back on as it arrives at the new point: a hit lands at its new
 * aim as a lit beam, and no beam is ever seen sweeping across the picture. A laser that was already dark (a hit landing from a dark gate)
 * is simply on at its aim, since it re-aimed while blanked.
 */
export class Cinema2AfterhoursBeamBlanker {
  private states = new Map<string, BeamState>()

  reset(): void {
    this.states = new Map()
  }

  apply(beams: readonly Readonly<Cinema2AfterhoursRenderBeam>[], dtSec: number): readonly Cinema2AfterhoursRenderBeam[] {
    const dt = Number.isFinite(dtSec) ? Math.min(0.1, Math.max(0, dtSec)) : 0
    const next = new Map<string, BeamState>()
    const counts = new Map<string, number>()
    const lit: Cinema2AfterhoursRenderBeam[] = []

    for (const beam of beams) {
      const index = counts.get(beam.fixtureId) ?? 0
      counts.set(beam.fixtureId, index + 1)
      const key = `${beam.fixtureId}#${index}`
      const previous = this.states.get(key)
      if (!previous) {
        next.set(key, { commanded: beam.targetWorld, travelLeft: 0 })
        lit.push(beam)
        continue
      }

      let travelLeft = Math.max(0, previous.travelLeft - dt)
      const target = beam.targetWorld
      const travelled = Math.hypot(
        target[0] - previous.commanded[0],
        target[1] - previous.commanded[1],
        target[2] - previous.commanded[2],
      )
      // A new aim: switch off and start travelling. A new aim while already travelling keeps it dark and restarts the trip.
      if (travelled >= CINEMA2_AFTERHOURS_RE_AIM_MIN_TRAVEL) travelLeft = cinema2AfterhoursMoveDurationSec(travelled)
      next.set(key, { commanded: target, travelLeft })
      if (travelLeft <= 0) lit.push(beam)
    }

    this.states = next
    return Object.freeze(lit)
  }
}
