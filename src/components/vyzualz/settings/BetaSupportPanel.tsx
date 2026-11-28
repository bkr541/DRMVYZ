import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BUILD_INFO, buildLabel } from '../../../lib/buildInfo'
import { useReactStore } from '../../../stores/reactStore'
import { ISSUE_CATEGORIES, sendIssueReport, validateIssueReport, type IssueCategory } from '../../../features/beta/issueReport'
import { SelectRow, TextAreaRow, ToggleRow } from '../react/ReactControlRows'
import { IconChipButton } from '../react/controls/IconChipButton'
import { NoticeCard } from '../react/controls/NoticeCard'

/**
 * Settings > Beta & Support: which build this is, and Report an Issue (beta remediation UX-01, DEP-03). A report goes to the STAGELESS team
 * (migration 0066). With "Include diagnostics" on it also carries the build, platform, graphics, what was active and the recent log, with
 * links, file paths, tokens and email addresses removed (src/features/beta/issueReport.ts).
 */
export function BetaSupportPanel() {
  const activity = useReactStore(useShallow(state => ({
    engine: state.activeReactEngineId,
    preset: state.activeReactPresetId,
    cinema2Preset: state.cinema2Workspace.activePresetId,
  })))
  const [category, setCategory] = useState<IssueCategory>('rendering')
  const [summary, setSummary] = useState('')
  const [steps, setSteps] = useState('')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const problem = summary.trim() || steps.trim() ? validateIssueReport({ summary, steps }) : null

  const send = async () => {
    const invalid = validateIssueReport({ summary, steps })
    if (invalid) { setError(invalid); return }
    setState('sending'); setError(null)
    try {
      await sendIssueReport({ category, summary, steps, includeDiagnostics, context: { activity } })
      setState('sent'); setSummary(''); setSteps('')
    } catch (reason) {
      setState('idle')
      setError(reason instanceof Error ? reason.message : 'The report could not be sent.')
    }
  }

  return (
    <div className="vsm-system-settings" aria-label="Beta and support">
      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>This Build</h2>
            <p>Mention it when you talk to the team, so we know exactly what you are running.</p>
          </div>
        </div>
        <dl className="vsm-build-info">
          <div><dt>Version</dt><dd>{BUILD_INFO.version}</dd></div>
          <div><dt>Build</dt><dd>{buildLabel()}</dd></div>
        </dl>
      </section>

      <section className="vsm-settings-group">
        <div className="vsm-settings-group-heading">
          <div>
            <h2>Report an Issue</h2>
            <p>Tell us what went wrong. Reports go straight to the STAGELESS team.</p>
          </div>
        </div>
        <div className="vsm-report">
          <SelectRow label="What is it about?" value={category} onChange={value => setCategory(value as IssueCategory)} options={[...ISSUE_CATEGORIES]} showOptionDescriptions />
          <TextAreaRow label="What happened?" value={summary} onChange={value => { setSummary(value); setState('idle') }} rows={4} placeholder="What you saw, and what you expected" />
          <TextAreaRow label="Steps to reproduce" value={steps} onChange={value => { setSteps(value); setState('idle') }} rows={4} placeholder="Optional: what you did just before" />
          <ToggleRow label="Include Diagnostics" value={includeDiagnostics} onChange={setIncludeDiagnostics}
            description="Adds the build, your computer and graphics, what was active and the recent app log. Links, file paths, sign-in tokens and email addresses are removed; your media is never included." />
          {(error || problem) && <p className="vsm-settings-detail vsm-settings-detail--error" role="alert">{error ?? problem}</p>}
          {state === 'sent' && <NoticeCard tone="success" title="Report sent" role="status">Thank you. The team will look at it.</NoticeCard>}
          <div className="vsm-settings-actions">
            <IconChipButton tone="primary" disabled={state === 'sending' || !summary.trim()} onClick={() => void send()}>{state === 'sending' ? 'Sending…' : 'Send Report'}</IconChipButton>
          </div>
        </div>
      </section>
    </div>
  )
}
