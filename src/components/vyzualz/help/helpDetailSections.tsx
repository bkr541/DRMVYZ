import type { ReactNode } from 'react'
import type { InfoPopoverSection } from '../../shared/InfoPopover'
import type { HelpSearchEntry } from './helpSearchEntries'

type HelpDetail = Pick<HelpSearchEntry, 'whatItDoes' | 'whenToUse' | 'affects' | 'defaultValue' | 'tip'>

const bullets = (items: readonly string[]): ReactNode => items.length === 1
  ? items[0]
  : <ul className="hs-detail-list">{items.map(item => <li key={item}>{item}</li>)}</ul>

/** The sections of a help topic's detail popover, in reading order. A section is left out when the topic has nothing for it,
 * so a short topic gets a short popover. */
export function helpDetailSections(entry: HelpDetail): InfoPopoverSection[] {
  const sections: InfoPopoverSection[] = []
  if (entry.whatItDoes?.length) sections.push({ label: 'What it does', content: bullets(entry.whatItDoes) })
  if (entry.whenToUse) sections.push({ label: 'When to use it', content: entry.whenToUse })
  if (entry.affects?.length) sections.push({ label: 'What it affects', content: bullets(entry.affects) })
  if (entry.defaultValue) sections.push({ label: 'Default', content: entry.defaultValue })
  if (entry.tip) sections.push({ label: 'Tip', content: entry.tip, tone: 'accent' })
  return sections
}
