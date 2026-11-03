import { CanvasDirectWebGLLayer, type DirectWebGLLayerProps } from '../CanvasDirectWebGLLayer'
import { VhsRenderer } from './VhsRenderer'
import { VhsPerformance } from './VhsPerformance'
import type { CanvasVhsSettings } from './VhsSettings'

const adapter = {
  label: 'VHS',
  className: 'rv-canvas-vhs-layer',
  createRenderer: VhsRenderer.create,
  createController: () => new VhsPerformance(),
}

export function CanvasVhsLayer(props: DirectWebGLLayerProps<CanvasVhsSettings>) {
  return <CanvasDirectWebGLLayer {...props} adapter={adapter} />
}
