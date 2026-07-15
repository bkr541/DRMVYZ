import { assertEquals, assert } from 'jsr:@std/assert'
import { normalizeLyricCueStyle, segmentTimedWords } from './lyricCueSegmentation.ts'

const words = (text: string) => text.split(' ').map((value, index) => ({ id: `w${index}`, text: value, startMs: index * 500, endMs: index * 500 + 300 }))

Deno.test('cue styles are deterministic and rap is tighter than melodic', () => {
  const input = words('one two three four five six seven eight nine ten eleven twelve')
  const rap = segmentTimedWords(input, 'hip-hop')
  const melodic = segmentTimedWords(input, 'melodic')
  assert(rap.length > melodic.length)
  assertEquals(segmentTimedWords(input, 'hip-hop'), rap)
})

Deno.test('unknown style safely defaults to balanced', () => {
  assertEquals(normalizeLyricCueStyle('mystery'), 'balanced')
  assertEquals(segmentTimedWords(words('one two three four five six seven'), 'mystery'), segmentTimedWords(words('one two three four five six seven'), 'balanced'))
})

Deno.test('vocal chops preserve repeated occurrences and exact word timestamps', () => {
  const input = words('go go go go go')
  const cues = segmentTimedWords(input, 'vocal-chops', { beatGrid: input.map(word => ({ timeSec: word.endMs / 1000, confidence: 1 })) })
  assert(cues.length >= 2)
  assertEquals(cues.flatMap(cue => cue.words).map(word => [word.id, word.startMs, word.endMs]), input.map(word => [word.id, word.startMs, word.endMs]))
})

Deno.test('confident section boundaries are not crossed', () => {
  const input = words('one two three four five six seven eight')
  const cues = segmentTimedWords(input, 'melodic', { sections: [
    { id: 'verse', type: 'verse', startSec: 0, endSec: 2, confidence: 1 },
    { id: 'drop', type: 'drop', startSec: 2, endSec: 8, confidence: 1 },
  ] })
  assert(cues.every(cue => !(cue.startMs < 2000 && cue.endMs > 2000)))
})

Deno.test('phrase landmarks are preferred without producing empty cues', () => {
  const input = words('one two three four five six seven eight nine ten eleven twelve')
  const cues = segmentTimedWords(input, 'balanced', { phrases: [
    { timeSec: 3.3, phraseLength: 4, confidence: 1 },
    { timeSec: 4.3, phraseLength: 8, confidence: 1 },
    { timeSec: 5.3, phraseLength: 16, confidence: 1 },
  ] })
  assert(cues.every(cue => cue.words.length > 0 && cue.endMs > cue.startMs))
})
