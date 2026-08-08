import './canonicalControls.css'

export interface UnderlineTabOption<T extends string> {
  id: T
  label: string
  disabled?: boolean
}

export interface UnderlineTabsProps<T extends string> {
  tabs: readonly UnderlineTabOption<T>[]
  activeTab: T
  onChange: (tab: T) => void
  ariaLabel: string
  className?: string
}

/**
 * Canonical DRMVYZ tab strip from Layout Lab's "Underline Tabs" winner —
 * borderless labels with a cyan underline that grows in under the active
 * tab. Same tabs/activeTab/onChange/ariaLabel shape as RailTabs and
 * PanelSubtabs so it can drop into either.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className = '',
}: UnderlineTabsProps<T>) {
  return (
    <div className={`dv-underline-tabs${className ? ` ${className}` : ''}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          disabled={tab.disabled}
          className={`dv-underline-tab${activeTab === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
