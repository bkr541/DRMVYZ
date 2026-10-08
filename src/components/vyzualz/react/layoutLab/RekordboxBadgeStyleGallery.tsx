import rekordboxLogoUrl from '../../../../assets/rekordbox_logo.svg'

interface RekordboxBadgeConcept {
  id: string
  title: string
  blurb: string
}

const CONCEPTS: RekordboxBadgeConcept[] = [
  {
    id: 'account',
    title: '01 · Integration Account',
    blurb: 'Provider-avatar treatment used by integration directories: a distinct app mark, full wordmark, and a live connected-account state.',
  },
  {
    id: 'bridge',
    title: '02 · Data Bridge',
    blurb: 'Shows the relationship instead of merely labeling it: DRMVYZ and Rekordbox appear as two connected systems with a verified link.',
  },
  {
    id: 'receipt',
    title: '03 · Provenance Receipt',
    blurb: 'A metadata-origin stamp inspired by activity feeds and audit logs, emphasizing where the data came from and when it was synchronized.',
  },
  {
    id: 'coverage',
    title: '04 · Data Coverage',
    blurb: 'Turns the badge into a compact trust summary, showing which Rekordbox fields are actually present instead of a generic connection state.',
  },
  {
    id: 'linked',
    title: '05 · Linked Status',
    blurb: 'Pairs the wordmark with a small LINKED state so the badge communicates both provenance and connection status.',
  },
]

function RekordboxLogo() {
  return <img src={rekordboxLogoUrl} alt="Rekordbox" />
}

function ProviderMark() {
  return (
    <span className="llrb-provider-mark" aria-hidden="true">
      <img src={rekordboxLogoUrl} alt="" />
    </span>
  )
}

function ConceptBadge({ id }: { id: string }) {
  if (id === 'account') {
    return (
      <div className="llrb-account-chip">
        <ProviderMark />
        <span className="llrb-account-copy">
          <RekordboxLogo />
          <small><i /> Connected account</small>
        </span>
        <span className="llrb-account-chevron" aria-hidden="true">›</span>
      </div>
    )
  }
  if (id === 'bridge') {
    return (
      <div className="llrb-bridge-card">
        <span className="llrb-bridge-node llrb-bridge-node--drm">DV</span>
        <span className="llrb-bridge-line"><i /></span>
        <span className="llrb-bridge-node llrb-bridge-node--rb"><ProviderMark /></span>
        <span className="llrb-bridge-copy"><RekordboxLogo /><strong>Library linked</strong><small>Verified metadata route</small></span>
      </div>
    )
  }
  if (id === 'receipt') {
    return (
      <div className="llrb-receipt">
        <span className="llrb-receipt-label">Imported from</span>
        <RekordboxLogo />
        <span className="llrb-receipt-meta">Synced 2m ago · 18 fields</span>
      </div>
    )
  }
  if (id === 'coverage') {
    return (
      <div className="llrb-coverage-card">
        <div className="llrb-coverage-head"><RekordboxLogo /><span><i /> Data ready</span></div>
        <div className="llrb-coverage-fields"><span>BPM ✓</span><span>Key ✓</span><span>Cues ✓</span></div>
      </div>
    )
  }
  return (
    <div className="llrb-badge llrb-badge--linked">
      <RekordboxLogo />
      <span className="llrb-linked-label">Linked</span>
    </div>
  )
}

export function RekordboxBadgeStyleGallery() {
  return (
    <div className="llrb-gallery" aria-label="Rekordbox badge style concepts">
      {CONCEPTS.map(concept => (
        <section key={concept.id} className="lldd-gallery-row llrb-row" data-testid={`rekordbox-badge-concept-${concept.id}`}>
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{concept.title}</span>
            <span className="lldd-gallery-blurb">{concept.blurb}</span>
          </div>
          <div className="llrb-stage">
            <div className="llrb-bpm-context" aria-hidden="true">
              <div><span>BPM</span><strong>128.00</strong></div>
              <i />
            </div>
            <ConceptBadge id={concept.id} />
          </div>
        </section>
      ))}
    </div>
  )
}
