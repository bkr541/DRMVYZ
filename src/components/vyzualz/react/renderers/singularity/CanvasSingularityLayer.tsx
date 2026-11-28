import { CanvasDirectWebGLLayer, type DirectWebGLLayerProps } from '../CanvasDirectWebGLLayer'
import { SingularityRenderer } from './SingularityRenderer'
import { SingularityPerformance } from './SingularityPerformance'
import type { CanvasSingularitySettings } from './SingularitySettings'
const adapter = { label: 'Singularity', className: 'rv-canvas-singularity-layer', createRenderer: SingularityRenderer.create, createController: () => new SingularityPerformance() }
export function CanvasSingularityLayer(props: DirectWebGLLayerProps<CanvasSingularitySettings>) { return <CanvasDirectWebGLLayer {...props} adapter={adapter} /> }
