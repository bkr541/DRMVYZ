import { CanvasDirectWebGLLayer, type DirectWebGLLayerProps } from '../CanvasDirectWebGLLayer'
import { FluidityRenderer } from './FluidityRenderer'
import { FluidityPerformance } from './FluidityPerformance'
import type { CanvasFluiditySettings } from './FluiditySettings'

const adapter = {
  label: 'Fluidity',
  className: 'rv-canvas-fluidity-layer',
  createRenderer: FluidityRenderer.create,
  createController: () => new FluidityPerformance(),
}

export function CanvasFluidityLayer(props: DirectWebGLLayerProps<CanvasFluiditySettings>) {
  return <CanvasDirectWebGLLayer {...props} adapter={adapter} />
}
