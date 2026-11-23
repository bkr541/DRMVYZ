import { createContext, useContext } from 'react'

/**
 * True while the React view is running hidden on another page to keep a cast alive (see ReactViewKeepAlive). Anything in the view that draws outside it (the header controls,
 * floating monitors and popovers) or listens on the whole window (hotkeys) must stand down while this is true, so the page the user is actually on is not disturbed.
 */
export const ReactBackgroundedContext = createContext(false)
export const useReactBackgrounded = (): boolean => useContext(ReactBackgroundedContext)
