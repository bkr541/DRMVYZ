import { describe, expect, it } from 'vitest'
import { isChunkLoadError } from './chunkLoadError'

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: http://127.0.0.1:5173/src/components/vyzualz/react/ReactView.tsx?t=1',
    'error loading dynamically imported module: http://localhost/a.js',
    'Importing a module script failed.',
    'Loading chunk 12 failed.',
    'Loading CSS chunk vendor failed.',
    'Unable to preload CSS for /assets/a.css',
  ])('recognises %s', message => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true)
  })

  it('recognises a ChunkLoadError by name', () => {
    const error = new Error('anything')
    error.name = 'ChunkLoadError'
    expect(isChunkLoadError(error)).toBe(true)
  })

  it('does not treat ordinary render errors or non-errors as chunk failures', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of null'))).toBe(false)
    expect(isChunkLoadError(new ReferenceError('x is not defined'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
  })
})
