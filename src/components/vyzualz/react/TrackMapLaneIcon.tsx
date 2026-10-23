import { AppIcon } from '../../shared/icons/AppIcon'

export type TrackMapLaneIconKind = 'beats' | 'sections' | 'energy' | 'ruler' | 'audio' | 'lyrics'

/** Shared Track Map label gutter: icons, typography and padding use the canonical lane classes. */
export function TrackMapLaneIcon({ kind, label }: { kind: TrackMapLaneIconKind; label: string }) {
  const drawings = { beats: 'rhythm', sections: 'layers', energy: 'bars', ruler: 'timeline', audio: 'waveform', lyrics: 'lyrics' } as const
  return <span className="rv-timeline-lane-icon" title={label}><AppIcon kind={drawings[kind]} size={16} /><span>{label}</span></span>
}
