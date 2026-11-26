import { CanvasDirectWebGLLayer, type DirectWebGLLayerProps } from '../CanvasDirectWebGLLayer'
import { MorphRenderer } from './MorphRenderer'
import { MorphPerformance } from './MorphPerformance'
import type { CanvasMorphSettings } from './MorphSettings'

const adapter = {
  label: 'Morph',
  className: 'rv-canvas-morph-layer',
  createRenderer: MorphRenderer.create,
  createController: () => new MorphPerformance(),
}

export function CanvasMorphLayer(props: DirectWebGLLayerProps<CanvasMorphSettings>) {
  return <CanvasDirectWebGLLayer {...props} adapter={adapter} />
}
