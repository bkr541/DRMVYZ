import base from '../../../styles.css?inline'
import analyzer from '../../../styles/analyzer.css?inline'
import appearance from '../../../styles/appearance.css?inline'
import vyzualz from '../../../styles/vyzualz.css?inline'
import react from '../../../styles/reactView.css?inline'
import floating from '../../../styles/floatingWorkspace.css?inline'
import controls from '../react/controls/canonicalControls.css?inline'
import dropdown from '../../shared/Dropdown/Dropdown.css?inline'
import groups from '../react/DualRailCollapsible.css?inline'
import headers from './RailWindowHeader.css?inline'
import toolbar from './HeaderControlGroup.css?inline'
import pads from '../react/controls/performancePad.css?inline'
import icons from '../../shared/icons/appIcon.css?inline'
import tabs from '../../../styles/tabRows.css?inline'
import typography from '../../../styles/typography.css?inline'

/** The popup uses production CSS, rather than approximating its presentation. */
export const mobilePreviewProductionStyles = [base, analyzer, appearance, vyzualz, react, floating, controls, dropdown, groups, headers, toolbar, pads, icons, tabs, typography].join('\n')

/** Copy typography/theme tokens and font definitions into the separate document. */
export function mirrorMobilePreviewAppearance(source: Document, target: Document): () => void {
  const sync = () => {
    const theme = source.querySelector('[data-theme]')?.getAttribute('data-theme') ?? 'dark'
    target.documentElement.setAttribute('data-theme', theme)
    const computed = source.defaultView?.getComputedStyle(source.documentElement)
    if (computed) for (let index = 0; index < computed.length; index++) {
      const name = computed.item(index)
      if (name.startsWith('--')) target.documentElement.style.setProperty(name, computed.getPropertyValue(name))
    }
  }
  for (const link of source.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    // Includes the app's Google Fonts stylesheet with its exact weights.
    const copy = target.createElement('link'); copy.rel = 'stylesheet'; copy.href = link.href
    target.head.append(copy)
  }
  for (const sheet of Array.from(source.styleSheets)) {
    try {
      const fonts = Array.from(sheet.cssRules).filter(rule => rule.type === 5).map(rule => rule.cssText)
      if (fonts.length) { const style = target.createElement('style'); style.textContent = fonts.join('\n'); target.head.append(style) }
    } catch { /* Cross-origin font CSS is loaded through its cloned link. */ }
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(source.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
  return () => observer.disconnect()
}
