/**
 * Decides whether a signed-in user gets the dedicated mobile screens or the full desktop application.
 *
 * A phone is a touch-first screen that is narrow: the primary pointer is coarse (a finger) and the short side of the viewport is at most
 * 820 CSS px. An iPad, or a desktop browser window that happens to be narrow, is not a phone. The user can always override the guess: the
 * `?view=mobile|desktop` address parameter (which is remembered) or the "Use desktop version" link on the Remote page.
 */
export const MOBILE_MAX_SHORT_SIDE_PX = 820
export const MOBILE_VIEW_PREFERENCE_KEY = 'drmvyz.mobile.viewPreference.v1'
export const MOBILE_VIEW_PARAM = 'view'

export type MobileViewPreference = 'mobile' | 'desktop'

export interface MobileEnvironment {
  /** Result of `matchMedia('(pointer: coarse)')` and `(hover: none)`, as the primary input. */
  coarsePointer: boolean
  hoverNone: boolean
  /** The shorter side of the viewport (portrait width, landscape height) in CSS pixels. */
  shortSide: number
  /** `navigator.maxTouchPoints`. */
  maxTouchPoints: number
  /** `navigator.userAgent`, used only to keep tablets out. */
  userAgent: string
  /** The address query string, e.g. `?view=desktop`. */
  search: string
}

/** iPads (including iPadOS, which reports a Mac user agent with touch points) and Android tablets, which do not carry the `Mobile` token. */
export function isTabletUserAgent(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad/i.test(userAgent)) return true
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return true
  return /Android/i.test(userAgent) && !/Mobile/i.test(userAgent)
}

export function readViewParam(search: string): MobileViewPreference | null {
  const value = new URLSearchParams(search).get(MOBILE_VIEW_PARAM)
  return value === 'mobile' || value === 'desktop' ? value : null
}

/** True when this device should be sent to the mobile screens, given an optional stored override. */
export function shouldUseMobileApp(environment: MobileEnvironment, stored: MobileViewPreference | null): boolean {
  const requested = readViewParam(environment.search) ?? stored
  if (requested) return requested === 'mobile'
  if (isTabletUserAgent(environment.userAgent, environment.maxTouchPoints)) return false
  const touchFirst = environment.coarsePointer && environment.hoverNone && environment.maxTouchPoints > 0
  return touchFirst && environment.shortSide > 0 && environment.shortSide <= MOBILE_MAX_SHORT_SIDE_PX
}

export function readStoredViewPreference(storage: Pick<Storage, 'getItem'> | null = safeLocalStorage()): MobileViewPreference | null {
  try {
    const value = storage?.getItem(MOBILE_VIEW_PREFERENCE_KEY)
    return value === 'mobile' || value === 'desktop' ? value : null
  } catch {
    return null
  }
}

export function writeStoredViewPreference(value: MobileViewPreference | null, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeLocalStorage()): void {
  try {
    if (value) storage?.setItem(MOBILE_VIEW_PREFERENCE_KEY, value)
    else storage?.removeItem(MOBILE_VIEW_PREFERENCE_KEY)
  } catch { /* Storage can be unavailable (private windows); the choice then lasts for this page load only. */ }
}

function safeLocalStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

export function readMobileEnvironment(win: Window = window): MobileEnvironment {
  const match = (query: string) => { try { return win.matchMedia?.(query).matches === true } catch { return false } }
  return {
    coarsePointer: match('(pointer: coarse)'),
    hoverNone: match('(hover: none)'),
    shortSide: Math.min(win.innerWidth || 0, win.innerHeight || 0),
    maxTouchPoints: win.navigator?.maxTouchPoints ?? 0,
    userAgent: win.navigator?.userAgent ?? '',
    search: win.location?.search ?? '',
  }
}

/**
 * The decision for this page load. A `?view=` parameter is remembered so the choice survives the sign-in redirect and later visits;
 * returns the preference that should now be stored (or null to leave storage alone).
 */
export function resolveMobileApp(win: Window = window): boolean {
  const environment = readMobileEnvironment(win)
  const fromAddress = readViewParam(environment.search)
  if (fromAddress) writeStoredViewPreference(fromAddress)
  return shouldUseMobileApp(environment, readStoredViewPreference())
}

/** Switches to the other experience and reloads, so the shell is chosen once and nothing from the other is half-mounted. */
export function switchView(preference: MobileViewPreference, win: Window = window): void {
  writeStoredViewPreference(preference)
  const url = new URL(win.location.href)
  url.searchParams.delete(MOBILE_VIEW_PARAM)
  win.location.assign(url.toString())
}
