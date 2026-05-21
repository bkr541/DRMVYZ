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
}

export function RailTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className = '',
}: RailTabsProps<T>) {
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
