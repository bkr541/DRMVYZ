import { beforeEach, describe, expect, it } from 'vitest'
import {
  CINEMA_FOUNDATION_COLOR_A_PARAMETER_ID,
  CINEMA_FOUNDATION_COMPOSITION,
  CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  createCinemaFoundationPersistedState,
  useCinemaStore,
} from '../../cinema'
import {
  getCinemaLiveInstance,
  resetCinemaLiveOverrides,
  setCinemaLiveNodeOverride,
} from '../CinemaLiveOverrides'

describe('Cinema live Design overrides', () => {
  beforeEach(() => {
    useCinemaStore.getState().hydrateCinemaState(createCinemaFoundationPersistedState())
  })

  it('changes a built-in preset through an instance without mutating its base definition', () => {
    const baseBefore = JSON.stringify(CINEMA_FOUNDATION_COMPOSITION)
    const schema = CINEMA_FOUNDATION_GRADIENT_DEFINITION.parameters.find(parameter => parameter.id === CINEMA_FOUNDATION_COLOR_A_PARAMETER_ID)
    expect(schema).toBeTruthy()

    setCinemaLiveNodeOverride(CINEMA_FOUNDATION_COMPOSITION, CINEMA_FOUNDATION_COMPOSITION.nodes[0].id, schema!, [0.1, 0.2, 0.3, 1])

    const state = useCinemaStore.getState()
    const live = getCinemaLiveInstance(CINEMA_FOUNDATION_COMPOSITION.id, state.instances)
    expect(live?.nodeOverrides[0]?.values[CINEMA_FOUNDATION_COLOR_A_PARAMETER_ID]).toEqual([0.1, 0.2, 0.3, 1])
    expect(state.activeInstanceId).toBe(live?.id)
    expect(JSON.stringify(CINEMA_FOUNDATION_COMPOSITION)).toBe(baseBefore)

    resetCinemaLiveOverrides(CINEMA_FOUNDATION_COMPOSITION.id)
    expect(getCinemaLiveInstance(CINEMA_FOUNDATION_COMPOSITION.id, useCinemaStore.getState().instances)).toBeNull()
  })
})
