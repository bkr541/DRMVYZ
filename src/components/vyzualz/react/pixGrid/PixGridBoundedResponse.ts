export class PixGridResponseLimitError extends Error {
  readonly code = 'source-too-large'

  constructor(readonly maximumBytes: number, readonly observedBytes: number) {
    super(`PixGrid media exceeded the bounded source limit of ${maximumBytes} bytes.`)
    this.name = 'PixGridResponseLimitError'
  }
}

function declaredLength(response: Response): number | null {
  const raw = response.headers.get('content-length')
  if (!raw || !/^\d+$/.test(raw.trim())) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

/**
 * Consumes a response without allowing an omitted or inaccurate Content-Length
 * header to bypass PixGrid's source-memory budget.
 */
export async function readPixGridResponseBlobBounded(
  response: Response,
  maximumBytes: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const limit = Math.max(1, Math.floor(maximumBytes))
  const declared = declaredLength(response)
  if (declared != null && declared > limit) {
    await response.body?.cancel('PixGrid source exceeds its declared size budget').catch(() => undefined)
    throw new PixGridResponseLimitError(limit, declared)
  }
  if (signal?.aborted) throw new DOMException('PixGrid media preparation was cancelled.', 'AbortError')

  const reader = response.body?.getReader()
  if (!reader) {
    const blob = await response.blob()
    if (blob.size > limit) throw new PixGridResponseLimitError(limit, blob.size)
    return blob
  }

  const chunks: Uint8Array[] = []
  let bytes = 0
  const abort = () => { void reader.cancel('PixGrid media preparation was cancelled.') }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('PixGrid media preparation was cancelled.', 'AbortError')
      const result = await reader.read()
      if (result.done) break
      if (!result.value?.byteLength) continue
      bytes += result.value.byteLength
      if (bytes > limit) {
        await reader.cancel('PixGrid source exceeded its streaming size budget').catch(() => undefined)
        throw new PixGridResponseLimitError(limit, bytes)
      }
      chunks.push(result.value)
    }
    return new Blob(chunks, { type: response.headers.get('content-type') ?? '' })
  } finally {
    signal?.removeEventListener('abort', abort)
    try { reader.releaseLock() } catch { /* The stream may already be cancelled. */ }
  }
}
