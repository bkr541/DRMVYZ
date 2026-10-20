// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HEADER_ROW_CONCEPTS, HEADER_ROW_METRICS, TemplateHeaderRowMockups } from '../TemplateHeaderRowMockups'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<TemplateHeaderRowMockups />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const concepts = () => [...container.querySelectorAll<HTMLElement>('[data-header-concept]')]

describe('React header row mockups', () => {
  it('shows ten uniquely named concepts', () => {
    expect(concepts()).toHaveLength(10)
    const ids = concepts().map(node => node.getAttribute('data-header-concept'))
    expect(new Set(ids).size).toBe(10)
    expect(ids).toEqual(HEADER_ROW_CONCEPTS.map(concept => concept.id))
  })

  it('puts Saved, FPS, Frame Time, Quality, CPU, Loading and Notifications in every row, in the production order', () => {
    for (const concept of concepts()) {
      const metrics = [...concept.querySelectorAll('.llhr-cluster [data-header-metric]')].map(node => node.getAttribute('data-header-metric'))
      expect(metrics).toEqual([...HEADER_ROW_METRICS])
      expect(concept.querySelector('[data-header-metric="notifications"]')?.tagName).toBe('BUTTON')
      expect(concept.querySelector('[data-header-metric="fps"] .llhr-value')?.textContent).toBe('67')
      expect(concept.querySelector('[data-header-metric="frame-time"] .llhr-value')?.textContent).toBe('15.0 ms')
      expect(concept.querySelector('[data-header-metric="loading"] svg')).not.toBeNull()
    }
  })

  it('builds every row on the production header rule, with a production reference row to compare against', () => {
    const rows = [...container.querySelectorAll<HTMLElement>('.llhr-row')]
    expect(rows).toHaveLength(11)
    for (const row of rows) {
      expect(row.classList.contains('vz-header')).toBe(true)
      expect(row.getAttribute('style')).toBeNull()
    }
    expect(container.querySelector('[data-header-reference="production"] .vz-header')).not.toBeNull()
  })

  it('never gives a row its own height, padding or border, so each keeps the production header height', () => {
    const css = readFileSync(resolve(__dirname, '../../../../../styles/reactView.css'), 'utf8')
    const rowRules = [...css.matchAll(/(^|\n)([^{}\n]*\.llhr-row(?:--[a-z-]+)?)\s*\{([^}]*)\}/g)]
    expect(rowRules.length).toBeGreaterThan(0)
    for (const [, , selector, body] of rowRules) {
      expect(selector.trim().endsWith('.llhr-row') || /\.llhr-row--[a-z-]+$/.test(selector.trim())).toBe(true)
      expect(body, selector).not.toMatch(/(^|[;\s])(height|min-height|max-height|padding[a-z-]*|border[a-z-]*|box-sizing|margin[a-z-]*|line-height)\s*:/)
    }
    // And the rule they inherit is the 60px production one.
    const production = readFileSync(resolve(__dirname, '../../../../../styles/vyzualz.css'), 'utf8')
    expect(production).toMatch(/\.vz-header \{\s*height: 60px;/)
  })

  it('gives each concept its own style block', () => {
    const css = readFileSync(resolve(__dirname, '../../../../../styles/reactView.css'), 'utf8')
    for (const concept of HEADER_ROW_CONCEPTS) expect(css, concept.id).toContain(`.llhr-row--${concept.id} .llhr-chip`)
  })
})
