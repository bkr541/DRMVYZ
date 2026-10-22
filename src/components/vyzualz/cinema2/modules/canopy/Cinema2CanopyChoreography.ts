import {
  CANOPY_BASE_HANG,
  CANOPY_MIN_HANG,
  canopyHash,
  clampCanopy,
  clampCanopy01,
  type CanopyPatternId,
  type CanopyStructure,
} from './Cinema2CanopyDomain'
import type { CanopyLayout, CanopyRodState } from './Cinema2CanopyLayout'
import { evaluateCanopyPattern, type CanopyPatternSample } from './Cinema2CanopyPatterns'

/** What the user has authored (after the engine resolved their controls) and the solver reads every frame. */
export interface CanopyDesign {
  readonly masterIntensity: number
  readonly motionAmount: number
  readonly heightRange: number
  readonly symmetry: boolean
  readonly idleGlow: number
  readonly accentStrength: number
  readonly autoPerformance: boolean
  readonly structure: Readonly<CanopyStructure>
}

export interface CanopyDriveSignals {
  readonly sub: number
  readonly bass: number
  readonly mid: number
  readonly high: number
  readonly vocal: number
  readonly overall: number
  readonly build: number
}

export interface CanopyDriveImpulses {
  readonly kick: number
  readonly snare: number
  readonly downbeat: number
  readonly phrase: number
  readonly section: number
  readonly drop: number
}

/** The musical and timing state of one frame, produced by the orchestration and consumed here. */
export interface CanopyDrive {
  readonly pattern: CanopyPatternId
  /** Beats since the pattern took the stage, scaled by Motion Speed. */
  readonly phase: number
  /** The pattern being left, while it fades into `pattern`. */
  readonly previous: Readonly<{ pattern: CanopyPatternId; phase: number }> | null
  /** 0 (all previous) to 1 (all pattern). */
  readonly blend: number
  /** True while a track is playing. Otherwise the array stands in its rest shape and nothing reacts to music. */
  readonly musicActive: boolean
  /** Live energy that lifts the light between hits, 0..1. */
  readonly level: number
  readonly signals: Readonly<CanopyDriveSignals>
  readonly impulses: Readonly<CanopyDriveImpulses>
  /** Visual Director significance, 0..1 each. */
  readonly director: Readonly<{ impact: number; intensity: number }>
  /** A slow phase that only advances while time runs, for high-frequency shimmer. */
  readonly shimmerPhase: number
}

export const CANOPY_NEUTRAL_DRIVE: Readonly<CanopyDrive> = Object.freeze({
  pattern: 'waterfall', phase: 0, previous: null, blend: 1, musicActive: false, level: 0,
  signals: Object.freeze({ sub: 0, bass: 0, mid: 0, high: 0, vocal: 0, overall: 0, build: 0 }),
  impulses: Object.freeze({ kick: 0, snare: 0, downbeat: 0, phrase: 0, section: 0, drop: 0 }),
  director: Object.freeze({ impact: 0.5, intensity: 0.5 }),
  shimmerPhase: 0,
})

/** Most a lift can reach once pattern, audio and a drop are summed. 1 is the pattern's own travel; the release may borrow 30% more. */
const OFFSET_LIMIT = 1.3
/** Master Intensity is authored so that its default gives rods their authored light. */
const MASTER_REFERENCE = 0.78
const TAU = Math.PI * 2

const sampleA: CanopyPatternSample = { rest: 0, motion: 0, glow: 0 }
const sampleB: CanopyPatternSample = { rest: 0, motion: 0, glow: 0 }
const patternContext = { phase: 0, rows: 0, columns: 0, symmetry: true, skew: 0 }

/**
 * Turns one frame of drive into the height, light and accent of every rod. Pure and allocation-free per rod; the layout fixes who each rod
 * is, the design fixes how far it may travel, and the drive says what the music is doing.
 *
 * Authority (see docs/cinema2-canopy.md): Rows, Columns and spacing are not touched here. Motion Amount 0 stops every physical movement
 * (the formation still stands); Master Intensity 0 gives every rod zero emission; Height Range bounds all pattern travel; accents never
 * exceed Accent Strength.
 */
export function solveCanopyRods(layout: Readonly<CanopyLayout>, design: Readonly<CanopyDesign>, drive: Readonly<CanopyDrive>, out: CanopyRodState): void {
  const { rows, columns } = layout.structure
  const { signals, impulses } = drive
  const live = drive.musicActive
  const moving = design.motionAmount > 0
  const motion = design.motionAmount * (live ? 0.85 + 0.3 * clampCanopy01(signals.overall) : 1)
  const buildCompress = moving ? (design.autoPerformance ? 0.25 : 0.12) * clampCanopy01(signals.build) : 0
  const range = clampCanopy(design.heightRange, 0, 0.8) * (1 - buildCompress)
  // The Director scales hits by a little either way; Auto Performance lets a drop's release reach its full authored bound.
  const significance = 0.9 + 0.2 * clampCanopy01(drive.director.impact)
  const dropGain = (design.autoPerformance ? 1.3 : 1) * significance
  const a = clampCanopy01(design.accentStrength)
  const idle = clampCanopy(design.idleGlow, 0, 0.6)
  const master = Math.max(0, design.masterIntensity) / MASTER_REFERENCE
  const settle = 1 - 0.5 * clampCanopy01(impulses.section)
  const organize = moving ? 1 - 0.3 * clampCanopy01(signals.build) : 1
  const blend = clampCanopy01(drive.blend)
  const eased = blend * blend * (3 - 2 * blend)

  patternContext.rows = rows
  patternContext.columns = columns
  patternContext.symmetry = design.symmetry
  patternContext.skew = 0.45 * clampCanopy01(impulses.phrase)

  for (const fixture of layout.fixtures) {
    const i = fixture.index
    patternContext.phase = drive.phase
    evaluateCanopyPattern(drive.pattern, fixture, patternContext, sampleA)
    let rest = sampleA.rest
    let patternMotion = sampleA.motion
    let glow = sampleA.glow
    if (drive.previous && blend < 1) {
      patternContext.phase = drive.previous.phase
      evaluateCanopyPattern(drive.previous.pattern, fixture, patternContext, sampleB)
      rest = sampleB.rest + (rest - sampleB.rest) * eased
      patternMotion = sampleB.motion + (patternMotion - sampleB.motion) * eased
      glow = sampleB.glow + (glow - sampleB.glow) * eased
    }

    const fv = fixture.rowFromFront / Math.max(1, rows - 1)
    const parity = (fixture.row + fixture.column) % 2
    // Which rods each hit lands on. Kicks take every other row from the front; snares take the rows between them, the checker's half of each leading;
    // a downbeat takes the front row and the outer rim. Kick and snare never share a rod.
    const kickSet = fixture.rowFromFront % 2 === 0 ? 1 : 0
    const snareSet = fixture.rowFromFront % 2 === 1 ? (parity === 1 ? 1 : 0.6) : 0
    const downbeatSet = fixture.rowFromFront === 0 || fixture.radius > 0.8 ? 1 : 0

    let offset = rest + (moving ? motion * patternMotion * settle : 0)
    let lift = 0
    if (moving && live) {
      offset += 0.22 * signals.sub * (1 - fixture.radius) * (drive.pattern === 'crown' ? 1.4 : 1)
      offset += 0.3 * signals.bass * Math.cos(TAU * (drive.phase / 2 - fixture.rowFromFront / Math.max(1, rows)))
      offset += 0.2 * signals.mid * (fixture.column % 2 === 0 ? 1 : -1) * Math.sin(TAU * drive.phase / 4)
      offset += 0.85 * dropGain * impulses.drop * (1 - 0.3 * fv)
      lift = 0.25 * a * significance * Math.max(impulses.kick * kickSet, 0.72 * impulses.snare * snareSet, 1.1 * impulses.downbeat * downbeatSet)
    }
    offset = clampCanopy(offset * (live ? organize : 1), -OFFSET_LIMIT, OFFSET_LIMIT)
    out.hang[i] = clampCanopy(CANOPY_BASE_HANG + offset * range - lift, CANOPY_MIN_HANG, fixture.maxHang)

    let emission = idle + (live ? 0.3 * glow * (0.4 + 0.6 * drive.level) + 0.32 * drive.level : 0.1 * glow)
    let accent = 0
    if (live) {
      emission *= 1 + 0.18 * signals.bass
      emission *= 1 + 0.1 * signals.high * Math.sin(TAU * (drive.shimmerPhase + canopyHash(i, 5)))
      emission += 0.1 * signals.build
      const kick = a * significance * impulses.kick * kickSet
      const snare = a * significance * impulses.snare * snareSet
      const downbeat = a * significance * impulses.downbeat * downbeatSet
      emission += Math.max(0.6 * kick, 0.5 * snare, 0.7 * downbeat)
      accent = clampCanopy01((a > 0 ? 1 : 0) * significance * Math.max(0.8 * impulses.kick * kickSet, 0.9 * impulses.snare * snareSet, 0.7 * impulses.downbeat * downbeatSet) + 0.5 * impulses.drop * a)
      emission *= 1 + 0.35 * clampCanopy01(impulses.drop) * (design.autoPerformance ? 1 : 0.8) * Math.min(1, a * 1.8)
      if (fixture.bank === 1) emission = Math.max(idle, emission * (1 - 0.25 * clampCanopy01(signals.vocal)))
    }
    out.emission[i] = Math.min(3, emission * master)
    out.accent[i] = accent
  }
}
