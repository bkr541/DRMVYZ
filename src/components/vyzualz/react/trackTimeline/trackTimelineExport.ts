import { strToU8, zipSync } from 'fflate'
import { downloadBlob } from '../../../../utils/wavExport'
import type { TrackTimelineExportData } from './trackTimelineExportData'
import reportTemplate from './trackTimelineReport.html?raw'

export function createTrackTimelineArchive(data: TrackTimelineExportData) {
  // The same JSON bytes go in both files. Escaping < keeps metadata out of the HTML parser.
  const json = JSON.stringify(data).replaceAll('<', '\\u003c')
  const html = reportTemplate.replace('__DRMVYZ_TRACK_TIMELINE_DATA__', () => json)
  const zip = zipSync({ 'track-timeline.html': strToU8(html), 'track-timeline.json': strToU8(json) }, { level: 4 })
  return new Blob([zip], { type: 'application/zip' })
}

export function downloadTrackTimelineExport(data: TrackTimelineExportData, ownerDocument: Document) {
  const title = data.track.title.replace(/[<>:"/\\|?*\p{Cc}]/gu, '_').trim().replace(/[. ]+$/u, '')
  const safeTitle = Array.from(title).slice(0, 72).join('')
  const filename = safeTitle ? `${safeTitle} - Track Timeline.zip` : 'Track Timeline.zip'
  downloadBlob(createTrackTimelineArchive(data), filename, ownerDocument)
}
