/** Bounded, runtime-only trigger identity history. Null means no event, not a new event. */
const RECENT_IDENTITIES_PER_TRIGGER = 64

export class Cinema2PatternEventLatch<TTrigger extends string> {
  private readonly recent = new Map<TTrigger, Set<string>>()

  observe(trigger: TTrigger, event: string | null): boolean {
    if (!event) return false
    let identities = this.recent.get(trigger)
    if (!identities) {
      identities = new Set<string>()
      this.recent.set(trigger, identities)
    }
    if (identities.has(event)) return false
    identities.add(event)
    // Keep a bounded replay window, rather than only the immediately previous
    // event. Delayed A/B/A publications must not take back manual authority.
    if (identities.size > RECENT_IDENTITIES_PER_TRIGGER) {
      const oldest = identities.values().next()
      if (!oldest.done) identities.delete(oldest.value)
    }
    return true
  }

  reset(): void { this.recent.clear() }
}
