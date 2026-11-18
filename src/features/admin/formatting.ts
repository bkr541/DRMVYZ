const DATE = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const DATE_TIME = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** "Jun 10, 2026", or an em dash for a missing or invalid value. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? '—' : DATE.format(time)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? '—' : DATE_TIME.format(time)
}
