import type { ReactElement } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'
import type { ReactEngineId } from './ReactTypes'

const REACT_ENGINE_ICON_COMPONENTS: Record<ReactEngineId, () => ReactElement> = {
  shaderPads: () => <AppIcon kind="shader" />,
  cinematicPortal: () => <AppIcon kind="orbit" />,
  cinema: () => <AppIcon kind="cinema" />,
  cinema2: () => <AppIcon kind="cinema" />,
  oscilloscope: () => <AppIcon kind="waveform" />,
  canvas: () => <AppIcon kind="canvas" />,
  laserDmx: () => <AppIcon kind="laser" />,
  pixGrid: () => <AppIcon kind="pixGrid" />,
  headliner: () => <AppIcon kind="headliner" />,
}

/** Covers current engines and the retired Cinema identity used by migrated projects. */
export function getReactEngineIconComponent(engineId: ReactEngineId): () => ReactElement {
  return REACT_ENGINE_ICON_COMPONENTS[engineId]
}
