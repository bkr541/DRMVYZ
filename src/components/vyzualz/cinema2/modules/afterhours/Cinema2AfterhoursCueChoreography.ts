/**
 * Production-style laser cues for Afterhours 2.0.
 *
 * A real laser show is not a set of beams that stay on and wave about. Fixtures are grouped, every fixture in a group runs the same cue, and
 * a cue is a short burst on the beat grid: dark, then fire for a beat or two, then dark again, with the groups taking turns. Between bursts a
 * group's beams jump to a new position while they are dark, so each burst appears somewhere new.
 *
 * Rules this module keeps:
 *  - Cues are locked to beats, on a period of 1, 2, 3 or 4 beats (never longer than one bar), so no laser is ever lit or dark for longer than
 *    a bar and none is lit all the time.
 *  - Beams that mirror each other (a symmetric pair) always belong to the same group and fire together.
 *  - Everything is a pure function of the beat position and an event identity (the scene key), so it is deterministic and replayable.
 *
 * The module owns no clock, renderer or audio analysis: the caller supplies the musical position in beats.
 */

export const CINEMA2_AFTERHOURS_CUE_SCENE_BEATS = 16
export const CINEMA2_AFTERHOURS_CUE_MAX_PERIOD_BEATS = 4

export type Cinema2AfterhoursCueSceneId = 'chase' | 'alternate' | 'stab' | 'roll' | 'barHits' | 'wash' | 'strobe'

export interface Cinema2AfterhoursCueBeam {
  readonly fixtureId: string
  readonly slot: number
  /** Beams sharing a unit key are one physical unit and never split across groups (a mirrored pair, or a lone fixture). */
  readonly unitKey: string
  /** -1 for the left of the stage, +1 for the right (mirrored sideways travel). */
  readonly side: -1 | 1
  readonly yawAuthorityDeg: number
  readonly pitchAuthorityDeg: number
  readonly topologyId: string
}

export interface Cinema2AfterhoursCueProgram {
  readonly group: number
  /** Beats between the start of one burst and the next. 1..4. */
  readonly period: number
  /** Beats a burst stays lit. Always below the period, so every group goes dark between bursts (except the strobe's shorter gap). */
  readonly on: number
  /** Beats after a scene start at which the group's first burst begins. */
  readonly offset: number
  /** Sweeps slowly across its aim while lit instead of holding still. */
  readonly sweep: boolean
}

export interface Cinema2AfterhoursCueScene {
  readonly id: Cinema2AfterhoursCueSceneId
  readonly groupCount: number
  readonly programs: readonly Cinema2AfterhoursCueProgram[]
}

export interface Cinema2AfterhoursCueInput {
  readonly beams: readonly Cinema2AfterhoursCueBeam[]
  /** Musical position in beats (monotonic while playing). */
  readonly beat: number
  /** Identity of the current scene block; a new key picks a new scene. */
  readonly sceneKey: string
  /** Run seed: same seed and inputs give the same show. */
  readonly seed: string
  /** 0..1 overall energy and 0..1 structural peak (drop). A peak switches to the unison strobe. */
  readonly intensity: number
  readonly peak: number
  /** 0..1.3 amount of aim change between and during bursts (0 = every burst fires at the beam's home position). */
  readonly motion: number
}

export interface Cinema2AfterhoursCueResult {
  /** 0..1 shutter: exactly 0 while the group is dark. */
  readonly gate: number
  /** World-space aim offset from the beam's home target. */
  readonly offsetX: number
  readonly offsetY: number
  readonly group: number
  readonly sceneId: Cinema2AfterhoursCueSceneId
}

/** A burst snaps on already half open (a laser shutter is instant) and reaches full brightness within this many beats. */
const ATTACK_BEATS = 0.04
const ATTACK_FLOOR = 0.5
const RELEASE_BEATS = 0.12
const PEAK_THRESHOLD = 0.72

function unitHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 15
  hash = Math.imul(hash, 2246822507)
  hash ^= hash >>> 13
  return ((hash >>> 0) % 1_000_003) / 1_000_003
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

/** The distinct units in stable slot order. */
function unitsOf(beams: readonly Cinema2AfterhoursCueBeam[]): string[] {
  const first = new Map<string, number>()
  for (const beam of beams) if (!first.has(beam.unitKey) || beam.slot < first.get(beam.unitKey)!) first.set(beam.unitKey, beam.slot)
  return [...first.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(entry => entry[0])
}

/** Chooses the scene for a block: how many groups and what each group's burst cycle is. Exported for tests. */
export function planCinema2AfterhoursCueScene(
  unitCount: number,
  sceneKey: string,
  seed: string,
  intensity: number,
  peak: number,
): Readonly<Cinema2AfterhoursCueScene> {
  const energy = clamp01(intensity)
  let id: Cinema2AfterhoursCueSceneId
  if (clamp01(peak) >= PEAK_THRESHOLD) {
    id = 'strobe'
  } else {
    const weights: readonly [Cinema2AfterhoursCueSceneId, number][] = [
      ['chase', 2],
      ['alternate', 2.2 - energy * 1.4],
      ['stab', 1.4],
      ['roll', 0.8 + energy * 2.2],
      ['barHits', 1],
      ['wash', 0.3 + (1 - energy) * 1.6],
    ]
    const total = weights.reduce((sum, entry) => sum + entry[1], 0)
    let pick = unitHash(`${seed}:${sceneKey}:scene`) * total
    id = weights[weights.length - 1]![0]
    for (const [candidate, weight] of weights) {
      if (pick < weight) { id = candidate; break }
      pick -= weight
    }
  }
  const wanted = 2 + Math.floor(unitHash(`${seed}:${sceneKey}:groups`) * 3)
  const groupCount = Math.max(1, Math.min(wanted, unitCount))
  const programs: Cinema2AfterhoursCueProgram[] = []
  for (let group = 0; group < groupCount; group += 1) {
    const odd = group % 2 === 1
    switch (id) {
      case 'chase':
        // Groups fire one after another, each lit for a beat, then wait for the others: a period of one beat per group, at most a bar.
        programs.push({ group, period: Math.min(CINEMA2_AFTERHOURS_CUE_MAX_PERIOD_BEATS, Math.max(2, groupCount)), on: 1, offset: group, sweep: odd })
        break
      case 'alternate':
        programs.push({ group, period: 2, on: 1, offset: group % 2, sweep: odd })
        break
      case 'stab':
        programs.push({ group, period: 2, on: 0.5, offset: 0, sweep: false })
        break
      case 'roll':
        programs.push({ group, period: 1, on: 0.5, offset: (group % 2) * 0.5, sweep: false })
        break
      case 'barHits':
        programs.push({ group, period: 4, on: 1.5, offset: group % 4, sweep: odd })
        break
      case 'wash':
        programs.push({ group, period: 4, on: 2, offset: (group % 2) * 2, sweep: odd })
        break
      case 'strobe':
      default:
        programs.push({ group, period: 1, on: 0.6, offset: 0, sweep: false })
        break
    }
  }
  return Object.freeze({ id, groupCount, programs: Object.freeze(programs) })
}

/** The shutter for one group at a musical position, and which burst (cycle number) it is in. */
export function evaluateCinema2AfterhoursCueGate(program: Readonly<Cinema2AfterhoursCueProgram>, beat: number): { gate: number; cycle: number; progress: number } {
  const local = (Number.isFinite(beat) ? beat : 0) - program.offset
  const cycle = Math.floor(local / program.period)
  const into = local - cycle * program.period
  if (into >= program.on) return { gate: 0, cycle, progress: 1 }
  const attack = ATTACK_FLOOR + (1 - ATTACK_FLOOR) * Math.min(1, into / ATTACK_BEATS)
  const release = Math.min(1, (program.on - into) / Math.min(RELEASE_BEATS, program.on))
  return { gate: Math.max(0, Math.min(attack, release)), cycle, progress: into / program.on }
}

/**
 * Evaluates every beam's shutter and aim offset. The result is keyed by fixture id. The scene changes when `sceneKey` changes;
 * within a scene each group repeats its burst cycle and moves to a new discrete position for every burst.
 */
export function evaluateCinema2AfterhoursCues(input: Readonly<Cinema2AfterhoursCueInput>): ReadonlyMap<string, Readonly<Cinema2AfterhoursCueResult>> {
  const result = new Map<string, Readonly<Cinema2AfterhoursCueResult>>()
  if (input.beams.length === 0) return result
  const units = unitsOf(input.beams)
  const scene = planCinema2AfterhoursCueScene(units.length, input.sceneKey, input.seed, input.intensity, input.peak)
  const groupOfUnit = new Map(units.map((unit, index) => [unit, index % scene.groupCount]))
  const motion = Math.max(0, Number.isFinite(input.motion) ? input.motion : 0)
  const gates = scene.programs.map(program => evaluateCinema2AfterhoursCueGate(program, input.beat))

  for (const beam of input.beams) {
    const group = groupOfUnit.get(beam.unitKey) ?? 0
    const program = scene.programs[group]!
    const state = gates[group]!
    let offsetX = 0
    let offsetY = 0
    if (motion > 1e-3) {
      // A new position for every burst, chosen while the group is dark; the pair's two sides mirror each other.
      const key = `${input.seed}:${input.sceneKey}:aim:${group}:${state.cycle}`
      const stepX = Math.round((unitHash(`${key}:x`) * 2 - 1) * 2) / 2
      const stepY = Math.round((unitHash(`${key}:y`) * 2 - 1) * 2) / 2
      const sweep = program.sweep ? (state.progress - 0.5) * 0.9 : 0
      const cross = beam.topologyId === 'crossCanopy' ? -1 : 1
      const yawSpan = (beam.yawAuthorityDeg / 34) * 2.35 * motion
      const pitchSpan = (beam.pitchAuthorityDeg / 24) * 1.2 * motion
      offsetX = cross * beam.side * (stepX + sweep) * yawSpan
      offsetY = (stepY * 0.6 + (program.sweep ? Math.sin(state.progress * Math.PI) * 0.25 : 0)) * pitchSpan
    }
    result.set(beam.fixtureId, Object.freeze({ gate: state.gate, offsetX, offsetY, group, sceneId: scene.id }))
  }
  return result
}
