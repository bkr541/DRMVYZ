import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS, type ReactEngineCatalogEntry, type ReactLiveEngineId } from '../../reactEngineCatalog'

/** The engines a user can choose in React View, in production's order. */
export type EngineChoiceId = ReactLiveEngineId
export const ENGINE_CHOICES = REACT_ENGINE_IDS.map(id => REACT_ENGINE_CATALOG[id] as ReactEngineCatalogEntry & { id: EngineChoiceId })
export type RadialEngineVariant = 'dial' | 'orbit' | 'rotary'

export interface EngineOverlayProps {
  value: EngineChoiceId
  /** Bounds of the engine card the overlay grows from, in the owner document's viewport. */
  anchor: DOMRect
  /** Size of the owner document's window, which is Layout Lab's own window when it is popped out. */
  viewport: { width: number; height: number }
  onSelect: (id: EngineChoiceId) => void
  onClose: () => void
}
