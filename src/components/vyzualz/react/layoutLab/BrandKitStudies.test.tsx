// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrandKitStudies } from './BrandKitStudies'
import {
  BRAND_ASSETS, BRAND_CARD_SHADOW, BRAND_FIXED_COLORS, BRAND_FONT_LINK, BRAND_FONTS, BRAND_GRADIENT, BRAND_GRID, BRAND_THEMES, BRAND_TOKEN_GROUPS, BRAND_TYPE_ROLES,
  buildBrandCss, contrastGrade, contrastRatio, parseCssColor, toHex,
} from './brandKitModel'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
const render = async () => { await act(async () => root.render(<BrandKitStudies />)) }
const text = () => host.textContent ?? ''

describe('Brand Kit page', () => {
  it('shows the logo, wordmark, color tokens, fonts, type roles, shapes, textures, components and a website starter', async () => {
    await render()
    const page = host.querySelector('[data-brand-kit]')!
    expect([...page.querySelectorAll('section.ll-brand-section > header h2')].map(h => h.textContent)).toEqual(['Logo and wordmark', 'Color tokens', 'Typography', 'Shape and depth', 'Backgrounds, textures and effects', 'Components', 'For the website'])
    // Logo and wordmark, on their grounds, with the files to download.
    expect(page.querySelectorAll('img[src$="stageless_logo.png"]').length).toBeGreaterThanOrEqual(4)
    expect(page.querySelectorAll('img[src$="stageless_wordmark.png"]').length).toBeGreaterThanOrEqual(3)
    expect(page.querySelector('[data-avoid]')?.textContent).toContain('Avoid')
    expect([...page.querySelectorAll('a[download]')].map(a => a.getAttribute('download'))).toEqual(BRAND_ASSETS.map(item => item.file))
    // Every theme token has a swatch carrying its name and its value.
    for (const group of BRAND_TOKEN_GROUPS) for (const token of group.tokens) {
      const swatch = [...page.querySelectorAll('.ll-brand-swatch')].find(node => node.textContent?.includes(token.token))
      expect(swatch, token.token).toBeDefined()
    }
    for (const fixed of BRAND_FIXED_COLORS) expect(text()).toContain(fixed.value)
    // Both fonts, with a specimen, and every type role.
    for (const font of BRAND_FONTS) { expect(text()).toContain(font.family); expect(text()).toContain(font.token) }
    expect(page.querySelectorAll('.ll-brand-weights li')).toHaveLength(BRAND_FONTS.reduce((sum, font) => sum + font.weights.length, 0))
    expect([...page.querySelectorAll('.ll-brand-role')].map(role => role.getAttribute('data-role'))).toEqual(BRAND_TYPE_ROLES.map(role => role.id))
    // The shapes, textures and effects, and the controls and cards.
    expect(page.querySelectorAll('.ll-brand-ground')).toHaveLength(6)
    expect(page.querySelectorAll('.ll-brand-btn').length).toBeGreaterThanOrEqual(6)
    expect(page.querySelectorAll('.ll-brand-tabs .dv-underline-tab')).toHaveLength(3)
    expect(page.querySelectorAll('.ll-brand-notices li')).toHaveLength(4)
    expect(page.querySelectorAll('.ll-brand-cards .ll-brand-card')).toHaveLength(3)
    expect(page.querySelector('.ll-brand-site')?.getAttribute('data-theme')).toBe('dark')
    expect(page.querySelector('.ll-brand-code')?.textContent).toContain('--color-primary')
  })

  it('previews each theme, starting on the dark brand look, and only changes the theme (the logo gradient and fixed colors stay)', async () => {
    await render()
    const page = host.querySelector<HTMLElement>('[data-brand-kit]')!
    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    expect(radios.map(radio => radio.textContent)).toEqual(BRAND_THEMES.map(entry => entry.label))
    expect(page.getAttribute('data-theme')).toBe('dark'); expect(radios[0]!.getAttribute('aria-checked')).toBe('true')
    await act(async () => radios[1]!.click())
    expect(page.getAttribute('data-theme')).toBe('light'); expect(radios[1]!.getAttribute('aria-checked')).toBe('true'); expect(radios[0]!.getAttribute('aria-checked')).toBe('false')
    // The website mockup is always the dark brand look.
    expect(page.querySelector('.ll-brand-site')!.getAttribute('data-theme')).toBe('dark')
    await act(async () => radios[2]!.click()); expect(page.getAttribute('data-theme')).toBe('cdj')
  })

  it('copies a swatch value and the stylesheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await render()
    const primary = [...host.querySelectorAll<HTMLButtonElement>('.ll-brand-swatch')].find(node => node.textContent?.includes('--color-primary'))!
    await act(async () => primary.click())
    expect(writeText).toHaveBeenCalledWith('#4ac7db'); expect(primary.textContent).toContain('Copied')
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Copy stylesheet"]')!.click())
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('--color-primary: #4ac7db;'))
  })

  it('prints contrast for the text colors on the background', async () => {
    await render()
    const rows = [...host.querySelectorAll('.ll-brand-contrast-row')]
    expect(rows).toHaveLength(5)
    for (const row of rows) expect(row.textContent).toMatch(/\d+\.\d:1 · (AAA|AA|AA large|Fails)/)
  })
})

describe('Brand Kit helpers', () => {
  it('reads hex, rgb and rgba colors, and writes hex', () => {
    expect(parseCssColor('#4ac7db')).toEqual({ r: 74, g: 199, b: 219, a: 1 })
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseCssColor('rgba(154, 178, 188, 0.26)')).toEqual({ r: 154, g: 178, b: 188, a: .26 })
    expect(parseCssColor('rgb(8 127 156 / 50%)')).toEqual({ r: 8, g: 127, b: 156, a: .5 })
    expect(parseCssColor('var(--x)')).toBeNull()
    expect(toHex({ r: 74, g: 199, b: 219, a: 1 })).toBe('#4ac7db')
  })

  it('measures WCAG contrast, over translucency too', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
    expect(contrastRatio('not a color', '#000')).toBeNull()
    const body = contrastRatio('rgba(232, 238, 240, 0.88)', '#090d0f')!
    expect(body).toBeGreaterThan(12); expect(contrastGrade(body)).toBe('AAA')
    expect(contrastGrade(4.6)).toBe('AA'); expect(contrastGrade(3.2)).toBe('AA large'); expect(contrastGrade(2)).toBe('Fails')
  })

  it('writes the brand as a stylesheet a website can use', () => {
    const css = buildBrandCss({ '--color-primary': '#123456' })
    expect(css).toContain('--color-primary: #123456;'); expect(css).toContain('--color-background: #090d0f;')
    expect(css).toContain(BRAND_FONTS[0]!.stack); expect(css).toContain(BRAND_FONTS[1]!.stack); expect(css).toContain(BRAND_GRADIENT); expect(css).toContain(BRAND_FONT_LINK)
    expect(css.startsWith('/*')).toBe(true); expect(css.trimEnd().endsWith('}')).toBe(true)
  })
})

describe('Brand Kit stays true to the app', () => {
  const appearance = read('src/styles/appearance.css'), darkBlock = /:root,\s*\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(appearance)![1]!
  const declared = (block: string, token: string) => new RegExp(`${token.replace(/[-]/g, '\\-')}:\\s*([^;]+);`).exec(block)?.[1]?.trim()

  it('has the dark theme value of every color token, exactly as appearance.css declares it', () => {
    for (const group of BRAND_TOKEN_GROUPS) for (const token of group.tokens) expect(declared(darkBlock, token.token), token.token).toBe(token.fallback)
    // The three themes the page offers are the three the app defines.
    expect([...appearance.matchAll(/^\[data-theme='(\w+)'\]\s*\{/gm)].map(match => match[1])).toEqual(expect.arrayContaining(BRAND_THEMES.map(entry => entry.id).filter(id => id !== 'dark')))
  })

  it('quotes the fixed colors, grid, glow and gradient from the stylesheets they come from', () => {
    const files: Record<string, string> = { 'auth.css': read('src/styles/auth.css'), 'recordIndexStudies.css': read('src/components/vyzualz/react/layoutLab/recordIndexStudies.css'),
      'vyzualz.css': read('src/styles/vyzualz.css'), 'reactView.css': read('src/styles/reactView.css') }
    for (const fixed of BRAND_FIXED_COLORS) {
      const rgb = parseCssColor(fixed.value)!
      const source = files[fixed.source]!.toLowerCase()
      expect(source.includes(fixed.value.toLowerCase()) || source.includes(`${rgb.r}, ${rgb.g}, ${rgb.b}`), `${fixed.name} (${fixed.value}) in ${fixed.source}`).toBe(true)
    }
    const auth = files['auth.css']!
    expect(auth).toContain(`background-size: ${BRAND_GRID.size}px ${BRAND_GRID.size}px`); expect(auth).toContain('rgba(0, 229, 255, 0.018)')
    for (const part of BRAND_CARD_SHADOW.split(', ')) expect(auth, part).toContain(part.replace('0.07', '0.07'))
    expect(files['recordIndexStudies.css']).toContain('--ll-idx-brand-a: #00cfe1'); expect(files['recordIndexStudies.css']).toContain('--ll-idx-brand-b: #0090dc')
    expect(BRAND_GRADIENT).toBe('linear-gradient(135deg, #00cfe1, #0090dc)')
  })

  it('names the fonts and weights the app loads, and the type roles it defines', () => {
    const html = read('index.html'), styles = read('src/styles.css'), typography = read('src/styles/typography.css')
    expect(html).toContain('family=Space+Grotesk:wght@300..700'); expect(html).toContain('family=Manrope:wght@200..800'); expect(BRAND_FONT_LINK).toContain('family=Space+Grotesk:wght@300..700&family=Manrope:wght@200..800')
    expect(styles).toContain(`--font-ui:   ${BRAND_FONTS[0]!.stack.replace(/'/g, "'").replace(/, /g, ',')}`)
    expect(styles).toContain(`--font-mono: ${BRAND_FONTS[1]!.stack.replace(/, /g, ',')}`)
    expect(styles).toContain('Space Grotesk for UI, Manrope for secondary text')
    for (const role of BRAND_TYPE_ROLES) expect(typography, role.id).toContain(role.css)
    expect(styles).toContain('--radius-group: 6px')
  })

  it('lists the real logo files with their real sizes', () => {
    for (const item of BRAND_ASSETS) {
      const png = readFileSync(resolve(process.cwd(), 'public', item.file))
      expect(png.subarray(1, 4).toString()).toBe('PNG')
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], item.file).toEqual([item.width, item.height])
    }
  })
})
