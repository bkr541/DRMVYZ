import { describe, expect, it } from 'vitest'

import {
  createDefaultCinema3DObjectDefinition,
  resolveCinemaWorld3DObjectCameraFocus,
  resolveCinemaWorld3DObjectPlacement,
  transformCinemaPoint,
  type CinemaBounds3D,
  type CinemaVector3,
} from '..'

const LOCAL_BOUNDS: Readonly<CinemaBounds3D> = Object.freeze({
  min: Object.freeze([-2, -1, -0.5] as const),
  max: Object.freeze([2, 1, 0.5] as const),
  size: Object.freeze([4, 2, 1] as const),
  center: Object.freeze([0, 0, 0] as const),
})

describe('Cinema world 3D object anchors', () => {
  it('composes anchor normalization with the persisted object transform and resolves world bounds', () => {
    const baseline = createDefaultCinema3DObjectDefinition()
    const definition = {
      ...baseline,
      geometry: { ...baseline.geometry, extrusionDepth: 0.4 },
      transform: {
        position: [0.5, -0.25, 0.2] as CinemaVector3,
        rotation: [0, 0, 0] as CinemaVector3,
        scale: [1, 2, 1] as CinemaVector3,
      },
    }
    const placement = resolveCinemaWorld3DObjectPlacement(definition, LOCAL_BOUNDS, {
      id: 'hero',
      transform: { position: [1, 2, -3] },
      normalization: { mode: 'fit-max-dimension', size: 2 },
      focusAnchor: [0.2, -0.2, 0.4],
      framingPadding: 1.35,
    })

    expect(placement.worldBounds.size[0]).toBeCloseTo(2, 6)
    expect(placement.worldBounds.size[1]).toBeCloseTo(2, 6)
    expect(placement.worldBounds.size[2]).toBeCloseTo(0.2, 6)
    expect(placement.worldBounds.center[0]).toBeCloseTo(1.25, 6)
    expect(placement.worldBounds.center[1]).toBeCloseTo(1.875, 6)
    expect(placement.worldBounds.center[2]).toBeCloseTo(-2.9, 6)
    expect(placement.focusAnchor[0]).toBeCloseTo(1.1, 6)
    expect(placement.focusAnchor[1]).toBeCloseTo(1.9, 6)
    expect(placement.focusAnchor[2]).toBeCloseTo(-2.8, 6)
    expect(placement.framingPadding).toBeCloseTo(1.35, 6)

    const objectOrigin = transformCinemaPoint(placement.modelMatrix, [0, 0, 0])
    expect(objectOrigin[0]).toBeCloseTo(1.25, 6)
    expect(objectOrigin[1]).toBeCloseTo(1.875, 6)
    expect(objectOrigin[2]).toBeCloseTo(-2.9, 6)
  })

  it('turns world bounds and a focus anchor into safe framing values for the existing camera runtime', () => {
    const focus = resolveCinemaWorld3DObjectCameraFocus(
      LOCAL_BOUNDS,
      60,
      1.25,
      [0.1, -0.2, -0.3],
    )

    expect(focus.target[0]).toBeCloseTo(0.1, 6)
    expect(focus.target[1]).toBeCloseTo(-0.2, 6)
    expect(focus.target[2]).toBeCloseTo(-0.3, 6)
    expect(focus.boundingRadius).toBeGreaterThan(2)
    expect(focus.framingDistance).toBeGreaterThan(focus.boundingRadius)
    expect(focus.suggestedNear).toBeGreaterThan(0)
    expect(focus.suggestedFar).toBeGreaterThan(focus.suggestedNear)
  })
})
