import trackTimelineIconSvg from '../../../../assets/ttl_2.svg?raw'

export function TrackTimelineIcon() {
  return (
    <span
      className="track-timeline-icon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: trackTimelineIconSvg }}
    />
  )
}
