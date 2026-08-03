import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import learnIconUrl from '../../../assets/help/learn-svgrepo-com.svg'
import { useContextualHelpStore } from '../../../features/contextualHelp/contextualHelpStore'
import { getHelpEntry, type HelpId } from '../../../help/HelpCenter'
import {
  InfoPopover,
  type InfoPopoverSection,
  type InfoPopoverTone,
} from './InfoPopover'

export interface HelpInfoTriggerProps {
  helpId: HelpId
  currentValue?: ReactNode
  currentValueLabel?: 'Current value' | 'Status'
  currentValueTone?: InfoPopoverTone
  placement?: 'auto' | 'right' | 'left' | 'above' | 'below'
}

export interface HelpLabelProps extends HelpInfoTriggerProps {
  children: ReactNode
  className?: string
}

type SectionGlyphKind = 'value' | 'behavior' | 'range' | 'use' | 'tip'

const HELP_POPOVER_OPEN_EVENT = 'drm-help-popover-open'

function SectionGlyph({ kind }: { kind: SectionGlyphKind }) {
  if (kind === 'value') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
        <circle cx="10" cy="10" r="2" />
      </svg>
    )
  }

  if (kind === 'behavior') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7.2 12.8 12.8 7.2M6.1 8.6 4.7 10a3 3 0 0 0 4.2 4.2l1.4-1.4M13.9 11.4l1.4-1.4a3 3 0 0 0-4.2-4.2L9.7 7.2" />
      </svg>
    )
  }

  if (kind === 'range') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 10h12M4 10l3-3M4 10l3 3M16 10l-3-3M16 10l-3 3" />
      </svg>
    )
  }

  if (kind === 'use') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2.8v2.1M10 15.1v2.1M2.8 10h2.1M15.1 10h2.1M4.9 4.9l1.5 1.5M13.6 13.6l1.5 1.5M15.1 4.9l-1.5 1.5M6.4 13.6l-1.5 1.5" />
        <circle cx="10" cy="10" r="3.2" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M8.2 7.8a2 2 0 1 1 3.1 1.7c-.9.6-1.3 1-1.3 2M10 14.2h.01" />
    </svg>
  )
}

function renderLines(lines: readonly string[]): ReactNode {
  if (lines.length === 1) return lines[0]
  return (
    <ul>
      {lines.map((line) => <li key={line}>{line}</li>)}
    </ul>
  )
}

export function HelpInfoTrigger({
  helpId,
  currentValue,
  currentValueLabel = 'Current value',
  currentValueTone = 'default',
  placement = 'auto',
}: HelpInfoTriggerProps) {
  const infoEnabled = useContextualHelpStore(state => state.infoEnabled)
  const entry = getHelpEntry(helpId)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const triggerToken = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const closeOtherPopover = (event: Event) => {
      const requestedTrigger = (event as CustomEvent<string>).detail
      if (requestedTrigger !== triggerToken) setOpen(false)
    }
    window.addEventListener(HELP_POPOVER_OPEN_EVENT, closeOtherPopover)
    return () => window.removeEventListener(HELP_POPOVER_OPEN_EVENT, closeOtherPopover)
  }, [triggerToken])

  useEffect(() => {
    if (!infoEnabled) setOpen(false)
  }, [infoEnabled])

  const sections = useMemo<readonly InfoPopoverSection[]>(() => {
    if (!entry) return []

    const nextSections: InfoPopoverSection[] = []
    if (currentValue != null) {
      nextSections.push({
        label: currentValueLabel,
        content: currentValue,
        tone: currentValueTone,
        icon: <SectionGlyph kind="value" />,
      })
    }

    const whatItDoes = entry.whatItDoes ?? []
    if (whatItDoes.length > 0) {
      nextSections.push({
        label: 'What it does',
        content: renderLines(whatItDoes),
        icon: <SectionGlyph kind="behavior" />,
      })
    }

    if (entry.range) {
      nextSections.push({
        label: 'Range',
        content: entry.range,
        icon: <SectionGlyph kind="range" />,
      })
    }

    if (entry.recommendedRange) {
      nextSections.push({
        label: 'Recommended range',
        content: entry.recommendedRange,
        icon: <SectionGlyph kind="range" />,
      })
    }

    if (entry.whenToUse) {
      nextSections.push({
        label: 'When to use',
        content: entry.whenToUse,
        icon: <SectionGlyph kind="use" />,
      })
    }

    if (entry.tip) {
      nextSections.push({
        label: 'Tip',
        content: entry.tip,
        icon: <SectionGlyph kind="tip" />,
      })
    }

    return nextSections
  }, [currentValue, currentValueLabel, currentValueTone, entry])

  if (!entry || !infoEnabled) return null

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="drm-help-info-trigger"
        data-help-id={helpId}
        data-open={open ? 'true' : 'false'}
        aria-label={`Learn about ${entry.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => {
            const nextOpen = !value
            if (nextOpen) {
              window.dispatchEvent(new CustomEvent<string>(HELP_POPOVER_OPEN_EVENT, { detail: triggerToken }))
            }
            return nextOpen
          })
        }}
      >
        <img src={learnIconUrl} alt="" aria-hidden="true" />
      </button>
      <InfoPopover
        id={`help-${helpId.replace(/\./g, '-')}`}
        open={open}
        anchorRef={anchorRef}
        title={entry.title}
        headerIcon={<img src={learnIconUrl} alt="" />}
        description={entry.summary}
        sections={sections}
        placement={placement}
        align="center"
        width={400}
        maxHeight={540}
        onOpenChange={setOpen}
      />
    </>
  )
}

export function HelpLabel({
  children,
  className,
  ...triggerProps
}: HelpLabelProps) {
  return (
    <span className={['drm-help-label', className].filter(Boolean).join(' ')}>
      <span className="drm-help-label__text">{children}</span>
      <HelpInfoTrigger {...triggerProps} />
    </span>
  )
}
