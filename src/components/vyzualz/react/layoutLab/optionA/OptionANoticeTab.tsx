import { useState, type ReactNode } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { TONES } from '../LayoutLabNoticeTab'
import { OaGroup } from './oaControls'

// ── Option A · Notice tab ──────────────────────────────────────────────────────────────────────────────────────
//
// The four notice tones (Info, Success, Warning, Error), each as one rack group with the card's four variants: title and
// body, title only, with dismiss, and with dismiss and open. The card is Option A's own construction: an inset well with a
// lit tone tile on the left (the tone is the tile's colour and glow, not a stripe), the title and body in the middle and
// the dismiss and open keys on the right. Same copy and the same behaviour as the production tab: dismiss hides a card for
// as long as the tab is open, and open does nothing in the lab.

type Tone = typeof TONES[number]['tone']

function OaNotice({ tone, title, children, onDismiss, onOpen }: {
  tone: Tone
  title: string
  children?: ReactNode
  onDismiss?: () => void
  onOpen?: () => void
}) {
  return (
    <div className="oa-notice" data-tone={tone} role="status">
      <span className="oa-notice__tile" aria-hidden="true"><AppIcon kind="info" size={18} /></span>
      <span className="oa-notice__copy">
        <strong className="oa-notice__title">{title}</strong>
        {children != null && <span className="oa-notice__body">{children}</span>}
      </span>
      {(onDismiss || onOpen) && (
        <span className="oa-notice__actions">
          {onDismiss && <button type="button" className="oa-iconkey oa-iconkey--sm" onClick={onDismiss} aria-label="Dismiss notice" title="Dismiss notice"><AppIcon kind="close" size={12} /></button>}
          {onOpen && <button type="button" className="oa-iconkey oa-iconkey--sm" onClick={onOpen} aria-label="Open details" title="Open details"><AppIcon kind="open" size={12} /></button>}
        </span>
      )}
    </div>
  )
}

export function OptionANoticeTab() {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const dismiss = (id: string) => setDismissed(current => new Set(current).add(id))

  return (
    <div className="oa-stack" data-layout-lab-notices>
      {TONES.map(({ tone, label, title, body, titleOnly }) => {
        const id = (variant: string) => `${tone}:${variant}`
        const show = (variant: string) => !dismissed.has(id(variant))
        return (
          <OaGroup key={tone} label={label}>
            {show('body') && <OaNotice tone={tone} title={title}>{body}</OaNotice>}
            {show('title') && <OaNotice tone={tone} title={titleOnly} />}
            {show('dismiss') && <OaNotice tone={tone} title={title} onDismiss={() => dismiss(id('dismiss'))}>{body}</OaNotice>}
            {show('open') && <OaNotice tone={tone} title={title} onDismiss={() => dismiss(id('open'))} onOpen={() => {}}>{body}</OaNotice>}
          </OaGroup>
        )
      })}
    </div>
  )
}
