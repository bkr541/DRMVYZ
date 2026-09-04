// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutLabMockup } from '../../LayoutLabMockup'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<LayoutLabMockup />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const allButtons = () => [...container.querySelectorAll<HTMLButtonElement>('button')]
const buttonByText = (text: string) => {
  const b = allButtons().find(x => x.textContent?.trim() === text)
  if (!b) throw new Error(`No button "${text}"`)
  return b
}
const buttonContaining = (text: string) => {
  const b = allButtons().find(x => x.textContent?.includes(text))
  if (!b) throw new Error(`No button containing "${text}"`)
  return b
}

async function selectCanvasReact() {
  const trigger = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
  if (!trigger) throw new Error('No engine dropdown')
  await act(async () => trigger.click())
  const opt = [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(o => o.textContent?.includes('CANVAS'))
  if (!opt) throw new Error('No CANVAS option')
  await act(async () => opt.click())
  await act(async () => buttonByText('REACT').click())
}

async function pickOption(trigger: HTMLElement, label: string) {
  await act(async () => trigger.click())
  const opts = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
  const opt = opts.find(o => o.textContent?.trim() === label)
  if (!opt) throw new Error(`Option "${label}" not found among: ${opts.map(o => o.textContent?.trim()).join(' | ')}`)
  await act(async () => opt.click())
}

/** The collapsible section element for a concept, once its header is expanded. */
function conceptSection(noteFragment: string): HTMLElement {
  const note = [...container.querySelectorAll<HTMLElement>('.rv-canvas-engine-note')]
    .find(n => n.textContent?.includes(noteFragment))
  if (!note) throw new Error(`Concept note "${noteFragment}" not visible — is the group expanded?`)
  // Walk up to the collapsible body that also holds the layer group markup.
  let el: HTMLElement | null = note
  while (el && !el.querySelector('.rv-canvas-layer-effects-group')) el = el.parentElement
  if (!el) throw new Error(`No layer group under concept "${noteFragment}"`)
  return el
}

async function exerciseConcept(opts: {
  headerText: string
  noteFragment: string
  openTrigger: (section: HTMLElement) => HTMLElement
}) {
  await act(async () => buttonContaining(opts.headerText).click())
  const section = conceptSection(opts.noteFragment)

  // Add an effect so a route row exists.
  const addEffect = [...section.querySelectorAll<HTMLElement>('[role="combobox"]')]
    .find(c => (c.getAttribute('aria-label') || '').startsWith('Add effect'))
  if (!addEffect) throw new Error(`${opts.headerText}: no "Add effect" combobox`)
  await pickOption(addEffect, 'Bloom')

  // The concept's route trigger is now present and clickable.
  const trigger = opts.openTrigger(section)
  await act(async () => trigger.click())

  // The shared route editor opened.
  const editor = section.querySelector('.rv-ae-route-editor')
  expect(editor, `${opts.headerText}: route editor should open`).not.toBeNull()

  // Add two Audio Intelligence parameters.
  const paramCombo = () => [...section.querySelectorAll<HTMLElement>('[role="combobox"]')]
    .find(c => {
      const l = c.getAttribute('aria-label') || ''
      return l === 'Audio Intelligence Parameter' || l === 'Add another parameter'
    })
  const first = paramCombo()
  if (!first) throw new Error(`${opts.headerText}: no parameter combobox`)
  await pickOption(first, 'Kick')
  const second = paramCombo()
  if (!second) throw new Error(`${opts.headerText}: parameter combobox gone after first add`)
  await pickOption(second, 'Snare')

  // Two routed parameters, each with its own intensity slider.
  expect(section.querySelectorAll('.rv-ae-route-param').length, `${opts.headerText}: two routed params`).toBe(2)
  expect(section.querySelectorAll('.dv-bubble-slider').length, `${opts.headerText}: two intensity sliders`).toBe(2)
}

describe('Canvas Add Effects — alternate concept mock-ups', () => {
  it('Blueprint Bus routes multiple parameters with intensity sliders', async () => {
    await selectCanvasReact()
    await exerciseConcept({
      headerText: 'Blueprint Bus',
      noteFragment: 'indented under the Active Media dropdown',
      openTrigger: s => {
        const n = s.querySelector<HTMLButtonElement>('.rv-ae-bus-node')
        if (!n) throw new Error('no .rv-ae-bus-node')
        return n
      },
    })
  })

  it('Preview Deck routes multiple parameters with intensity sliders', async () => {
    await selectCanvasReact()
    await exerciseConcept({
      headerText: 'Preview Deck',
      noteFragment: 'footer action bar',
      openTrigger: s => {
        const n = s.querySelector<HTMLButtonElement>('.rv-ae-deck-bar')
        if (!n) throw new Error('no .rv-ae-deck-bar')
        return n
      },
    })
  })

  const roundTwo: Array<{ headerText: string; noteFragment: string; toggle: string }> = [
    { headerText: 'Nested Trays', noteFragment: 'three nested trays', toggle: '.rv-ae-tray-toggle' },
    { headerText: 'Tier Chips', noteFragment: 'fixed-width tier chip', toggle: '.rv-ae-chip-toggle' },
    { headerText: 'Trunk Line', noteFragment: 'every trunk is a real container edge', toggle: '.rv-ae-trunk-toggle' },
    { headerText: 'Spine & Dots', noteFragment: 'One spine spans the full group height', toggle: '.rv-ae-spine-toggle' },
    { headerText: 'Numbered Steps', noteFragment: 'left gutter numbers each effect', toggle: '.rv-ae-steps-toggle' },
  ]

  for (const concept of roundTwo) {
    it(`${concept.headerText} routes multiple parameters with intensity sliders`, async () => {
      await selectCanvasReact()
      await exerciseConcept({
        headerText: concept.headerText,
        noteFragment: concept.noteFragment,
        openTrigger: s => {
          const n = s.querySelector<HTMLButtonElement>(concept.toggle)
          if (!n) throw new Error(`no ${concept.toggle}`)
          return n
        },
      })
    })
  }

})
