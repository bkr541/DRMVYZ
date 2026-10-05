import { useEffect, useState } from 'react'
import { getNativeSystemBridge } from './systemMetricsBridge'
import type { NativeCpuUsage } from './systemMetricsBridge'

export const CPU_POLL_INTERVAL_MS = 2000

export type AppCpuUsage =
  | { status: 'unavailable' }
  | { status: 'measuring' }
  | { status: 'ready'; usage: NativeCpuUsage }

/**
 * CPU used by the whole desktop app, polled from the Electron main process. A plain browser has no
 * way to read CPU, so there it reports `unavailable` rather than inventing a number. Polling pauses
 * while the window is hidden.
 */
export function useAppCpuUsage(intervalMs: number = CPU_POLL_INTERVAL_MS): AppCpuUsage {
  const getCpuUsage = getNativeSystemBridge()?.getCpuUsage
  const [state, setState] = useState<AppCpuUsage>(() => (getCpuUsage ? { status: 'measuring' } : { status: 'unavailable' }))

  useEffect(() => {
    if (!getCpuUsage) {
      setState({ status: 'unavailable' })
      return
    }
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      timer = null
      if (document.hidden) return schedule()
      try {
        const usage = await getCpuUsage()
        if (alive && usage) setState({ status: 'ready', usage })
      } catch {
        // A failed read just keeps the previous value; the next tick tries again.
      }
      schedule()
    }
    const schedule = () => {
      if (alive) timer = setTimeout(() => { void poll() }, intervalMs)
    }
    void poll()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [getCpuUsage, intervalMs])

  return state
}
