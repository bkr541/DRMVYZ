import { UnderlineTabs } from '../react/controls/UnderlineTabs'

export type RailTabOption<T extends string> = {
  id: T
  label: string
  disabled?: boolean
}

type RailTabsProps<T extends string> = {
  tabs: RailTabOption<T>[]
  activeTab: T
  onChange: (tab: T) => void
  ariaLabel: string
  className?: string
  /** 'boxed' (default) is VYZUALZ's original bordered-pill tab strip. 'underline'
   *  is the canonical Underline Tabs treatment, opt-in per call site so this
   *  shared component doesn't silently restyle every screen that uses it. */
  variant?: 'boxed' | 'underline'
}

export function RailTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className = '',
  variant = 'boxed',
}: RailTabsProps<T>) {
  if (variant === 'underline') {
    return <UnderlineTabs tabs={tabs} activeTab={activeTab} onChange={onChange} ariaLabel={ariaLabel} className={className} />
  }

  return (
    <div
      className={`vz-panel-tabs${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={activeTab === tab.id ? 'is-active' : ''}
          aria-selected={activeTab === tab.id}
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
