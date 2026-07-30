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

  it('keeps every toggle family visibly active after generic theme controls are applied', () => {
    const genericControls = appearanceCss.indexOf('/* Standard controls */')
    const booleanControls = appearanceCss.indexOf('/* Boolean controls need a stronger state rule')

    expect(genericControls).toBeGreaterThanOrEqual(0)
    expect(booleanControls).toBeGreaterThan(genericControls)

    for (const selector of [
      ".rv-ctrl-toggle:is(.rv-ctrl-toggle--on, [aria-pressed='true'], [data-state='on'])",
      ".vz-param-toggle:is(.vz-param-toggle--on, [aria-pressed='true'])",
      ".vz-layer-toggle:is(.vz-layer-toggle--on, [aria-pressed='true'])",
      ".rv-stage-focus-btn:is(.is-active, [aria-pressed='true'])",
      ".rv-reset-btn[aria-pressed='true']",
      ".rv-glyph-upload-btn:is(.rv-glyph-upload-btn--active, [aria-pressed='true'])",
      "button[role='switch'][aria-checked='true']",
      '.lmv-toggle-track--on',
      '.vz-sync-track--on',
      '.vz-mod-reactivity-track--on',
      ".vz-ml-insp-toggle-input:checked + .vz-ml-insp-toggle-track",
    ]) {
      expect(appearanceCss, selector).toContain(selector)
    }

    expect(appearanceCss).toContain('background-color: rgba(var(--color-primary-rgb), 0.22)')
    expect(appearanceCss).toContain('accent-color: var(--color-primary)')
  })
})
