import {
  CINEMA2_AFTERHOURS_TRIGGER_IDS,
  type Cinema2AfterhoursTriggerId,
} from '../Cinema2AfterhoursNativeModule'
export const CINEMA2_CATHEDRAL_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS
export type Cinema2CathedralTriggerId = Cinema2AfterhoursTriggerId
export const CINEMA2_CATHEDRAL_PROGRAMS = Object.freeze([
  'cathedralRun',
  'aisleChase',
  'alternatingRibs',
  'vaultReveal',
  'rupture',
] as const)
export type Cinema2CathedralProgram = typeof CINEMA2_CATHEDRAL_PROGRAMS[number]

export interface Cinema2CathedralProgramSelection {
  readonly activeProgram: Cinema2CathedralProgram
  readonly changed: boolean
}

export function createCinema2CathedralProgramCycle(sample: (index: number) => number): readonly Cinema2CathedralProgram[] {
  const cycle = [...CINEMA2_CATHEDRAL_PROGRAMS]
  let sampleIndex = 0
  for (let index = cycle.length - 1; index > 0; index -= 1) {
    const unit = Math.min(0.999999, Math.max(0, sample(sampleIndex)))
    sampleIndex += 1
    const swap = Math.floor(unit * (index + 1))
    ;[cycle[index], cycle[swap]] = [cycle[swap]!, cycle[index]!]
  }
  return Object.freeze(cycle)
}

export function nextCinema2CathedralProgram(
  cycle: readonly Cinema2CathedralProgram[],
  current: Cinema2CathedralProgram,
): Cinema2CathedralProgram {
  if (cycle.length < 2) return current
  const index = cycle.indexOf(current)
  const next = cycle[(index < 0 ? 0 : index + 1) % cycle.length]
  return next === current ? cycle[(index + 2) % cycle.length] ?? 'cathedralRun' : next ?? 'cathedralRun'
}

/** Runtime-only automation. The user's authored Light Program is never overwritten. */
export class Cinema2CathedralProgramController {
  private activeProgram: Cinema2CathedralProgram
  private authoredProgram: Cinema2CathedralProgram | null = null
  private patternChange: boolean | null = null
  private trigger: Cinema2CathedralTriggerId | null = null
  private lastTriggerEventId: string | null = null

  constructor(
    private readonly cycle: readonly Cinema2CathedralProgram[],
    initialProgram: Cinema2CathedralProgram = 'cathedralRun',
  ) {
    this.activeProgram = initialProgram
  }

  update(input: Readonly<{
    authoredProgram: Cinema2CathedralProgram
    patternChange: boolean
    trigger: Cinema2CathedralTriggerId
    triggerEventId: string | null
    reset?: boolean
  }>): Readonly<Cinema2CathedralProgramSelection> {
    const authoredChanged = this.authoredProgram != null && input.authoredProgram !== this.authoredProgram
    const toggled = this.patternChange != null && input.patternChange !== this.patternChange
    const triggerChanged = this.trigger != null && input.trigger !== this.trigger
    let changed = false

    if (input.reset || authoredChanged || toggled || this.authoredProgram == null) {
      changed = this.activeProgram !== input.authoredProgram || authoredChanged || toggled
      this.activeProgram = input.authoredProgram
      this.lastTriggerEventId = input.triggerEventId
    } else if (triggerChanged) {
      this.lastTriggerEventId = input.triggerEventId
    } else if (!input.patternChange) {
      if (this.activeProgram !== input.authoredProgram) {
        this.activeProgram = input.authoredProgram
        changed = true
      }
      this.lastTriggerEventId = input.triggerEventId
    } else if (input.triggerEventId && input.triggerEventId !== this.lastTriggerEventId) {
      this.activeProgram = nextCinema2CathedralProgram(this.cycle, this.activeProgram)
      this.lastTriggerEventId = input.triggerEventId
      changed = true
    }

    this.authoredProgram = input.authoredProgram
    this.patternChange = input.patternChange
    this.trigger = input.trigger
    return Object.freeze({ activeProgram: this.activeProgram, changed })
  }

  reset(): void {
    this.authoredProgram = null
    this.patternChange = null
    this.trigger = null
    this.lastTriggerEventId = null
  }
}
