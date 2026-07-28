// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { PixGridControls } from '../PixGridControls'
import { PixGridDesignPanel } from '../PixGridDesignPanel'
import { PixGridGroupReactionPanel } from '../PixGridGroupReactionPanel'
import { PixGridReactivityWorkspace } from '../PixGridReactivityWorkspace'
import { createSilentPixGridAudioFrame } from '../PixGridAudioRouting'
import { createDefaultPixGridReactionAssignment } from '../PixGridGroups'
import { clearPixGridReactivityRuntimeStatus, publishPixGridAudioAnalysis } from '../PixGridReactivityStatus'
import type { PixGridUnifiedRuntimeDiagnostics } from '../PixGridUnifiedPerformanceRuntime'
import type { PixGridReactionAssignment } from '../PixGridTypes'

let root: Root
let host: HTMLDivElement

function selectByLabel(label: string): HTMLSelectElement {
  const element = [...host.querySelectorAll('label')].find(candidate => candidate.textContent === label)
  if (!element?.htmlFor) throw new Error(`Missing select label ${label}`)
  const select = document.getElementById(element.htmlFor)
  if (!(select instanceof HTMLSelectElement)) throw new Error(`Missing select for ${label}`)
  return select
}


function rangeByLabel(label: string): HTMLInputElement {
  const element = [...host.querySelectorAll('label')].find(candidate => candidate.textContent === label)
  if (!element?.htmlFor) throw new Error(`Missing range label ${label}`)
  const input = document.getElementById(element.htmlFor)
  if (!(input instanceof HTMLInputElement) || input.type !== 'range') throw new Error(`Missing range for ${label}`)
  return input
}

function changeRange(input: HTMLInputElement, value: string): void {
  act(() => {
    input.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dispatchEvent(new Event('pointerup', { bubbles: true }))
  })
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function clickButton(label: string): void {
  const button = [...host.querySelectorAll('button')].find(candidate => candidate.textContent === label)
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button ${label}`)
  act(() => button.click())
}

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('pixGrid')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  act(() => clearPixGridReactivityRuntimeStatus())
  host.remove()
})

describe('PixGrid duplicate control surfaces', () => {
  it('produces identical complete quality state and history from compact and design selectors', () => {
    act(() => root.render(<PixGridControls />))
    changeSelect(selectByLabel('Starting Quality'), 'draft')
    const compactState = useReactStore.getState().pixGridState
    const compactUndo = useReactStore.getState().pixGridUndoStack
    expect(compactState.qualityMode).toBe('adaptive')

    act(() => root.unmount())
    host.innerHTML = ''
    useReactStore.getState().resetReactView()
    useReactStore.getState().selectReactEngine('pixGrid')
    root = createRoot(host)
    act(() => root.render(<PixGridDesignPanel />))
    changeSelect(selectByLabel('Starting Quality'), 'draft')
    const designState = useReactStore.getState().pixGridState
    const designUndo = useReactStore.getState().pixGridUndoStack

    expect(designState).toEqual(compactState)
    expect(designUndo).toEqual(compactUndo)
  })

  it('produces identical presentation state and history from compact and design sliders', () => {
    act(() => root.render(<PixGridControls />))
    changeRange(rangeByLabel('Cell Gap'), '0.31')
    const compactState = useReactStore.getState().pixGridState
    const compactUndo = useReactStore.getState().pixGridUndoStack

    act(() => root.unmount())
    host.innerHTML = ''
    useReactStore.getState().resetReactView()
    useReactStore.getState().selectReactEngine('pixGrid')
    root = createRoot(host)
    act(() => root.render(<PixGridDesignPanel />))
    changeRange(rangeByLabel('Cell Gap'), '0.31')

    expect(useReactStore.getState().pixGridState).toEqual(compactState)
    expect(useReactStore.getState().pixGridUndoStack).toEqual(compactUndo)
    expect(compactUndo).toHaveLength(1)
  })

  it('derives compact and advanced performance status from the same runtime publication', () => {
    const runtime = {
      activeProgramId: 'bass-beacon',
      activeProgramName: 'Published Program',
      activeCueActions: ['published-cue'],
      manualOverrides: [],
      sectionName: 'Published Drop',
      sectionPhase: 'body',
      programBindingWarnings: ['Published binding warning'],
      activeSectionPlan: 'published-drop-plan',
      activeProgramMotif: 'published-motif',
      activeProgramRecruitment: 'published-recruitment',
      activeProgramEvolution: 'published-evolution',
      manualOverridePrecedence: 'program then cue then manual',
    } as unknown as PixGridUnifiedRuntimeDiagnostics
    act(() => publishPixGridAudioAnalysis(createSilentPixGridAudioFrame(), runtime))

    act(() => root.render(<PixGridControls />))
    expect(host.textContent).toContain('Published Program')
    expect(host.textContent).toContain('Owner: Track Map cue')
    expect(host.textContent).toContain('Published Drop · body')
    expect(host.textContent).toContain('Published binding warning')

    act(() => root.unmount())
    host.innerHTML = ''
    root = createRoot(host)
    act(() => root.render(<PixGridReactivityWorkspace surface="choreography" />))
    expect(host.textContent).toContain('published-drop-plan')
    expect(host.textContent).toContain('published-motif')
    expect(host.textContent).toContain('Published binding warning')
  })

  it('distinguishes broad and narrow program operations and exposes concise status accessibility', () => {
    act(() => root.render(<PixGridControls />))
    expect(selectByLabel('Load Program Preset')).toBeDefined()
    expect(host.querySelector('[role="status"][aria-label="PixGrid live performance summary"]')).not.toBeNull()
    expect(host.querySelector('[role="status"][aria-label="PixGrid requested and effective quality"]')).not.toBeNull()
    expect([...host.querySelectorAll('button')].some(button => button.textContent === 'Open Full Diagnostics')).toBe(true)
    expect(host.textContent).not.toContain('Arcs D/P/M/N')
    expect(host.textContent).not.toContain('Precedence:')
    expect(host.textContent).not.toContain('Cell Calibration')

    act(() => root.unmount())
    host.innerHTML = ''
    root = createRoot(host)
    act(() => root.render(<PixGridReactivityWorkspace surface="choreography" />))
    expect(selectByLabel('Change Performance Program Only')).toBeDefined()
  })

  it('preserves advanced route fields while compact and full editors share the same assignment', () => {
    const state = useReactStore.getState().pixGridState
    const group = state.groups[0]
    expect(group).toBeDefined()
    const assignment: PixGridReactionAssignment = {
      ...createDefaultPixGridReactionAssignment(0),
      id: 'wide-route',
      name: 'Wide Route',
      source: 'kick',
      amount: 3.25,
      priority: 900,
      cooldown: 1.75,
      attack: 0.123,
      inputRange: [-2, 3],
      outputRange: [-1, 2],
      conditions: { includeSectionTypes: ['drop'] },
    }
    useReactStore.getState().applyPixGridAuthoringState({
      ...state,
      groups: state.groups.map(candidate => candidate.id === group!.id ? { ...candidate, reactions: [assignment] } : candidate),
      editor: { ...state.editor, selectedGroupId: group!.id, previewReactionAssignmentId: assignment.id },
    })

    act(() => root.render(<PixGridGroupReactionPanel />))
    const compactAmount = rangeByLabel('Amount')
    expect(compactAmount.min).toBe('-4')
    expect(compactAmount.max).toBe('4')
    expect(host.textContent).toContain('advanced fields preserved')
    changeRange(compactAmount, '-3.5')

    const compactEdited = useReactStore.getState().pixGridState.groups
      .find(candidate => candidate.id === group!.id)?.reactions[0]
    expect(compactEdited).toMatchObject({
      amount: -3.5,
      priority: 900,
      cooldown: 1.75,
      attack: 0.123,
      inputRange: [-2, 3],
      outputRange: [-1, 2],
    })
    expect(compactEdited?.conditions?.includeSectionTypes).toEqual(['drop'])

    act(() => root.unmount())
    host.innerHTML = ''
    root = createRoot(host)
    act(() => root.render(<PixGridReactivityWorkspace surface="events" />))
    expect(rangeByLabel('Amount').valueAsNumber).toBeCloseTo(-3.5)
    expect(rangeByLabel('Priority').valueAsNumber).toBe(900)
    expect(rangeByLabel('Cooldown').valueAsNumber).toBeCloseTo(1.75)

    const fullEditorOpened = useReactStore.getState().pixGridState.groups
      .find(candidate => candidate.id === group!.id)?.reactions[0]
    expect(fullEditorOpened).toEqual(compactEdited)
  })

  it('makes compact and advanced Clear Override actions behaviorally identical', () => {
    const applyLockedState = () => {
      const state = useReactStore.getState().pixGridState
      useReactStore.getState().applyPixGridAuthoringState({
        ...state,
        performance: { ...state.performance, lockedRoutes: ['locked-route'] },
        layers: state.layers.map((layer, index) => index === 0 ? { ...layer, locked: true } : layer),
      })
    }

    applyLockedState()
    act(() => root.render(<PixGridControls />))
    clickButton('Clear Override')
    const compactState = useReactStore.getState().pixGridState
    const compactHistory = useReactStore.getState().pixGridUndoStack
    expect(compactState.performance.lockedRoutes).toEqual([])
    expect(compactState.layers.every(layer => !layer.locked)).toBe(true)

    act(() => root.unmount())
    host.innerHTML = ''
    useReactStore.getState().resetReactView()
    useReactStore.getState().selectReactEngine('pixGrid')
    applyLockedState()
    root = createRoot(host)
    act(() => root.render(<PixGridReactivityWorkspace surface="choreography" />))
    clickButton('Clear Override')

    expect(useReactStore.getState().pixGridState).toEqual(compactState)
    expect(useReactStore.getState().pixGridUndoStack).toEqual(compactHistory)
  })
})
