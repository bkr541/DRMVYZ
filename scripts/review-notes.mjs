// Works through the temporary review notes in .review-notes/ (written by the dev-only notes panel; see docs/review-notes.md).
//   npm run review-notes -- list              every open note, with its file and screenshot
//   npm run review-notes -- list --all        open and done
//   npm run review-notes -- done <id> "what was changed"
//   npm run review-notes -- reopen <id>
import { ReviewNotesStore } from '../src/dev/reviewNotes/reviewNotesStore.ts'

const root = process.cwd()
const store = new ReviewNotesStore(root)
const [command = 'list', ...rest] = process.argv.slice(2)

if (command === 'list') {
  const all = rest.includes('--all')
  const entries = await store.readAll()
  let shown = 0
  for (const { fileName, file } of entries) {
    const notes = file.notes.filter(note => all || note.status === 'open')
    if (!notes.length) continue
    console.log(`\n## ${file.presetName}  [${file.engine}]  ${file.presetId}\n   .review-notes/${fileName}`)
    for (const note of notes) {
      shown++
      console.log(`\n- ${note.id} [${note.status}] ${note.createdAt}`)
      console.log(note.text.trim().split('\n').map(line => `    ${line}`).join('\n'))
      if (note.screenshot) console.log(`    screenshot: ${note.screenshot}`)
      if (note.resolution) console.log(`    resolved: ${note.resolution}`)
    }
  }
  console.log(shown ? `\n${shown} note${shown === 1 ? '' : 's'}.` : 'Nothing open.')
} else if (command === 'done' || command === 'reopen') {
  const [id, ...message] = rest
  if (!id) { console.error(`Usage: review-notes ${command} <id>${command === 'done' ? ' "what was changed"' : ''}`); process.exit(2) }
  const found = await store.find(id)
  if (!found) { console.error(`No note ${id}.`); process.exit(1) }
  await store.setStatus(found.file.engine, found.file.presetId, id, command === 'done' ? 'done' : 'open', message.join(' '))
  console.log(`${id} marked ${command === 'done' ? 'done' : 'open'}.`)
} else {
  console.error('Commands: list [--all] | done <id> "what was changed" | reopen <id>')
  process.exit(2)
}
