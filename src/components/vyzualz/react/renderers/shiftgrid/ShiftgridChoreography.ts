import type { ShiftgridAudioFrame } from './ShiftgridAudioIntelligence'
import {
  CANVAS_SHIFTGRID_PATTERN_OPTIONS,
  type CanvasShiftgridPattern,
  type CanvasShiftgridTrigger,
} from './ShiftgridSettings'

function seededUnit(seed: number, index: number): number {
  const value = Math.sin(seed * 0.0001 + index * 91.731) * 43758.5453
  return value - Math.floor(value)
}

export function createShiftgridPatternCycle(seed: number): readonly CanvasShiftgridPattern[] {
  const cycle = CANVAS_SHIFTGRID_PATTERN_OPTIONS.map(option => option.value)
  for (let index = cycle.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(seededUnit(seed, index) * (index + 1))
    ;[cycle[index], cycle[swap]] = [cycle[swap]!, cycle[index]!]
  }
  return Object.freeze(cycle)
}

export function resolveShiftgridTriggerIdentity(frame: ShiftgridAudioFrame, trigger: CanvasShiftgridTrigger): string | null {
  if (trigger === 'drop') return frame.drop ? `drop:${frame.sectionIdentity}:${Math.floor(frame.absoluteBeat)}` : null
  if (trigger === 'section') return frame.sectionBoundary ? `section:${frame.sectionIdentity}` : null
  if (trigger === 'phrase') return frame.barBoundary ? `phrase:${frame.phraseIndex}` : null
  if (trigger === 'beat') return frame.beatBoundary ? `beat:${Math.floor(frame.absoluteBeat)}` : null
  if (trigger === 'beat2') return frame.beatBoundary && Math.floor(frame.absoluteBeat) % 2 === 0 ? `beat2:${Math.floor(frame.absoluteBeat / 2)}` : null
  if (trigger === 'beat4') return frame.beatBoundary && Math.floor(frame.absoluteBeat) % 4 === 0 ? `beat4:${Math.floor(frame.absoluteBeat / 4)}` : null
  if (trigger === 'bar') return frame.barBoundary ? `bar:${Math.floor(frame.absoluteBar)}` : null
  if (trigger === 'bar4') return frame.fourBarBoundary ? `bar4:${Math.floor(frame.absoluteBar / 4)}` : null
  return frame.eightBarBoundary ? `bar8:${Math.floor(frame.absoluteBar / 8)}` : null
}
