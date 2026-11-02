import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { resolvePsyloEvent } from './Cinema2PsyloAudio'

interface Input {
  frame: Readonly<Cinema2ModuleFrameReadContext>; base: number; enabled: boolean; manual: boolean
  reset: boolean; latch: boolean; beats: number; previousTime: number | null
}
/** Temporary presentation only. The independent Pattern controller always keeps
 * advancing the underlying base; expiry restores that current base. Camera,
 * controls, palette, population and feature permissions are never owned here. */
export class Cinema2PsyloAutoPerformance {
  private active: { kind: 'build' | 'drop'; key: string; endBeat: number; pattern: number } | null = null
  private buildKey: string | null = null
  private enabled: boolean | null = null
  private readonly seen = new Set<string>()
  update({ frame, base, enabled, manual, reset, latch, beats, previousTime }: Input) {
    const { audio, transport } = frame, paused = transport?.paused === true
    const d = audio && frame.director?.visualFrameId === audio.visualFrameId && frame.director.discontinuityGeneration === audio.discontinuity.generation ? frame.director : null
    const build = d?.context.build
    const building = build?.available && (build.confidence ?? 0) >= .45 && typeof build.value === 'number' && build.value >= (this.buildKey ? .42 : .56)
    const key = paused && !audio ? this.buildKey : building && audio ? JSON.stringify([audio.discontinuity.generation, audio.upstream.sourceId, audio.upstream.analysisRevision, d?.context.section.value?.id ?? null]) : null
    const newBuild = key != null && key !== this.buildKey
    const eventFrame = transport ? { ...frame, transport: { ...transport, paused: false, playing: true } } : frame
    const drop = resolvePsyloEvent(eventFrame, 'drop', reset ? null : previousTime)
    if (reset) this.seen.clear()
    const freshDrop = drop != null && !this.seen.has(drop)
    if (drop) this.seen.add(drop)
    while (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    const changed = enabled !== this.enabled, hadOverride = this.active != null
    this.enabled = enabled; this.buildKey = key
    const cancel = reset || manual || changed || !enabled || (!paused && (!audio || transport?.playing === false))
    if (cancel) this.active = null
    else if (!paused) {
      if (this.active && (beats >= this.active.endBeat || (this.active.kind === 'build' && key !== this.active.key))) this.active = null
      if (!latch && freshDrop) this.active = { kind: 'drop', key: drop!, endBeat: beats + 4, pattern: base === 7 ? 6 : 7 }
      else if (!latch && newBuild && this.active?.kind !== 'drop') this.active = { kind: 'build', key: key!, endBeat: beats + 8, pattern: base === 3 ? 1 : 3 }
    }
    return { pattern: this.active?.pattern ?? base, kind: this.active?.kind ?? null,
      immediate: manual || reset || ((cancel || !enabled) && hadOverride) }
  }
}
