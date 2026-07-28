import { useAppearanceStore } from './appearanceStore'
import type { AppearanceTheme } from './appearanceTypes'

interface ThemeOption {
  id: AppearanceTheme
  label: string
  description: string
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'The current DRMVYZ cyan and emerald interface.',
  },
  {
    id: 'light',
    label: 'Light',
    description: 'A cool studio-light palette with crisp neutral surfaces.',
  },
  {
    id: 'cdj',
    label: 'CDJ',
    description: 'Equipment-style charcoal layers with Pioneer-inspired blue controls.',
  },
]

export function AppearanceSettingsPanel() {
  const { theme, loading, syncing, error, currentUserId, setTheme, retrySync } = useAppearanceStore()

  const status = loading
    ? 'Loading your saved appearance…'
    : syncing
      ? 'Saved locally. Syncing to Supabase…'
      : error
        ? 'Saved locally. Cloud sync needs attention.'
        : currentUserId
          ? 'Saved locally and synced to Supabase.'
          : 'Saved locally on this device.'

  return (
    <div className="vsm-appearance">
      <section className="vsm-settings-group" aria-labelledby="vsm-theme-heading">
        <div className="vsm-settings-group-heading">
          <div>
            <h2 id="vsm-theme-heading">Theme</h2>
            <p>Choose the standard UI surface and control palette used throughout DRMVYZ.</p>
          </div>
        </div>

        <div className="vsm-theme-grid" role="radiogroup" aria-label="Application theme">
          {THEME_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={theme === option.id}
              className={`vsm-theme-card vsm-theme-card--${option.id}${theme === option.id ? ' is-selected' : ''}`}
              onClick={() => void setTheme(option.id)}
            >
              <span className="vsm-theme-preview" aria-hidden="true">
                <span className="vsm-theme-preview-sidebar" />
                <span className="vsm-theme-preview-panel">
                  <span className="vsm-theme-preview-control" />
                  <span className="vsm-theme-preview-control vsm-theme-preview-control--active" />
                </span>
              </span>
              <span className="vsm-theme-copy">
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </span>
              <span className="vsm-theme-radio" aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className={`vsm-theme-sync${error ? ' vsm-theme-sync--error' : ''}`} role="status" aria-live="polite">
          <span>{status}</span>
          {error && (
            <button type="button" onClick={() => void retrySync()}>
              Retry cloud sync
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
