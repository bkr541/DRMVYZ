import { useState } from 'react'
import { NoticeCard, type NoticeCardTone } from '../controls/NoticeCard'
import { Collapsible } from '../ReactControlRows'

// ── Layout Lab · left window · NOTICE ───────────────────────────────────────
//
// Production's `NoticeCard` (the canonical notification card: a tone-coloured accent bar, icon, title, body, and the
// optional dismiss and open actions) shown in each of its four looks: Info, Success, Warning and Error (the destructive
// look), one parent group per tone, each with the card's variants stacked: title and body, title only, with dismiss
// and with dismiss and open. The cards are the real component with real tone text colours; dismiss (a hover control, as
// in the app) hides a card and open does nothing here. Switching tabs restores the dismissed cards. No store or drawer.

interface ToneSample {
  tone: NoticeCardTone
  label: string
  title: string
  body: string
  titleOnly: string
}

const TONES: ToneSample[] = [
  { tone: 'info', label: 'Info', title: 'Runtime state synchronized', titleOnly: 'Layers are read-only for this preset', body: 'Structured visuals share one authored model with modulation routes, performance rules, cameras and the authoritative timeline.' },
  { tone: 'success', label: 'Success', title: 'Preset saved', titleOnly: 'Track analysis complete', body: 'Electric Storm was saved to your library and is ready to load from the Presets tab.' },
  { tone: 'warning', label: 'Warning', title: 'Audio source unavailable', titleOnly: 'Beat grid is using a temporary tempo', body: 'The selected input stopped reporting a signal. Reconnect the device or choose another source in the Audio dock.' },
  { tone: 'error', label: 'Error', title: 'Failed to load track', titleOnly: 'Output window was blocked', body: 'The file could not be decoded. Check that it is a supported audio format and try loading it again.' },
]

export function LayoutLabNoticeTab() {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const dismiss = (id: string) => setDismissed(current => new Set(current).add(id))
  const dismissible = (id: string) => ({ onDismiss: () => dismiss(id), dismissLabel: 'Dismiss notice' })

  return (
    <div className="rv-ctrl-group" data-layout-lab-notices>
      {TONES.map(({ tone, label, title, body, titleOnly }) => {
        const id = (variant: string) => `${tone}:${variant}`
        const show = (variant: string) => !dismissed.has(id(variant))
        return (
          <Collapsible key={tone} label={label}>
            {show('body') && <NoticeCard tone={tone} title={title}>{body}</NoticeCard>}
            {show('title') && <NoticeCard tone={tone} title={titleOnly} />}
            {show('dismiss') && <NoticeCard tone={tone} title={title} {...dismissible(id('dismiss'))}>{body}</NoticeCard>}
            {show('open') && (
              <NoticeCard tone={tone} title={title} {...dismissible(id('open'))} onOpen={() => {}} openLabel="Open details">{body}</NoticeCard>
            )}
          </Collapsible>
        )
      })}
    </div>
  )
}
