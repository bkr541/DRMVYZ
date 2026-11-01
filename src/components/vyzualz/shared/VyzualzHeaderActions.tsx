import type { ReactNode } from 'react'
import { ReactHeaderStatusCluster } from '../react/ReactHeaderStatusCluster'
import type { HeaderSaveTone } from './HeaderSaveChip'
import type { AppPageId } from '../../../stores/pageActivityStore'

/** Shared header status only. Notifications and profile/settings live at the bottom of the left navigation. */
export function VyzualzHeaderActions({ page, leading, status, saveStatus }: { page: AppPageId; leading?: ReactNode; status?: ReactNode; saveStatus?: { label: string; tone: HeaderSaveTone } }) {
  return (
    <>
      {leading}
      {status ?? <ReactHeaderStatusCluster page={page} saveStatus={saveStatus} />}
    </>
  )
}
