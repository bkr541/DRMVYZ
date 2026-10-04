import type { ReactNode } from 'react'
import { RailTabs, type RailTabOption } from '../../../components/vyzualz/layout/RailTabs'

export type LyricInspectorTab = 'cue' | 'document' | 'review'

const INSPECTOR_TABS: RailTabOption<LyricInspectorTab>[] = [
  { id: 'cue', label: 'Cue' },
  { id: 'document', label: 'Document' },
  { id: 'review', label: 'Review' },
]

interface Props {
  activeTab: LyricInspectorTab
  onTabChange: (tab: LyricInspectorTab) => void
  cue: ReactNode
  document: ReactNode
  review: ReactNode
  /** Persistent compact summary under the panes (e.g. Review & Validation counts). */
  summary?: ReactNode
}

/**
 * The Lyric Manager's right rail: one contextual inspector instead of stacked
 * windows. The tab is controlled by the owner and only ever changes on a user
 * click. All three panes stay mounted (inactive ones are `hidden`) so switching
 * tabs never resets inputs, scroll, or collapsible state, and never touches the
 * lyric store.
 */
export function LyricInspector({ activeTab, onTabChange, cue, document, review, summary }: Props) {
  const panes: Array<[LyricInspectorTab, ReactNode]> = [['cue', cue], ['document', document], ['review', review]]
  return (
    <div className="lmv-inspector">
      <RailTabs
        tabs={INSPECTOR_TABS}
        activeTab={activeTab}
        onChange={onTabChange}
        ariaLabel="Lyric inspector"
        variant="underline"
        className="lmv-workspace-tabs lmv-inspector-tabs"
      />
      {panes.map(([id, content]) => (
        <div
          key={id}
          role="tabpanel"
          aria-label={INSPECTOR_TABS.find(tab => tab.id === id)?.label}
          className="lmv-inspector-pane"
          data-inspector-pane={id}
          hidden={activeTab !== id}
        >
          {content}
        </div>
      ))}
      {summary}
    </div>
  )
}
