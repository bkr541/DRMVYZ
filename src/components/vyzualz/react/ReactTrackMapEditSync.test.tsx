// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactTrackSection } from './ReactTypes'
import { EditSectionForm } from './ReactTrackMapStrip'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

const baseSection: ReactTrackSection = {
  id: 'section-1',
  label: 'Build',
  type: 'build',
  startSec: 10,
  endSec: 30,
  intensity: 0.5,
  source: 'user-edited-auto',
}

function renderSection(section: ReactTrackSection): void {
  if (!container) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  }
  act(() => {
    root?.render(
      <EditSectionForm
        section={section}
        durationSec={180}
        effectiveBpm={150}
        dragPreview={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
  })
}


function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  expect(setter).toBeTypeOf('function')
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function inputFor(label: string): HTMLInputElement | HTMLSelectElement {
  const labelElement = [...(container?.querySelectorAll('label') ?? [])]
    .find(candidate => candidate.textContent === label)
  const id = labelElement?.getAttribute('for')
  const input = id ? document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null : null
  expect(input, `input for ${label}`).not.toBeNull()
  return input!
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('Track Map edit-form synchronization', () => {
  it('resynchronizes all untouched fields when canonical values change under the same ID', () => {
    renderSection(baseSection)
    renderSection({
      ...baseSection,
      label: 'Restored Drop',
      type: 'drop',
      startSec: 24,
      endSec: 56,
      intensity: 0.9,
    })

    expect(inputFor('Type').value).toBe('drop')
    expect(inputFor('Label').value).toBe('Restored Drop')
    expect(Number(inputFor('Start (s)').value)).toBe(24)
    expect(Number(inputFor('End (s)').value)).toBe(56)
    expect(Number(inputFor('Intensity').value)).toBe(0.9)
  })

  it('preserves active user edits while syncing other canonical fields', () => {
    renderSection(baseSection)
    const label = inputFor('Label') as HTMLInputElement
    const start = inputFor('Start (s)') as HTMLInputElement

    act(() => {
      changeInput(label, 'My Custom Build')
      changeInput(start, '12')
    })

    renderSection({
      ...baseSection,
      label: 'External Label',
      type: 'drop',
      startSec: 20,
      endSec: 45,
      intensity: 0.8,
    })

    expect(inputFor('Label').value).toBe('My Custom Build')
    expect(Number(inputFor('Start (s)').value)).toBe(12)
    expect(inputFor('Type').value).toBe('drop')
    expect(Number(inputFor('End (s)').value)).toBe(45)
    expect(Number(inputFor('Intensity').value)).toBe(0.8)
  })
})
