import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import type { NightshiftPattern } from './Cinema2NightshiftDomain'
import { resolveNightshiftPatternEvent } from './Cinema2NightshiftAudio'

interface PerformanceInput {
  frame: Readonly<Cinema2ModuleFrameReadContext>
  base: NightshiftPattern
  enabled: boolean
  manual: boolean
  reset: boolean
  beats: number
  previousTime: number | null
}
interface Override { kind: 'build' | 'drop'; key: string; endBeat: number }

/** Owns only temporary presentation. Shared Director meaning, canonical drop
 * identities and the module's shared clock supply all musical facts and timing. */
export class Cinema2NightshiftAutoPerformance {
  private active: Override | null = null
  private buildKey: string | null = null
  private enabled: boolean | null = null
  private readonly seenDrops = new Set<string>()

  update({ frame, base, enabled, manual, reset, beats, previousTime }: PerformanceInput) {
    const { audio, transport } = frame
    const candidate = frame.director
    const director = audio && candidate?.visualFrameId === audio.visualFrameId && candidate.discontinuityGeneration === audio.discontinuity.generation ? candidate : null
    const build = director?.context.build
    const building = build?.available && (build.confidence ?? 0) >= .45 && typeof build.value === 'number'
      && build.value >= (this.buildKey ? .42 : .56)
    const key = building && audio ? JSON.stringify([audio.discontinuity.generation, audio.upstream.sourceId,
      audio.upstream.analysisRevision, director?.context.section.value?.id ?? null]) : null
    const newBuild = key != null && key !== this.buildKey
    const paused = transport?.paused === true
    const held = paused || transport?.playing === false
    // Latch held drop identities too, without authorizing a performance change.
    const eventFrame = held && transport ? { ...frame, director, transport: { ...transport, playing: true, paused: false } } : { ...frame, director }
    const drop = resolveNightshiftPatternEvent(eventFrame, 'drop', reset ? null : previousTime)
    if (reset) this.seenDrops.clear()
    const newDrop = drop != null && !this.seenDrops.has(drop)
    if (drop) this.seenDrops.add(drop)
    while (this.seenDrops.size > 256) this.seenDrops.delete(this.seenDrops.values().next().value!)
    const changed = this.enabled !== enabled
    this.enabled = enabled; this.buildKey = key
    const hadOverride = this.active != null
    const cancel = reset || manual || changed || !enabled || !audio || (!paused && transport?.playing === false)
    if (cancel) this.active = null
    else if (!paused) {
      if (this.active && (beats >= this.active.endBeat || (this.active.kind === 'build' && this.active.key !== key))) this.active = null
      if (newDrop) this.active = { kind: 'drop', key: drop!, endBeat: beats + 4 }
      else if (newBuild && this.active?.kind !== 'drop') this.active = { kind: 'build', key: key!, endBeat: beats + 8 }
    }
    return {
      pattern: this.active?.kind === 'drop' ? 'full-house' as const : this.active?.kind === 'build' ? 'diagonal-relay' as const : base,
      kind: this.active?.kind ?? null,
      immediate: manual || reset || (changed && !enabled) || (cancel && hadOverride),
    }
  }
}
