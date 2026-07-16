import { useReactStore } from '../../../../stores/reactStore'
import { PixGridControls } from './PixGridControls'

export function PixGridEnginePanel() {
  const state = useReactStore(store => store.pixGridState)
  return (
    <div className="rv-pix-grid-engine-panel">
      <div className="rv-engine-status-grid" aria-label="PixGrid status">
        <span>Matrix</span><strong>{state.matrixWidth} × {state.matrixHeight}</strong>
        <span>Layers</span><strong>{state.layers.length}</strong>
        <span>Groups</span><strong>{state.groups.length}</strong>
      </div>
      <PixGridControls />
    </div>
  )
}
