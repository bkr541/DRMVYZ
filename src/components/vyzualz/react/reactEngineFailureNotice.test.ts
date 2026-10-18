import { beforeEach, describe, expect, it } from 'vitest'
import { useNotificationStore } from '../../../stores/notificationStore'
import { reportReactEngineFailure } from './reactEngineFailureNotice'
import { describeCanvasLayerRejection, type CanvasLayerAdmissionDecision } from './canvasLayerAdmission'

const cards = () => useNotificationStore.getState().events['react']
beforeEach(() => { useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, react: [] } }) })

describe('reportReactEngineFailure', () => {
  it('names the engine and the reason when the preview cannot be set up', () => {
    reportReactEngineFailure('laserDmx', 'setup-failed', new Error('WebGL2 is not available'))
    expect(cards()[0]).toMatchObject({ tone: 'error', title: 'LaserDMX could not start' })
    expect(cards()[0]!.message).toContain('WebGL2 is not available')
  })

  it('says the preview was stopped when rendering fails mid-run', () => {
    reportReactEngineFailure('oscilloscope', 'render-failed', 'bad shader')
    expect(cards()[0]).toMatchObject({ tone: 'error', title: expect.stringContaining('stopped rendering') })
    expect(cards()[0]!.message).toContain('Select the engine or preset again')
  })
})

describe('describeCanvasLayerRejection', () => {
  const decision = (patch: Partial<CanvasLayerAdmissionDecision>): CanvasLayerAdmissionDecision => ({
    eligible: false, candidateKind: 'png', verifiedTransparentPng: true, occupiedSlots: 1, requiredSlots: 1, hasCapacity: true, ...patch,
  })

  it('returns nothing for an allowed layer', () => {
    expect(describeCanvasLayerRejection(decision({ eligible: true }))).toBeNull()
  })
  it('explains unsupported media, opaque PNGs, unchecked PNGs and a full stack', () => {
    expect(describeCanvasLayerRejection(decision({ candidateKind: null }))).toContain('SVG files and transparent PNG')
    expect(describeCanvasLayerRejection(decision({ verifiedTransparentPng: false }))).toContain('no transparent pixels')
    expect(describeCanvasLayerRejection(decision({ verifiedTransparentPng: null }))).toContain('could not be checked')
    expect(describeCanvasLayerRejection(decision({ hasCapacity: false }))).toContain('layer limit')
  })
})
