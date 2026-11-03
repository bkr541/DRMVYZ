import { CanvasDirectWebGLLayer, type DirectWebGLLayerProps } from '../CanvasDirectWebGLLayer'
import { TerminalRenderer } from './TerminalRenderer'
import { TerminalPerformance } from './TerminalPerformance'
import type { CanvasTerminalSettings } from './TerminalSettings'

const adapter = {
  label: 'Terminal',
  className: 'rv-canvas-terminal-layer',
  createRenderer: TerminalRenderer.create,
  createController: () => new TerminalPerformance(),
}

export function CanvasTerminalLayer(props: DirectWebGLLayerProps<CanvasTerminalSettings>) {
  return <CanvasDirectWebGLLayer {...props} adapter={adapter} />
}
