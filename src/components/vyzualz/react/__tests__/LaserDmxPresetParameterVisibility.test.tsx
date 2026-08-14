// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { LaserDmxBeamInspector } from '../LaserDmxBeamInspector'
import { LaserDmxReactionGroupInspector } from '../LaserDmxReactionGroupInspector'
import { ReactModulationPanel } from '../ReactModulationPanel'

let container: HTMLDivElement
let root: Root

async function render(node: React.ReactNode): Promise<void> {
  await act(async () => root.render(node))
}

function labelInput(labelText: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')]
    .find(candidate => candidate.textContent === labelText) as HTMLLabelElement | undefined
  return label?.control instanceof HTMLInputElement ? label.control : null
}

function selectFirstBeam(): string {
  const store = useReactStore.getState()
  const beamId = store.laserDmxBeamMatrix.beams[0]?.id
  if (!beamId) throw new Error('Expected preset to contain at least one beam')
  store.setSelectedLaserDmxMatrixBeams([beamId])
  return beamId
}

function selectFirstGroup(): string {
  const store = useReactStore.getState()
  const groupId = store.laserDmxBeamMatrix.groups[0]?.id
  if (!groupId) throw new Error('Expected preset to contain at least one reaction group')
  store.selectLaserDmxReactionGroup(groupId)
  return groupId
}

describe('LaserDMX preset-aware parameter visibility', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useReactStore.getState().resetReactView()
    useReactStore.getState().setActiveReactEngineId('laserDmx')
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('derives Sequence Index visibility from the selected preset and removes stale controls on preset switches', async () => {
    const store = useReactStore.getState()

    store.applyLaserDmxBeamMatrixPreset('minimal-crossfire')
    selectFirstBeam()
    await render(<LaserDmxBeamInspector />)

    expect(container.textContent).not.toContain('Sequence Index')
    expect(container.textContent).toContain('Appearance')

    await act(async () => {
      useReactStore.getState().applyLaserDmxBeamMatrixPreset('bass-fan')
      selectFirstBeam()
    })
    expect(container.textContent).toContain('Sequence Index')

    await act(async () => {
      useReactStore.getState().applyLaserDmxBeamMatrixPreset('minimal-crossfire')
      selectFirstBeam()
    })
    expect(container.textContent).not.toContain('Sequence Index')
  })

  it('keeps a hidden Sequence Index value intact and restores its control when sequencing becomes supported', async () => {
    useReactStore.getState().applyLaserDmxBeamMatrixPreset('minimal-crossfire')
    const beamId = selectFirstBeam()
    const groupId = useReactStore.getState().laserDmxBeamMatrix.beams.find(beam => beam.id === beamId)?.groupId
    if (!groupId) throw new Error('Expected selected beam to belong to a group')

    useReactStore.getState().updateLaserDmxMatrixBeam(beamId, { sequenceIndex: 37 })
    await render(<LaserDmxBeamInspector />)
    expect(container.textContent).not.toContain('Sequence Index')
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.find(beam => beam.id === beamId)?.sequenceIndex).toBe(37)

    const group = useReactStore.getState().laserDmxBeamMatrix.groups.find(candidate => candidate.id === groupId)
    if (!group) throw new Error('Expected assigned group to exist')
    await act(async () => {
      useReactStore.getState().updateLaserDmxReactionGroup(groupId, {
        sequence: { ...group.sequence, enabled: true },
      })
    })

    expect(container.textContent).toContain('Sequence Index')
    expect(labelInput('Sequence Index')?.value).toBe('37')
  })

  it('shows only launch controls consumed by the selected launch mode and cooldown contract', async () => {
    useReactStore.getState().applyLaserDmxBeamMatrixPreset('minimal-crossfire')
    const groupId = selectFirstGroup()
    const base = useReactStore.getState().laserDmxBeamMatrix.groups.find(group => group.id === groupId)?.launch
    if (!base) throw new Error('Expected launch settings')

    useReactStore.getState().updateLaserDmxReactionGroup(groupId, { launch: { ...base, trigger: 'beat' } })
    await render(<LaserDmxReactionGroupInspector />)
    expect(container.textContent).not.toContain('Threshold')
    expect(container.textContent).toContain('Min Energy')
    expect(container.textContent).toContain('Cooldown Beats')

    await act(async () => {
      const launch = useReactStore.getState().laserDmxBeamMatrix.groups.find(group => group.id === groupId)!.launch
      useReactStore.getState().updateLaserDmxReactionGroup(groupId, { launch: { ...launch, trigger: 'kick' } })
    })
    expect(container.textContent).toContain('Threshold')

    await act(async () => {
      const launch = useReactStore.getState().laserDmxBeamMatrix.groups.find(group => group.id === groupId)!.launch
      useReactStore.getState().updateLaserDmxReactionGroup(groupId, {
        launch: { ...launch, trigger: 'downbeat', cooldownBars: 4 },
      })
    })
    expect(container.textContent).not.toContain('Threshold')
    expect(container.textContent).not.toContain('Cooldown Beats')
    expect(container.textContent).toContain('Min Energy')
  })

  it('hides trigger-route Curve and Smoothing while preserving them for continuous preset routes', async () => {
    const store = useReactStore.getState()

    store.applyLaserDmxBeamMatrixPreset('minimal-crossfire')
    await render(<ReactModulationPanel />)
    expect(container.textContent).not.toContain('Curve')
    expect(container.textContent).not.toContain('Smoothing')
    expect(container.textContent).toContain('Attack')
    expect(container.textContent).toContain('Release')

    await act(async () => {
      useReactStore.getState().applyLaserDmxBeamMatrixPreset('redline-bass-tunnel')
    })
    expect(container.textContent).toContain('Curve')
    expect(container.textContent).toContain('Smoothing')
  })

  it('keeps Retrigger hidden until an assigned group can actually launch the selected animated beam', async () => {
    useReactStore.getState().applyLaserDmxBeamMatrixPreset('bass-fan')
    const beamId = selectFirstBeam()
    const groupId = useReactStore.getState().laserDmxBeamMatrix.beams.find(beam => beam.id === beamId)?.groupId
    if (!groupId) throw new Error('Expected selected beam to belong to a group')

    await render(<LaserDmxBeamInspector />)
    const motionHeader = [...container.querySelectorAll<HTMLButtonElement>('.rv-ctrl-collapsible-hdr')]
      .find(button => button.textContent?.trim().startsWith('Motion'))
    if (!motionHeader) throw new Error('Expected Motion collapsible')
    await act(async () => motionHeader.click())
    expect(container.textContent).not.toContain('Retrigger')

    const group = useReactStore.getState().laserDmxBeamMatrix.groups.find(candidate => candidate.id === groupId)
    if (!group) throw new Error('Expected assigned group to exist')
    await act(async () => {
      useReactStore.getState().updateLaserDmxReactionGroup(groupId, {
        launch: { ...group.launch, trigger: 'kick' },
      })
    })
    expect(container.textContent).toContain('Retrigger')
  })
})
