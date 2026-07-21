// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SharedPerformanceDiagnosticsPanel } from './SharedPerformanceDiagnosticsPanel'
import {
  clearAllSharedPerformanceDiagnostics,
  publishSharedPerformanceDiagnostics,
} from './SharedPerformanceDiagnosticsStore'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  clearAllSharedPerformanceDiagnostics()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  clearAllSharedPerformanceDiagnostics()
})

describe('Shared Performance Living Ribbon diagnostics', () => {
  it('renders compact physical, capability, occurrence, quality, lock, and recovery state', () => {
    publishSharedPerformanceDiagnostics({
      engine: 'soundDrawing',
      active: true,
      performanceShow: 'Living Ribbon System',
      scene: 'lrs-drop-2',
      section: 'drop',
      sectionFamily: 'drop-family',
      sectionOccurrence: 2,
      dropOccurrence: 2,
      phraseIndex: 5,
      barWithinSection: 3,
      fourBarStage: 2,
      eightBarStage: 1,
      sixteenBarStage: 1,
      motifOrComposition: 'drop-evolution-2',
      activeLayers: ['living-primary'],
      activeEventEnvelopes: ['dropImpact'],
      recentActions: ['releaseBurst:drop-2'],
      continuousRoutes: ['bass → width', 'vocal → center'],
      upcomingSemanticMoment: null,
      lockedParameters: ['ribbonMovement', 'ribbonGlow'],
      fallbackState: 'Beat-grid fallback active',
      capabilityLimitations: ['Timed lyrics unavailable'],
      confidenceLimitations: [],
      resourceLimitDecisions: [],
      engineDetails: [
        { label: 'Ribbon Scene', value: 'lrs-drop-2' },
        { label: 'Physical Controls', value: 'drive .62, tension .54' },
        { label: 'Quality', value: 'High → Medium' },
        { label: 'Structure', value: '160:seed-42' },
        { label: 'Recovery', value: 'reset 1, finite 0' },
      ],
      runtimeIdentity: 'ribbon-runtime-2',
    })

    act(() => root.render(<SharedPerformanceDiagnosticsPanel engine="soundDrawing" />))
    const header = container.querySelector<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')
    act(() => header?.click())

    expect(container.textContent).toContain('Living Ribbon System')
    expect(container.textContent).toContain('lrs-drop-2')
    expect(container.textContent).toContain('Phrase6')
    expect(container.textContent).toContain('dropImpact')
    expect(container.textContent).toContain('ribbonMovement')
    expect(container.textContent).toContain('Timed lyrics unavailable')
    expect(container.textContent).toContain('High → Medium')
    expect(container.textContent).toContain('reset 1, finite 0')
  })
})
