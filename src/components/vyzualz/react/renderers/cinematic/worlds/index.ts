import type { CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { afterhoursWorldDefinition } from './AfterhoursWorld'
import { ancientMachineWorldDefinition } from './AncientMachineWorld'
import { celestialCathedralWorldDefinition } from './CelestialCathedralWorld'
import { eventHorizonWorldDefinition } from './EventHorizonWorld'
import { electricStormWorldDefinition } from './ElectricStormWorld'
import { fractureRiftWorldDefinition } from './FractureRiftWorld'
import { infiniteCorridorWorldDefinition } from './InfiniteCorridorWorld'
import { liquidMembraneWorldDefinition } from './LiquidMembraneWorld'
import { mirrorDimensionWorldDefinition } from './MirrorDimensionWorld'
import { monolithGateWorldDefinition } from './MonolithGateWorld'
import { orbitalPrismArrayWorldDefinition } from './OrbitalPrismArrayWorld'
import { reactiveConstellationWorldDefinition } from './ReactiveConstellationWorld'
import { stormGatewayWorldDefinition } from './StormGatewayWorld'

export {
  afterhoursWorldDefinition,
  ancientMachineWorldDefinition,
  celestialCathedralWorldDefinition,
  eventHorizonWorldDefinition,
  electricStormWorldDefinition,
  fractureRiftWorldDefinition,
  infiniteCorridorWorldDefinition,
  liquidMembraneWorldDefinition,
  mirrorDimensionWorldDefinition,
  monolithGateWorldDefinition,
  orbitalPrismArrayWorldDefinition,
  reactiveConstellationWorldDefinition,
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
  electricStormWorldDefinition,
  afterhoursWorldDefinition,
  orbitalPrismArrayWorldDefinition,
  reactiveConstellationWorldDefinition,
]
