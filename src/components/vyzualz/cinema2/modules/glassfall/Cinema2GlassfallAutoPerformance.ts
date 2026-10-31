import type { GlassfallPattern } from './Cinema2GlassfallMotion'
export interface GlassfallAutoInput {
  base: GlassfallPattern; editRevision: number; enabled: boolean; playing: boolean; reset: boolean
  time: number; buildId: string | null; dropId: string | null
}
/** Only temporary pattern substitution is auto-owned. The base controller keeps
 * progressing independently and no authored parameter is ever mutated. */
export class GlassfallAutoPerformance {
  private revision: number | null = null
  private enabled: boolean | null = null
  private build: string | null = null
  private drop: string | null = null
  private override: { pattern: GlassfallPattern; kind: 'build' | 'drop'; expires: number } | null = null
  update(input: GlassfallAutoInput): GlassfallPattern {
    if (input.reset) { this.revision = null; this.enabled = null; this.override = null; this.build = null; this.drop = null }
    const rebase = this.revision === null || input.editRevision !== this.revision || input.enabled !== this.enabled
    if (rebase || !input.enabled) this.override = null
    if (this.override && (input.time >= this.override.expires || (this.override.kind === 'build' && input.buildId === null))) this.override = null
    if (!rebase && input.enabled && input.playing) {
      if (input.dropId && input.dropId !== this.drop) this.override = { pattern: 'prismRelay', kind: 'drop', expires: input.time + 1.2 }
      else if (input.buildId && input.buildId !== this.build) this.override = { pattern: 'darkWindows', kind: 'build', expires: input.time + 4 }
    }
    if (input.buildId) this.build = input.buildId
    if (input.dropId) this.drop = input.dropId
    this.revision = input.editRevision; this.enabled = input.enabled
    return this.override?.pattern ?? input.base
  }
}
