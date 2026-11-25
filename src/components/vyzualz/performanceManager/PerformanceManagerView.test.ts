import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./PerformanceManagerView.tsx', import.meta.url), 'utf8')

describe('Performance Manager workspace tabs', () => {
  it('keeps the left Engine tab and both disabled placeholder slots without visible labels', () => {
    const leftTabs = source.match(/<RailTabs[^\n]*ariaLabel="Performance Manager library tabs"[^\n]*\/>/)?.[0]
    expect(leftTabs).toBeDefined()
    expect(leftTabs).toContain("{ id: 'engine', label: 'ENGINE' }")
    expect(leftTabs).toContain("{ id: 'placeholder-1', label: '', disabled: true }")
    expect(leftTabs).toContain("{ id: 'placeholder-2', label: '', disabled: true }")
  })
})
