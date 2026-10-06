// One-shot actions from the Design tab (Capture Pose, Clear Ghosts, Relearn Background). A press is not a
// setting, so it is never saved: the panel bumps a counter and the running processor notices the change.

const counters = new Map<string, number>()

export type HeadlinerTriggerId = 'capture-pose' | 'clear-ghosts' | 'relearn-background'

export function fireHeadlinerTrigger(id: HeadlinerTriggerId): void {
  counters.set(id, (counters.get(id) ?? 0) + 1)
}

export function readHeadlinerTrigger(id: HeadlinerTriggerId): number {
  return counters.get(id) ?? 0
}

/** Reports each press exactly once, starting from presses that happen after it was created. */
export class HeadlinerTriggerReader {
  private seen = new Map<HeadlinerTriggerId, number>()

  /** True once for every press of `id` since the last call. */
  take(id: HeadlinerTriggerId): boolean {
    const current = readHeadlinerTrigger(id)
    const previous = this.seen.get(id) ?? current
    this.seen.set(id, current)
    return current !== previous
  }
}
