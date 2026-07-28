import { describe, expect, it } from 'vitest'
import appearanceCss from '../../../styles/appearance.css?raw'

const REQUIRED_TOKENS = [
  '--color-background',
  '--color-panel',
  '--color-card',
  '--color-primary',
  '--color-secondary',
  '--color-accent',
  '--color-text',
  '--color-border',
]

describe('appearance CSS token contract', () => {
  for (const theme of ['dark', 'light', 'cdj'] as const) {
    it(`${theme} defines the canonical UI token set`, () => {
      const selector = theme === 'dark'
        ? /:root,\s*\n\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/
        : new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`)
      const block = appearanceCss.match(selector)?.[1] ?? ''
      expect(block).not.toBe('')
      for (const token of REQUIRED_TOKENS) expect(block, token).toContain(token)
    })
  }

  it('keeps CDJ authored blue control tokens intact', () => {
    expect(appearanceCss).toContain("[data-theme='cdj']")
    expect(appearanceCss).toContain('--color-primary: #168cff')
    expect(appearanceCss).toContain('--color-secondary: #38afff')
  })
})
