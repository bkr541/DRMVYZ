import type { ReactNode } from 'react'
import { HeaderSystemStatus } from './HeaderSystemStatus'
import type { AppPageId } from '../../../stores/pageActivityStore'

/** Shared header status only. Notifications and profile/settings live at the bottom of the left navigation. */
export function VyzualzHeaderActions({ page, leading, status }: { page: AppPageId; leading?: ReactNode; status?: ReactNode }) {
  return (
    <>
      {leading}
      {status ?? <HeaderSystemStatus page={page} />}
    </>
  )
}
