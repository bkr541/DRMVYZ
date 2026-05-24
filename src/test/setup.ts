/**
 * Vitest global setup — runs before every test file.
 *
 * Provides a minimal in-memory localStorage so Zustand's persist middleware
 * does not emit "Unable to update item" warnings in the Node test environment.
 * The implementation is intentionally a dumb Map: tests that exercise actual
 * persistence behaviour should mock localStorage explicitly for their needs.
 *
 * Also suppresses the expected "[WebGL2Renderer] WebGL2 context unavailable"
 * console.warn that fires in every renderer test where the Node environment
 * cannot supply a real GL context.
 */
import { vi, beforeAll, afterAll } from 'vitest'

// ── In-memory localStorage ────────────────────────────────────────────────────

const _store = new Map<string, string>()

const localStorageMock = {
  getItem:    (key: string) => _store.get(key) ?? null,
  setItem:    (key: string, value: string) => { _store.set(key, value) },
  removeItem: (key: string) => { _store.delete(key) },
  clear:      () => { _store.clear() },
  get length() { return _store.size },
  key:        (index: number) => Array.from(_store.keys())[index] ?? null,
}

vi.stubGlobal('localStorage', localStorageMock)

// ── Suppress expected noise ───────────────────────────────────────────────────

const _origWarn = console.warn
const _origError = console.error

beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? '')
    // Zustand persist emits this when localStorage is called before global
    // stub is installed — suppressed now that the stub is in place.
    if (msg.includes('Unable to update item') && msg.includes('zustand')) return
    // WebGL2 context unavailable in Node — always expected in renderer tests.
    if (msg.includes('[WebGL2Renderer] WebGL2 context unavailable')) return
    _origWarn(...args)
  }
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? '')
    // Shader compile errors emitted by renderer tests are intentional.
    if (msg.includes('[WebGL2Renderer] shader compile')) return
    if (msg.includes('[WebGL2Renderer] program link')) return
    if (msg.includes('[WebGL2Renderer] init failed')) return
    _origError(...args)
  }
})

afterAll(() => {
  console.warn  = _origWarn
  console.error = _origError
  _store.clear()
})
