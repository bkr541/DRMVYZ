import { createPixGridDeckMediaDeletionGuard } from '../components/vyzualz/react/pixGrid/PixGridDeckMediaDeletion'
import { createCanvasShowManagerMediaDeletionGuard } from '../components/vyzualz/showManager/CanvasShowManagerMediaDeletion'
import { registerMediaDeletionGuard } from './mediaStore'
import { useReactStore } from './reactStore'

// Media Manager can be reached before the lazy React/Show Manager workspaces.
// Register the project-aware guard from the eager application entry path so a
// canonical media deletion can never bypass persisted PixGrid Deck references.
const canvasShowGuard = createCanvasShowManagerMediaDeletionGuard(() => useReactStore.getState())
const pixGridDeckGuard = createPixGridDeckMediaDeletionGuard(() => useReactStore.getState())

registerMediaDeletionGuard((item, confirmation) => {
  const canvasResult = canvasShowGuard(item, confirmation)
  return canvasResult.allowed ? pixGridDeckGuard(item, confirmation) : canvasResult
})
