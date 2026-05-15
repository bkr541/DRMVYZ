interface Props {
  aspect: '9:16' | '1:1' | '16:9'
  primaryColor: string
}

export function SafeMargins({ aspect, primaryColor }: Props) {
  // Draws crop guide overlay for social media platforms
  const margins: Record<typeof aspect, { label: string; color: string }> = {
    '9:16': { label: 'TikTok / Reels 9:16', color: '#ff6b9d' },
    '1:1':  { label: 'Square 1:1',          color: '#ffcc00'  },
    '16:9': { label: 'YouTube 16:9',         color: primaryColor },
  }
  const info = margins[aspect]

  return (
    <div className="safe-margins-overlay" aria-hidden>
      <div className={`safe-frame safe-${aspect.replace(':', 'x')}`} style={{ borderColor: info.color }}>
        <span className="safe-label" style={{ color: info.color, borderColor: info.color }}>
          {info.label}
        </span>
      </div>
    </div>
  )
}
