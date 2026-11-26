/** Bounded, runtime-only trigger identity history. Null means no event, not a new event. */
export class Cinema2PatternEventLatch<TTrigger extends string> {
  private readonly last = new Map<TTrigger, string>()

  observe(trigger: TTrigger, event: string | null): boolean {
    if (!event || this.last.get(trigger) === event) return false
    this.last.set(trigger, event)
    return true
  }

  reset(): void { this.last.clear() }
}
