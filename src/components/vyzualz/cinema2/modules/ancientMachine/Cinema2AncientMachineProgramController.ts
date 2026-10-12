import { CINEMA2_AFTERHOURS_TRIGGER_IDS, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'

export const CINEMA2_ANCIENT_MACHINE_LOOKS = Object.freeze(['oracleLock', 'gearSun', 'epochEngine'] as const)
export type Cinema2AncientMachineLook = typeof CINEMA2_ANCIENT_MACHINE_LOOKS[number]
export const CINEMA2_ANCIENT_MACHINE_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS
export type Cinema2AncientMachineTriggerId = Cinema2AfterhoursTriggerId

export function createCinema2AncientMachineLookCycle(sample: (index: number) => number): readonly Cinema2AncientMachineLook[] {
  const cycle = [...CINEMA2_ANCIENT_MACHINE_LOOKS]
  for (let index = cycle.length - 1, sampleIndex = 0; index > 0; index -= 1, sampleIndex += 1) {
    const swap = Math.floor(Math.min(0.999999, Math.max(0, sample(sampleIndex))) * (index + 1))
    ;[cycle[index], cycle[swap]] = [cycle[swap]!, cycle[index]!]
  }
  return Object.freeze(cycle)
}

export class Cinema2AncientMachineProgramController {
  private activeLook: Cinema2AncientMachineLook
  private authoredLook: Cinema2AncientMachineLook | null = null
  private patternChange: boolean | null = null
  private trigger: Cinema2AncientMachineTriggerId | null = null
  private lastEvent: string | null = null

  constructor(private readonly cycle: readonly Cinema2AncientMachineLook[], initial: Cinema2AncientMachineLook = 'oracleLock') {
    this.activeLook = initial
  }

  update(input: Readonly<{ authoredLook: Cinema2AncientMachineLook; patternChange: boolean; trigger: Cinema2AncientMachineTriggerId; triggerEventId: string | null; reset?: boolean }>): Readonly<{ activeLook: Cinema2AncientMachineLook; changed: boolean }> {
    const authoredChanged = this.authoredLook != null && input.authoredLook !== this.authoredLook
    const toggled = this.patternChange != null && input.patternChange !== this.patternChange
    const triggerChanged = this.trigger != null && input.trigger !== this.trigger
    let changed = false
    if (input.reset || authoredChanged || toggled || this.authoredLook == null) {
      changed = this.activeLook !== input.authoredLook || authoredChanged || toggled
      this.activeLook = input.authoredLook
      this.lastEvent = input.triggerEventId
    } else if (triggerChanged) {
      this.lastEvent = input.triggerEventId
    } else if (!input.patternChange) {
      if (this.activeLook !== input.authoredLook) { this.activeLook = input.authoredLook; changed = true }
      this.lastEvent = input.triggerEventId
    } else if (input.triggerEventId && input.triggerEventId !== this.lastEvent) {
      const current = this.cycle.indexOf(this.activeLook)
      this.activeLook = this.cycle[(current < 0 ? 0 : current + 1) % this.cycle.length] ?? 'oracleLock'
      this.lastEvent = input.triggerEventId
      changed = true
    }
    this.authoredLook = input.authoredLook
    this.patternChange = input.patternChange
    this.trigger = input.trigger
    return Object.freeze({ activeLook: this.activeLook, changed })
  }

  reset(): void { this.authoredLook = null; this.patternChange = null; this.trigger = null; this.lastEvent = null }
}
