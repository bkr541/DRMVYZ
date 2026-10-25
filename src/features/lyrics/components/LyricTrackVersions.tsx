import { useEffect, useState } from 'react'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { StatusBadge } from '../../../components/vyzualz/react/controls/StatusBadge'
import type { LyricDocumentVersion } from '../lyricManagerTypes'
import { formatRelativeDate, LYRIC_SOURCE_LABELS } from '../utils/lyricManagerFormat'

export interface LyricTrackVersionsProps {
  documents: readonly LyricDocumentVersion[]
  legacyDocuments?: readonly LyricDocumentVersion[]
  loading: boolean
  openDocumentId: string | null
  onSelectDocument: (doc: LyricDocumentVersion) => void
  onDuplicateDocument: (doc: LyricDocumentVersion) => void
  onRenameDocument: (doc: LyricDocumentVersion, title: string) => void
  onActivateDocument: (doc: LyricDocumentVersion) => void
  onDeleteDocument: (doc: LyricDocumentVersion) => void
  onNewDocument: () => void
  onImportDocument: () => void
}

function VersionRow({
  doc,
  legacy = false,
  openDocumentId,
  renaming,
  onStartRename,
  onCancelRename,
  onCommitRename,
  onSelectDocument,
  onDuplicateDocument,
  onActivateDocument,
  onDeleteDocument,
}: {
  doc: LyricDocumentVersion
  legacy?: boolean
  openDocumentId: string | null
  renaming: boolean
  onStartRename: () => void
  onCancelRename: () => void
  onCommitRename: (title: string) => void
  onSelectDocument: () => void
  onDuplicateDocument: () => void
  onActivateDocument: () => void
  onDeleteDocument: () => void
}) {
  const [renameValue, setRenameValue] = useState(doc.title)
  useEffect(() => {
    if (!renaming) setRenameValue(doc.title)
  }, [doc.title, renaming])

  const isOpen = doc.id === openDocumentId
  const title = doc.title || '(Untitled)'
  const details = [
    LYRIC_SOURCE_LABELS[doc.sourceType] ?? doc.sourceType,
    `${doc.cueCount} cues`,
    doc.language,
    doc.documentReviewStatus || 'Review —',
    formatRelativeDate(doc.updatedAt),
  ].filter(Boolean)
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()

  // Same row anatomy and classes as an AudioTrackCard list row, so type size, colour, hairlines and washes match.
  return (
    <div
      className={`vz-track-row vz-track-row--list lmv-version-row${isOpen ? ' vz-track-row--loaded lmv-version-row--open' : ''}${doc.isActive ? ' vz-track-row--active lmv-version-row--active' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isOpen}
      onClick={renaming ? undefined : onSelectDocument}
      onKeyDown={event => {
        if (renaming || event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectDocument() }
      }}
    >
      <div className="vz-track-row-info">
        {renaming ? (
          <div className="lmv-doc-rename-row" onClick={stop}>
            <DreamVizTextInput
              className="lmv-input"
              value={renameValue}
              autoFocus
              onChange={event => setRenameValue(event.target.value)}
              onKeyDown={event => {
                event.stopPropagation()
                if (event.key === 'Enter' && renameValue.trim()) onCommitRename(renameValue.trim())
                if (event.key === 'Escape') onCancelRename()
              }}
              aria-label="Lyric document name"
            />
            <button type="button" className="vz-track-action-btn" onClick={() => onCommitRename(renameValue.trim())} disabled={!renameValue.trim()} aria-label="Save lyric document name"><AppIcon kind="check" size={15} color="currentColor" /></button>
            <button type="button" className="vz-track-action-btn" onClick={onCancelRename} aria-label="Cancel lyric document rename"><AppIcon kind="close" size={15} color="currentColor" /></button>
          </div>
        ) : (
          <div className="vz-track-row-title-line">
            <span className="vz-track-row-title lmv-version-title">{title}</span>
            <span className="vz-track-row-state-badges">
              {isOpen && <StatusBadge tone="loaded">Open</StatusBadge>}
              {doc.isActive && <StatusBadge tone="playing">Active</StatusBadge>}
              {legacy && <StatusBadge tone="legacy">Unattached</StatusBadge>}
            </span>
          </div>
        )}
        {doc.artist && !renaming && <div className="vz-track-row-artist">{doc.artist}</div>}
        {!renaming && <div className="vz-track-row-details">{details.join(' · ')}</div>}
      </div>
      {!renaming && (
        <div className="vz-track-row-actions" role="group" aria-label={`Actions for ${title}`}>
          <button type="button" className="vz-track-action-btn" onClick={event => { stop(event); onStartRename() }} title="Rename" aria-label="Rename">
            <AppIcon kind="edit" size={15} color="currentColor" />
          </button>
          {!legacy && (
            <button type="button" className="vz-track-action-btn" onClick={event => { stop(event); onDuplicateDocument() }} title="Duplicate" aria-label="Duplicate">
              <AppIcon kind="copy" size={15} color="currentColor" />
            </button>
          )}
          {!legacy && !doc.isActive && (
            <button
              type="button"
              className="vz-track-action-btn"
              onClick={event => { stop(event); onActivateDocument() }}
              disabled={doc.cueCount === 0 && !isOpen}
              title={doc.cueCount === 0 && !isOpen ? 'No cues yet — add cues before making this version active' : 'Make Active'}
              aria-label="Make Active"
            >
              <AppIcon kind="check" size={15} color="currentColor" />
            </button>
          )}
          <button type="button" className="vz-track-action-btn lmv-version-delete" onClick={event => { stop(event); onDeleteDocument() }} title="Delete" aria-label="Delete">
            <AppIcon kind="delete" size={15} color="currentColor" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * The selected track's lyric versions, rendered as indented child rows inside its Tracks-list entry
 * (and the unattached legacy documents beneath the list). Replaces the old standalone Versions window.
 */
export function LyricTrackVersions({
  documents,
  legacyDocuments = [],
  loading,
  openDocumentId,
  onSelectDocument,
  onDuplicateDocument,
  onRenameDocument,
  onActivateDocument,
  onDeleteDocument,
  onNewDocument,
  onImportDocument,
}: LyricTrackVersionsProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const renderRow = (doc: LyricDocumentVersion, legacy = false) => (
    <VersionRow
      key={doc.id}
      doc={doc}
      legacy={legacy}
      openDocumentId={openDocumentId}
      renaming={renamingId === doc.id}
      onStartRename={() => setRenamingId(doc.id)}
      onCancelRename={() => setRenamingId(null)}
      onCommitRename={title => {
        if (!title) return
        onRenameDocument(doc, title)
        setRenamingId(null)
      }}
      onSelectDocument={() => onSelectDocument(doc)}
      onDuplicateDocument={() => onDuplicateDocument(doc)}
      onActivateDocument={() => onActivateDocument(doc)}
      onDeleteDocument={() => onDeleteDocument(doc)}
    />
  )

  if (loading && documents.length === 0) {
    return <div className="lmv-track-versions lmv-track-versions--status" role="status">Loading lyric versions…</div>
  }
  if (documents.length === 0 && legacyDocuments.length === 0) return null

  return (
    <div
      className={`lmv-track-versions${documents.length === 0 ? ' lmv-track-versions--legacy' : ''}`}
      role="group"
      aria-label={documents.length === 0 ? 'Legacy lyric documents' : 'Lyric versions'}
    >
      {documents.map(doc => renderRow(doc))}
      {documents.length > 0 && (
        <div className="lmv-track-versions-actions">
          <button type="button" className="lmv-track-versions-add" onClick={onNewDocument} aria-label="New lyric version">
            <AppIcon kind="fileAdd" size={14} color="currentColor" /> New version
          </button>
          <button type="button" className="lmv-track-versions-add" onClick={onImportDocument} aria-label="Import lyric version">
            <AppIcon kind="fileImport" size={14} color="currentColor" /> Import version
          </button>
        </div>
      )}
      {legacyDocuments.length > 0 && (
        <>
          <div className="lmv-doc-section-label">LEGACY UNATTACHED DOCUMENTS</div>
          <div className="lmv-doc-legacy-note">These older documents are not linked to an audio track and remain unattached when saved.</div>
          {legacyDocuments.map(doc => renderRow(doc, true))}
        </>
      )}
    </div>
  )
}
