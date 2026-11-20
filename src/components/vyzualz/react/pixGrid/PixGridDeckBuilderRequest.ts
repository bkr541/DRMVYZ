/**
 * A one-shot request to open the PixGrid Deck Builder as soon as Preset Manager mounts. The React Workspace's Custom Workflow entry sets it
 * before switching views; Preset Manager takes it on mount. It carries no data and is never persisted.
 */
let pending = false

export function requestPixGridDeckBuilderOpen(): void {
  pending = true
}

/** True once per request. */
export function takePixGridDeckBuilderRequest(): boolean {
  const requested = pending
  pending = false
  return requested
}
