import { describe, expect, it, vi } from 'vitest'
import {
  RECOVERY_PRESSURE_HOLD_MS, applyRecoverySafeStart, consumeRecoveryRequest, recoverySafePresetIsAvailable, type RecoverySafeStartDeps,
} from './rendererRecovery'

function fakeWindow(href: string) {
  const win = { location: { href }, history: { state: { keep: true }, replaceState: vi.fn() } }
  return win as unknown as Pick<Window, 'location' | 'history'> & { history: { replaceState: ReturnType<typeof vi.fn> } }
}

const deps = (overrides: Partial<RecoverySafeStartDeps> = {}): RecoverySafeStartDeps & { notices: { title: string; message: string }[]; holds: number[] } => {
  const notices: { title: string; message: string }[] = [], holds: number[] = []
  return {
    presetExists: () => true, presetName: () => 'Inertia', openPreset: () => true,
    notifyUser: (title, message) => { notices.push({ title, message }) }, setPressure: hold => { holds.push(hold) },
    ...overrides, notices, holds,
  }
}

describe('recovery start', () => {
  it('reads a known ?recovery= reason once and removes only that parameter from the address', () => {
    const win = fakeWindow('http://127.0.0.1:5173/?recovery=renderer-unresponsive&keep=1#deck')
    expect(consumeRecoveryRequest(win)).toEqual({ reason: 'renderer-unresponsive' })
    expect(win.history.replaceState).toHaveBeenCalledWith({ keep: true }, '', '/?keep=1#deck')
  })

  it('is not a recovery start without the parameter, or with a reason the app does not know', () => {
    const plain = fakeWindow('http://127.0.0.1:5173/')
    expect(consumeRecoveryRequest(plain)).toBeNull()
    expect(plain.history.replaceState).not.toHaveBeenCalled()
    // An unknown value is still removed from the address, but never acted on.
    const odd = fakeWindow('http://127.0.0.1:5173/?recovery=<script>')
    expect(consumeRecoveryRequest(odd)).toBeNull()
    expect(odd.history.replaceState).toHaveBeenCalled()
  })

  it('holds reduced quality, opens the light preset and says what happened', () => {
    const d = deps()
    expect(applyRecoverySafeStart({ reason: 'renderer-unresponsive' }, d)).toBe(true)
    expect(d.holds).toEqual([RECOVERY_PRESSURE_HOLD_MS])
    expect(d.notices).toHaveLength(1)
    expect(d.notices[0]!.title).toBe('Recovered from a graphics stall')
    expect(d.notices[0]!.message).toContain('the display stopped responding')
    expect(d.notices[0]!.message).toContain('Inertia')
    expect(d.notices[0]!.message).toContain('Preset Manager')
  })

  it('still sheds load and tells the user when the light preset is missing or will not open', () => {
    for (const d of [deps({ presetExists: () => false }), deps({ openPreset: () => false })]) {
      expect(applyRecoverySafeStart({ reason: 'gpu-process-gone' }, d)).toBe(false)
      expect(d.holds).toEqual([RECOVERY_PRESSURE_HOLD_MS])
      expect(d.notices[0]!.message).toContain('the graphics process stopped')
      expect(d.notices[0]!.message).toContain('reduced quality')
      expect(d.notices[0]!.message).not.toContain('Preset Manager')
    }
  })

  it('names a light preset that really is registered', () => {
    expect(recoverySafePresetIsAvailable()).toBe(true)
  })
})
