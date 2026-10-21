// A lazily imported module (React.lazy / dynamic import()) that fails to download rejects once and React.lazy keeps that rejection, so
// re-rendering the same component can never succeed: only reloading the page fetches the module again. These are the messages the
// engines behind Electron/Chrome, Firefox, Safari and the webpack-style loaders use for that failure.
const CHUNK_LOAD_MESSAGES = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [\w-]+ failed/i,
  /loading css chunk [\w-]+ failed/i,
  /unable to preload css/i,
]

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  if (name === 'ChunkLoadError') return true
  return typeof message === 'string' && CHUNK_LOAD_MESSAGES.some(pattern => pattern.test(message))
}
