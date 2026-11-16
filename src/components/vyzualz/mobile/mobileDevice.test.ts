import { describe, expect, it } from 'vitest'
import { isTabletUserAgent, readStoredViewPreference, readViewParam, shouldUseMobileApp, writeStoredViewPreference, type MobileEnvironment } from './mobileDevice'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const PIXEL = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
const phone = (over: Partial<MobileEnvironment> = {}): MobileEnvironment => ({ coarsePointer: true, hoverNone: true, shortSide: 393, maxTouchPoints: 5, userAgent: IPHONE, search: '', ...over })

describe('shouldUseMobileApp', () => {
  it('sends a phone to the mobile screens, in either orientation', () => {
    expect(shouldUseMobileApp(phone(), null)).toBe(true)
    expect(shouldUseMobileApp(phone({ userAgent: PIXEL, shortSide: 412 }), null)).toBe(true)
    expect(shouldUseMobileApp(phone({ shortSide: 393 }), null)).toBe(true) // landscape: short side is still 393
  })
  it('keeps iPads, Android tablets and desktops on the full application', () => {
    expect(shouldUseMobileApp(phone({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5, shortSide: 768 }), null)).toBe(false)
    expect(shouldUseMobileApp(phone({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', shortSide: 744 }), null)).toBe(false)
    expect(shouldUseMobileApp(phone({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) Chrome/130.0 Safari/537.36', shortSide: 800 }), null)).toBe(false)
    expect(shouldUseMobileApp(phone({ coarsePointer: false, hoverNone: false, maxTouchPoints: 0, userAgent: IPAD_DESKTOP_UA.replace('Macintosh', 'X11'), shortSide: 600 }), null)).toBe(false)
  })
  it('does not treat a wide touch screen as a phone', () => {
    expect(shouldUseMobileApp(phone({ shortSide: 1024 }), null)).toBe(false)
    expect(shouldUseMobileApp(phone({ shortSide: 0 }), null)).toBe(false)
  })
  it('honours the address parameter and the stored choice, with the address winning', () => {
    expect(shouldUseMobileApp(phone({ search: '?view=desktop' }), null)).toBe(false)
    expect(shouldUseMobileApp(phone(), 'desktop')).toBe(false)
    expect(shouldUseMobileApp(phone({ coarsePointer: false, hoverNone: false, maxTouchPoints: 0, shortSide: 1400 }), 'mobile')).toBe(true)
    expect(shouldUseMobileApp(phone({ search: '?view=mobile' }), 'desktop')).toBe(true)
    expect(shouldUseMobileApp(phone({ search: '?view=banana' }), 'desktop')).toBe(false)
  })
})

describe('helpers', () => {
  it('recognises tablets', () => {
    expect(isTabletUserAgent(IPHONE, 5)).toBe(false)
    expect(isTabletUserAgent(PIXEL, 5)).toBe(false)
    expect(isTabletUserAgent(IPAD_DESKTOP_UA, 5)).toBe(true)
    expect(isTabletUserAgent(IPAD_DESKTOP_UA, 0)).toBe(false)
  })
  it('parses only known view values', () => {
    expect(readViewParam('?view=mobile')).toBe('mobile')
    expect(readViewParam('?x=1&view=desktop')).toBe('desktop')
    expect(readViewParam('?view=')).toBeNull()
  })
  it('stores and clears the preference, and survives unavailable storage', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
    writeStoredViewPreference('desktop', storage)
    expect(readStoredViewPreference(storage)).toBe('desktop')
    writeStoredViewPreference(null, storage)
    expect(readStoredViewPreference(storage)).toBeNull()
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
    expect(readStoredViewPreference(broken)).toBeNull()
    expect(() => writeStoredViewPreference('mobile', broken)).not.toThrow()
  })
})
