import type { CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { ancientMachineWorldDefinition } from './AncientMachineWorld'
import { celestialCathedralWorldDefinition } from './CelestialCathedralWorld'
import { eventHorizonWorldDefinition } from './EventHorizonWorld'
import { fractureRiftWorldDefinition } from './FractureRiftWorld'
import { infiniteCorridorWorldDefinition } from './InfiniteCorridorWorld'
import { liquidMembraneWorldDefinition } from './LiquidMembraneWorld'
import { mirrorDimensionWorldDefinition } from './MirrorDimensionWorld'
import { monolithGateWorldDefinition } from './MonolithGateWorld'
import { stormGatewayWorldDefinition } from './StormGatewayWorld'

export {
  ancientMachineWorldDefinition,
  celestialCathedralWorldDefinition,
  eventHorizonWorldDefinition,
  fractureRiftWorldDefinition,
  infiniteCorridorWorldDefinition,
  liquidMembraneWorldDefinition,
  mirrorDimensionWorldDefinition,
  monolithGateWorldDefinition,
  stormGatewayWorldDefinition,
}

export const cinematicWorldDefinitions: readonly CinematicWebGLWorldDefinition[] = [
  eventHorizonWorldDefinition,
  infiniteCorridorWorldDefinition,
  fractureRiftWorldDefinition,
  monolithGateWorldDefinition,
  liquidMembraneWorldDefinition,
  celestialCathedralWorldDefinition,
  mirrorDimensionWorldDefinition,
  ancientMachineWorldDefinition,
  stormGatewayWorldDefinition,
]
