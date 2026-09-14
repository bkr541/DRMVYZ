const GL_ERROR_NAMES = new Map<number, string>([
  [0x0500, 'INVALID_ENUM'],
  [0x0501, 'INVALID_VALUE'],
  [0x0502, 'INVALID_OPERATION'],
  [0x0505, 'OUT_OF_MEMORY'],
  [0x0506, 'INVALID_FRAMEBUFFER_OPERATION'],
  [0x9242, 'CONTEXT_LOST_WEBGL'],
])

const FRAMEBUFFER_STATUS_NAMES = new Map<number, string>([
  [0x8cd5, 'FRAMEBUFFER_COMPLETE'],
  [0x8cd6, 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT'],
  [0x8cd7, 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT'],
  [0x8cdb, 'FRAMEBUFFER_INCOMPLETE_DRAW_BUFFER'],
  [0x8cdc, 'FRAMEBUFFER_INCOMPLETE_READ_BUFFER'],
  [0x8d56, 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE'],
  [0x8cdd, 'FRAMEBUFFER_UNSUPPORTED'],
])

/**
 * Drain and surface WebGL errors at explicit Cinema 2.0 GPU boundaries.
 *
 * WebGL reports many rendering failures only through getError(), so callers
 * use this after a critical draw/blit/allocation operation. The bounded drain
 * prevents a poisoned context from creating an unbounded loop while retaining
 * every error code needed for actionable diagnostics.
 */
export function assertCinema2NoGlErrors(
  gl: WebGL2RenderingContext,
  operation: string,
  detail?: string,
): void {
  const errors: number[] = []
  const maximumErrors = 8
  for (let index = 0; index < maximumErrors; index += 1) {
    const error = gl.getError()
    if (error === gl.NO_ERROR) break
    errors.push(error)
    if (error === 0x9242) break
  }
  if (errors.length === 0) return
  const labels = errors.map(describeCinema2GlError).join(', ')
  throw new Error(`Cinema 2.0 ${operation} reported WebGL error${errors.length === 1 ? '' : 's'} ${labels}${detail ? ` (${detail})` : ''}.`)
}

export function describeCinema2FramebufferStatus(status: number): string {
  return `${FRAMEBUFFER_STATUS_NAMES.get(status) ?? 'UNKNOWN_FRAMEBUFFER_STATUS'} (0x${status.toString(16)})`
}

function describeCinema2GlError(error: number): string {
  return `${GL_ERROR_NAMES.get(error) ?? 'UNKNOWN_GL_ERROR'} (0x${error.toString(16)})`
}
