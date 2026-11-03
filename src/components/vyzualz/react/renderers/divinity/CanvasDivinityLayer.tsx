import { CanvasDirectWebGLLayer, type DirectWebGLLayerProps } from '../CanvasDirectWebGLLayer'
import { DivinityRenderer } from './DivinityRenderer'
import { DivinityPerformance } from './DivinityPerformance'
import type { CanvasDivinitySettings } from './DivinitySettings'

const adapter = {
  label: 'Divinity',
  className: 'rv-canvas-divinity-layer',
  createRenderer: DivinityRenderer.create,
  createController: () => new DivinityPerformance(),
}

export function CanvasDivinityLayer(props: DirectWebGLLayerProps<CanvasDivinitySettings>) {
  return <CanvasDirectWebGLLayer {...props} adapter={adapter} />
}
