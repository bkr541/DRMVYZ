import type { CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { eventHorizonWorldDefinition } from './EventHorizonWorld'
import { fractureRiftWorldDefinition } from './FractureRiftWorld'
import { infiniteCorridorWorldDefinition } from './InfiniteCorridorWorld'
import { monolithGateWorldDefinition } from './MonolithGateWorld'

export {
  eventHorizonWorldDefinition,
  fractureRiftWorldDefinition,
  infiniteCorridorWorldDefinition,
  monolithGateWorldDefinition,
}

export const cinematicWorldDefinitions: readonly CinematicWebGLWorldDefinition[] = [
  eventHorizonWorldDefinition,
  infiniteCorridorWorldDefinition,
  fractureRiftWorldDefinition,
  monolithGateWorldDefinition,
]
