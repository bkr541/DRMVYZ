import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./trackTimeline.css', import.meta.url), 'utf8')

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? ''
}

describe('Track Timeline analysis panel layout', () => {
  it('gives the bounded analysis body sole ownership of vertical scrolling', () => {
    expect(rule('.ttv-analysis-panel')).toContain('height: calc(')
    expect(rule('.ttv-analysis-panel-body')).toContain('flex: 1 1 auto')
    expect(rule('.ttv-analysis-panel-body')).toContain('overflow-y: auto')
    expect(rule('.ttv-analysis-panel-body > .vz-mi-panel')).toContain('overflow: visible')
  })
})
