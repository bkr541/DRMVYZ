// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HEADER_ROW_CONCEPTS, HEADER_ROW_METRICS, STACKED_HEADER_ROW_CONCEPTS, TemplateHeaderRowMockups } from '../TemplateHeaderRowMockups'

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
    expect(rows).toHaveLength(21)
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

  it('shows ten more concepts that stack elements in columns, each with all seven elements', () => {
    const stacked = [...container.querySelectorAll<HTMLElement>('[data-header-stacked-concept]')]
    expect(stacked).toHaveLength(10)
    expect(stacked.map(node => node.getAttribute('data-header-stacked-concept'))).toEqual(STACKED_HEADER_ROW_CONCEPTS.map(concept => concept.id))
    const layouts = new Set<string>()
    for (const concept of stacked) {
      const metrics = [...concept.querySelectorAll('.llhr-cluster [data-header-metric]')].map(node => node.getAttribute('data-header-metric')).sort()
      expect(metrics).toEqual([...HEADER_ROW_METRICS].sort())
      const columns = [...concept.querySelectorAll<HTMLElement>('.llhr-stack')]
      expect(columns.length).toBeGreaterThanOrEqual(2)
      for (const column of columns) {
        const count = column.querySelectorAll(':scope > [data-header-metric]').length
        expect(count).toBeGreaterThanOrEqual(2)
        expect(count).toBeLessThanOrEqual(3)
        expect(column.getAttribute('data-stack-count')).toBe(String(count))
      }
      layouts.add(columns.map(column => column.getAttribute('data-header-stack')).join('|'))
      expect(concept.querySelector('.vz-header')?.classList.contains('llhr-row')).toBe(true)
    }
    // The studies differ in how they group elements, not only in how they are styled.
    expect(layouts.size).toBeGreaterThanOrEqual(5)
  })

  it('draws Layered Cards with production Loading over Saved, FPS over Frame Time, and Quality over CPU', () => {
    const concept = container.querySelector<HTMLElement>('[data-header-stacked-concept="layered-cards"]')!
    const stacks = [...concept.querySelectorAll<HTMLElement>('.llhr-stack')]
    expect(stacks.map(stack => stack.getAttribute('data-header-stack'))).toEqual(['loading+saved', 'fps+frame-time', 'quality+cpu'])
    // Loading sits on top of Saved, and is still the production chip.
    const [loadingStack] = stacks
    expect([...loadingStack!.children].map(node => node.getAttribute('data-header-metric'))).toEqual(['loading', 'saved'])
    const loading = concept.querySelector('[data-header-metric="loading"]')!
    expect(loading.classList.contains('vz-header-activity')).toBe(true)
    expect(loading.querySelector('.vz-header-state-label')?.textContent).toBe('Loading')
    // Notifications stays a single production chip at the end of the cluster.
    const notifications = concept.querySelector('[data-header-metric="notifications"]')!
    expect(notifications.classList.contains('vz-header-notifications')).toBe(true)
    expect(notifications.closest('.llhr-stack')).toBeNull()
    expect(notifications.nextElementSibling).toBeNull()
    expect(notifications.querySelector('.vz-header-state-label')?.textContent).toBe('Notifications')
    // Same markup as the production reference row.
    const reference = container.querySelector('[data-header-reference="production"]')!
    expect(loading.className).toBe(reference.querySelector('[data-header-metric="loading"]')?.className)
    expect(notifications.className).toBe(reference.querySelector('[data-header-metric="notifications"]')?.className)
  })

  it('strips the Layered Cards columns of border and background, hides the Saved dot, and aligns the values', () => {
    const css = readFileSync(resolve(__dirname, '../../../../../styles/reactView.css'), 'utf8')
    expect(css).toMatch(/\.llhr-row--layered-cards \.llhr-stack > \.llhr-chip \{[^}]*border: 0;[^}]*background: none;[^}]*box-shadow: none;/)
    expect(css).toMatch(/\.llhr-row--layered-cards \.llhr-dot \{ display: none; \}/)
    expect(css).toContain(".llhr-row--layered-cards .llhr-stack[data-header-stack='fps+frame-time']")
    expect(css).toContain(".llhr-row--layered-cards .llhr-stack[data-header-stack='quality+cpu']")
    const layered = css.slice(css.indexOf('/* 16 · Layered Cards'), css.indexOf('/* 17 · Neon Edge Stack'))
    expect(layered).not.toMatch(/margin-left:\s*\d/)
  })

  it('never gives a stacked column or its cluster a border, background, shadow or outline', () => {
    const css = readFileSync(resolve(__dirname, '../../../../../styles/reactView.css'), 'utf8')
    const groupRules = [...css.matchAll(/(^|\n)([^{}\n]*\.llhr-(?:stack|cluster--stacked)(?![\w-]|\s+[>.\w])[^{}\n]*)\{([^}]*)\}/g)]
    expect(groupRules.length).toBeGreaterThan(0)
    for (const [, , selector, body] of groupRules) {
      expect(body, selector).not.toMatch(/(^|[;\s])(background[a-z-]*|border[a-z-]*|box-shadow|outline[a-z-]*|filter|backdrop-filter)\s*:/)
    }
  })

  it('gives each concept its own style block', () => {
    const css = readFileSync(resolve(__dirname, '../../../../../styles/reactView.css'), 'utf8')
    for (const concept of HEADER_ROW_CONCEPTS) expect(css, concept.id).toContain(`.llhr-row--${concept.id} .llhr-chip`)
    for (const concept of STACKED_HEADER_ROW_CONCEPTS) expect(css, concept.id).toContain(`.llhr-row--${concept.id} .llhr-chip`)
  })
})
