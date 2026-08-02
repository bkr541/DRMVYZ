import { createPixGridDeckMediaDeletionGuard } from '../components/vyzualz/react/pixGrid/PixGridDeckMediaDeletion'
import { registerMediaDeletionGuard } from './mediaStore'
import { useReactStore } from './reactStore'

// Media Manager can be reached before the lazy React/Show Manager workspaces.
// Register the project-aware guard from the eager application entry path so a
// canonical media deletion can never bypass persisted PixGrid Deck references.
registerMediaDeletionGuard(createPixGridDeckMediaDeletionGuard(() => useReactStore.getState()))
