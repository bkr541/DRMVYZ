import { useEffect, useMemo, useState, type ReactPortal } from 'react'
import { createPortal } from 'react-dom'
import {
  PRIORITY_ONE_HELP_ENTRIES,
  type HelpEntry,
  type HelpId,
  type HelpView,
} from '../../../help/HelpCenter'
import { HelpInfoTrigger } from './HelpInfoTrigger'

const HELP_SLOT_CLASS = 'drm-priority-help-slot'
const HELP_BOUND_CLASS = 'drm-priority-help-bound'

// These entries are intentionally not eligible for registry-driven placement.
// The compact engine switcher carries no help icon, while the generic Pro Scope
// "Preset" entry is rendered only by its explicitly wired control so it cannot
// attach to an unrelated preset label at the visualizer boundary.
const AUTO_BIND_DISABLED_HELP_IDS = new Set<HelpId>([
  'react.shared.engine.engineSelection',
  'react.soundDrawing.proScope.preset',
])

export function isPriorityHelpAutoBindable(helpId: HelpId): boolean {
  return !AUTO_BIND_DISABLED_HELP_IDS.has(helpId)
}
const CANDIDATE_SELECTOR = [
  'label',
  'legend',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  '[aria-label]',
  '[class*="label"]',
  '[class*="title"]',
  '[class*="heading"]',
  '[class*="header"]',
  '[class*="section"]',
  '[class*="tab"]',
].join(',')

const VIEW_ROOT_SELECTORS: Record<HelpView, string> = {
  react: '.rv-shell',
  visualizer: '.az-shell',
  lyricManager: '.lmv-root',
  mediaManager: '.mmv-root',
}

const ENGINE_ID_MAP: Record<string, HelpEntry['engine']> = {
  oscilloscope: 'soundDrawing',
  cinematicPortal: 'cinematicWorlds',
  shaderPads: 'shaderPads',
  canvas: 'canvas',
  laserDmx: 'laserDmx',
  pixGrid: 'pixGrid',
}

const TITLE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'Engine source / scene / world selection': ['Source', 'Scene', 'World', 'Preset'],
  'Collection Browser Context': ['Collections', 'Collection'],
  'Timeline Zoom': ['Zoom'],
  'Look / Scene Scope': ['Save Scope', 'Scope'],
  'Add Vocal Track': ['Add Vocal Track', 'Add Vocal Reference'],
  'Audio': ['Audio', 'Program Audio'],
  'LaserDMX Workspace': ['Workspace'],
  'Texture Layer': ['Texture'],
  'Character Layer': ['Character'],
  'Logo Layer': ['Logo'],
  'Overlay Layer': ['Overlay'],
  'Layer Visibility': ['Show layer', 'Hide layer'],
  'Global FX / Audio Reactivity': ['Enable Global FX', 'Global FX'],
  'Blend Mode': ['Blend'],
  'Color (Master Output)': ['Color'],
  'Sync / BPM Sync': ['Sync', 'BPM Sync'],
  'Media Type Tabs': ['Media Library', 'All'],
  'Energy': ['Show energy', 'Hide energy'],
  'Cue Points': ['Show cue points', 'Hide cue points'],
  'Rotation': ['Rot°'],
}

interface BoundHelpTarget {
  helpId: HelpId
  candidate: HTMLElement
  host: HTMLElement
  slot: HTMLElement
  disposeActivation: () => void
  currentValue?: string
  currentValueLabel?: 'Current value' | 'Status'
  currentValueTone?: 'default' | 'accent' | 'success' | 'warning'
}

export interface PriorityOneHelpLayerProps {
  view: HelpView
}

function normalizeText(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9%/+\- ]/g, '')
    .trim()
    .toLocaleLowerCase()
}

function directText(element: Element): string {
  return Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function candidateTexts(element: Element): readonly string[] {
  const values = new Set<string>()
  const ownText = directText(element)
  const ariaLabel = element.getAttribute('aria-label') ?? ''
  const dataLabel = element.getAttribute('data-label') ?? ''
  const title = element.getAttribute('title') ?? ''
  const textContent = element.children.length <= 2 ? element.textContent ?? '' : ''
  for (const value of [ownText, ariaLabel, dataLabel, title, textContent]) {
    const normalized = normalizeText(value)
    if (normalized) values.add(normalized)
  }
  return [...values]
}

function entryTitleKeys(entry: HelpEntry): readonly string[] {
  const values = [entry.title, ...(TITLE_ALIASES[entry.title] ?? [])]
  return [...new Set(values.map(normalizeText).filter(Boolean))]
}

function engineForCandidate(candidate: Element): HelpEntry['engine'] | undefined {
  const engineRoot = candidate.closest<HTMLElement>('[data-help-engine]')
  const engineId = engineRoot?.dataset.helpEngine
  if (engineId && ENGINE_ID_MAP[engineId]) return ENGINE_ID_MAP[engineId]

  const context = normalizeText(
    [candidate.className, candidate.parentElement?.className, candidate.closest('section, fieldset, aside')?.className]
      .filter(value => typeof value === 'string')
      .join(' '),
  )
  if (context.includes('pixgrid') || context.includes('pix-grid')) return 'pixGrid'
  if (context.includes('shader')) return 'shaderPads'
  if (context.includes('cinematic')) return 'cinematicWorlds'
  if (context.includes('canvas')) return 'canvas'
  if (context.includes('laser')) return 'laserDmx'
  if (context.includes('sound') || context.includes('oscillator')) return 'soundDrawing'
  return undefined
}

function contextText(candidate: Element): string {
  const chunks: string[] = []
  let node: Element | null = candidate
  for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
    if (typeof node.className === 'string') chunks.push(node.className)
    for (const attribute of ['aria-label', 'data-help-context', 'data-panel', 'data-section']) {
      const value = node.getAttribute(attribute)
      if (value) chunks.push(value)
    }
    for (const child of Array.from(node.children).slice(0, 4)) {
      if (/^(H[1-6]|LEGEND)$/i.test(child.tagName) || /title|heading|section/i.test(String(child.className))) {
        chunks.push(directText(child) || child.textContent || '')
      }
    }
  }
  return normalizeText(chunks.join(' '))
}

function groupScore(entry: HelpEntry, candidate: Element): number {
  const context = contextText(candidate)
  if (!context) return 0
  const tokens = normalizeText(entry.group)
    .split(' ')
    .filter(token => token.length > 3 && !['parent', 'group', 'controls', 'control'].includes(token))
  return tokens.reduce((score, token) => score + (context.includes(token) ? 2 : 0), 0)
}

function entryScore(entry: HelpEntry, candidate: Element, texts: readonly string[]): number {
  const keys = entryTitleKeys(entry)
  const exact = keys.some(key => texts.includes(key))
  const contained = keys.some(key => texts.some(text => text.includes(key) || key.includes(text)))
  if (!exact && !contained) return Number.NEGATIVE_INFINITY

  let score = exact ? 100 : 35
  const candidateEngine = engineForCandidate(candidate)
  if (entry.engine === 'shared') score += 3
  else if (candidateEngine && entry.engine === candidateEngine) score += 28
  else if (candidateEngine && entry.engine?.startsWith(candidateEngine)) score += 20
  else if (candidateEngine && entry.engine && entry.engine !== candidateEngine) score -= 45
  score += groupScore(entry, candidate)

  if (candidate.matches('label, legend, h1, h2, h3, h4, h5, h6')) score += 12
  if (candidate.hasAttribute('aria-label')) score += 5
  if (candidate.closest('[role="option"], [role="menu"], [role="listbox"], .dropdown-menu, .az-dropdown-menu')) score -= 100
  return score
}

function isCandidateUsable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  if (element.closest('.drm-info-popover, .drm-help-info-trigger, .drm-priority-help-slot')) return false
  if (element.closest('[role="option"], option')) return false
  if (element.dataset.helpDecoration === 'ignore') return false
  if (element.closest('[aria-hidden="true"]')) return false
  return true
}

function findTargetHost(candidate: HTMLElement): HTMLElement {
  const preferred = candidate.closest<HTMLElement>(
    '.rv-ctrl-row, .rv-ctrl-toggle-row, .rv-ctrl-section, .vz-ml-insp-row, .vz-cg-slider-row, .vz-li-row2, .vz-layer-item-header, .vz-control-row, .vz-help-row, .lmv-field, .lmv-control, .mmv-field, .mmv-control',
  )
  if (preferred) return preferred
  const parent = candidate.parentElement
  if (parent?.matches('button, label, a')) return parent.parentElement ?? parent
  return parent ?? candidate
}

function positionSlot(slot: HTMLElement, candidate: HTMLElement, host: HTMLElement): void {
  const hostRect = host.getBoundingClientRect()
  const candidateRect = candidate.getBoundingClientRect()
  const left = Math.max(0, candidateRect.right - hostRect.left + 5)
  const top = Math.max(0, candidateRect.top - hostRect.top + candidateRect.height / 2)
  slot.style.left = `${Math.round(left)}px`
  slot.style.top = `${Math.round(top)}px`
}

function activationTargetFor(candidate: HTMLElement, host: HTMLElement): HTMLElement {
  const interactive = candidate.closest<HTMLElement>(
    'button, a, label, input, select, textarea, [role="button"], [role="radio"], [role="tab"], [role="switch"], [role="checkbox"], [role="slider"]',
  )
  return interactive && host.contains(interactive) ? interactive : candidate
}

/**
 * Keeps a registry-injected help trigger tied to its matched control rather
 * than to the potentially shared positioning host. A short leave delay lets
 * the pointer travel from the control to its floating icon without the icon
 * disappearing underneath it.
 */
export function bindPriorityHelpActivation(
  slot: HTMLElement,
  candidate: HTMLElement,
  host: HTMLElement,
): () => void {
  const activationTarget = activationTargetFor(candidate, host)
  let targetPointer = false
  let slotPointer = false
  let targetFocus = false
  let slotFocus = false
  let deactivateTimer: number | null = null

  const clearDeactivateTimer = () => {
    if (deactivateTimer == null) return
    window.clearTimeout(deactivateTimer)
    deactivateTimer = null
  }

  const update = () => {
    const active = targetPointer || slotPointer || targetFocus || slotFocus
    if (active) {
      clearDeactivateTimer()
      slot.dataset.active = 'true'
      return
    }
    clearDeactivateTimer()
    deactivateTimer = window.setTimeout(() => {
      deactivateTimer = null
      if (!targetPointer && !slotPointer && !targetFocus && !slotFocus) {
        slot.dataset.active = 'false'
      }
    }, 120)
  }

  const onTargetPointerEnter = () => { targetPointer = true; update() }
  const onTargetPointerLeave = () => { targetPointer = false; update() }
  const onSlotPointerEnter = () => { slotPointer = true; update() }
  const onSlotPointerLeave = () => { slotPointer = false; update() }
  const onTargetFocusIn = () => { targetFocus = true; update() }
  const onTargetFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && activationTarget.contains(event.relatedTarget)) return
    targetFocus = false
    update()
  }
  const onSlotFocusIn = () => { slotFocus = true; update() }
  const onSlotFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && slot.contains(event.relatedTarget)) return
    slotFocus = false
    update()
  }

  slot.dataset.active = 'false'
  activationTarget.addEventListener('pointerenter', onTargetPointerEnter)
  activationTarget.addEventListener('pointerleave', onTargetPointerLeave)
  activationTarget.addEventListener('focusin', onTargetFocusIn)
  activationTarget.addEventListener('focusout', onTargetFocusOut)
  slot.addEventListener('pointerenter', onSlotPointerEnter)
  slot.addEventListener('pointerleave', onSlotPointerLeave)
  slot.addEventListener('focusin', onSlotFocusIn)
  slot.addEventListener('focusout', onSlotFocusOut)

  return () => {
    clearDeactivateTimer()
    activationTarget.removeEventListener('pointerenter', onTargetPointerEnter)
    activationTarget.removeEventListener('pointerleave', onTargetPointerLeave)
    activationTarget.removeEventListener('focusin', onTargetFocusIn)
    activationTarget.removeEventListener('focusout', onTargetFocusOut)
    slot.removeEventListener('pointerenter', onSlotPointerEnter)
    slot.removeEventListener('pointerleave', onSlotPointerLeave)
    slot.removeEventListener('focusin', onSlotFocusIn)
    slot.removeEventListener('focusout', onSlotFocusOut)
  }
}

function hasExistingExplicitBinding(candidate: HTMLElement, helpId: string): boolean {
  const host = findTargetHost(candidate)
  return Array.from(host.querySelectorAll<HTMLElement>(`.drm-help-info-trigger[data-help-id="${helpId}"]`))
    .some(trigger => !trigger.closest(`.${HELP_SLOT_CLASS}`))
}

function extractCurrentValue(candidate: HTMLElement): Pick<BoundHelpTarget, 'currentValue' | 'currentValueLabel' | 'currentValueTone'> {
  const host = findTargetHost(candidate)
  const control = host.querySelector<HTMLElement>('input, select, output, [role="switch"], [aria-checked], [aria-valuenow]')
  if (!control) return {}

  if (control instanceof HTMLInputElement) {
    if (control.type === 'checkbox') {
      return {
        currentValue: control.checked ? 'On' : 'Off',
        currentValueLabel: 'Status',
        currentValueTone: control.checked ? 'success' : 'default',
      }
    }
    if (control.value) return { currentValue: control.value }
  }
  if (control instanceof HTMLSelectElement) {
    return { currentValue: control.selectedOptions[0]?.textContent?.trim() || control.value }
  }
  const checked = control.getAttribute('aria-checked')
  if (checked != null) {
    const on = checked === 'true'
    return {
      currentValue: on ? 'On' : 'Off',
      currentValueLabel: 'Status',
      currentValueTone: on ? 'success' : 'default',
    }
  }
  const numeric = control.getAttribute('aria-valuenow')
  if (numeric) return { currentValue: numeric }
  const output = control.textContent?.trim()
  return output ? { currentValue: output } : {}
}

function disposeTargets(targets: readonly BoundHelpTarget[]): void {
  for (const target of targets) {
    const host = target.slot.parentElement
    target.disposeActivation()
    target.slot.remove()
    if (host && !host.querySelector(`.${HELP_SLOT_CLASS}`)) {
      host.classList.remove(HELP_BOUND_CLASS)
    }
  }
}

export function resolvePriorityOneHelpMatches(
  root: ParentNode,
  entries: readonly HelpEntry[],
): readonly { entry: HelpEntry; candidate: HTMLElement }[] {
  const candidates = Array.from(root.querySelectorAll(CANDIDATE_SELECTOR))
    .filter(isCandidateUsable)
    .map(candidate => ({ candidate, texts: candidateTexts(candidate) }))
    .filter(item => item.texts.length > 0)

  const scoredPairs: { entry: HelpEntry; candidate: HTMLElement; score: number }[] = []
  for (const entry of entries) {
    for (const item of candidates) {
      if (hasExistingExplicitBinding(item.candidate, entry.id)) continue
      const score = entryScore(entry, item.candidate, item.texts)
      if (Number.isFinite(score) && score >= 60) {
        scoredPairs.push({ entry, candidate: item.candidate, score })
      }
    }
  }

  scoredPairs.sort((left, right) => right.score - left.score)
  const usedCandidates = new Set<HTMLElement>()
  const usedEntries = new Set<string>()
  const matches: { entry: HelpEntry; candidate: HTMLElement }[] = []
  for (const pair of scoredPairs) {
    if (usedCandidates.has(pair.candidate) || usedEntries.has(pair.entry.id)) continue
    usedCandidates.add(pair.candidate)
    usedEntries.add(pair.entry.id)
    matches.push({ entry: pair.entry, candidate: pair.candidate })
  }
  return matches
}

export function PriorityOneHelpLayer({ view }: PriorityOneHelpLayerProps) {
  const entries = useMemo(
    () => PRIORITY_ONE_HELP_ENTRIES.filter(
      entry => entry.view === view && isPriorityHelpAutoBindable(entry.id),
    ),
    [view],
  )
  const [targets, setTargets] = useState<readonly BoundHelpTarget[]>([])

  useEffect(() => {
    let disposed = false
    let animationFrame = 0
    let currentTargets: readonly BoundHelpTarget[] = []

    const scan = () => {
      animationFrame = 0
      if (disposed) return
      const root = document.querySelector(VIEW_ROOT_SELECTORS[view])
      if (!root) return

      const matches = resolvePriorityOneHelpMatches(root, entries)
      const unchanged = matches.length === currentTargets.length
        && matches.every(({ entry, candidate }) => currentTargets.some(target => target.helpId === entry.id && target.candidate === candidate && target.slot.isConnected))
      if (unchanged) {
        let valuesChanged = false
        currentTargets = currentTargets.map(target => {
          positionSlot(target.slot, target.candidate, target.host)
          const nextValue = extractCurrentValue(target.candidate)
          if (
            nextValue.currentValue === target.currentValue
            && nextValue.currentValueLabel === target.currentValueLabel
            && nextValue.currentValueTone === target.currentValueTone
          ) {
            return target
          }
          valuesChanged = true
          return { ...target, ...nextValue }
        })
        if (valuesChanged) setTargets(currentTargets)
        return
      }

      disposeTargets(currentTargets)
      currentTargets = matches.map(({ entry, candidate }) => {
        const host = findTargetHost(candidate)
        const slot = document.createElement('span')
        slot.className = HELP_SLOT_CLASS
        slot.dataset.helpId = entry.id
        slot.dataset.helpDecoration = 'slot'
        host.classList.add(HELP_BOUND_CLASS)
        host.appendChild(slot)
        positionSlot(slot, candidate, host)
        const disposeActivation = bindPriorityHelpActivation(slot, candidate, host)
        return {
          helpId: entry.id as HelpId,
          candidate,
          host,
          slot,
          disposeActivation,
          ...extractCurrentValue(candidate),
        }
      })
      setTargets(currentTargets)
    }

    const requestFrame = window.requestAnimationFrame?.bind(window) ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16))
    const cancelFrame = window.cancelAnimationFrame?.bind(window) ?? ((handle: number) => window.clearTimeout(handle))
    const scheduleScan = () => {
      if (!animationFrame) animationFrame = requestFrame(scan)
    }

    const observer = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(mutations => {
          if (mutations.every(mutation => (mutation.target as Element).closest?.(`.${HELP_SLOT_CLASS}, .drm-info-popover`))) return
          scheduleScan()
        })
      : null
    observer?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-expanded', 'aria-checked', 'aria-valuenow', 'data-help-engine'] })
    window.addEventListener('resize', scheduleScan)
    window.addEventListener('drm-help-rescan', scheduleScan)
    document.addEventListener('input', scheduleScan, true)
    document.addEventListener('change', scheduleScan, true)
    scheduleScan()

    return () => {
      disposed = true
      if (animationFrame) cancelFrame(animationFrame)
      observer?.disconnect()
      window.removeEventListener('resize', scheduleScan)
      window.removeEventListener('drm-help-rescan', scheduleScan)
      document.removeEventListener('input', scheduleScan, true)
      document.removeEventListener('change', scheduleScan, true)
      disposeTargets(currentTargets)
    }
  }, [entries, view])

  return targets.map((target): ReactPortal => createPortal(
    <HelpInfoTrigger
      key={target.helpId}
      helpId={target.helpId}
      currentValue={target.currentValue}
      currentValueLabel={target.currentValueLabel}
      currentValueTone={target.currentValueTone}
    />,
    target.slot,
    target.helpId,
  ))
}
