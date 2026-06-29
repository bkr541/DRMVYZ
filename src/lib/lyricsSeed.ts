// ── DEV-ONLY ─────────────────────────────────────────────────────────────────
// Seed helper for the VYZUALZ timed-lyrics system.
// NOT wired into any production UI — call manually from the browser console
// or a temporary import during development.
//
// Quick usage from DevTools console (after the app is running):
//   import('/src/lib/lyricsSeed.ts').then(m => m.seedSampleLyricsForCurrentUser())
//   import('/src/lib/lyricsSeed.ts').then(m => m.verifyLatestSeededLyricsForCurrentUser())
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getLyricDocumentsForUser,
  getLyricCuesForDocument,
  saveLyricDocumentAtomic,
} from './lyricsDb'
import type {
  LyricDocument,
  LyricCue,
  CreateLyricCueInput,
} from '../types/lyrics'

const db = supabase as unknown as SupabaseClient

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireCurrentUser(): Promise<{ id: string; email: string | undefined }> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw new Error(`lyricsSeed: auth error — ${error.message}`)
  if (!user)  throw new Error('lyricsSeed: no authenticated user — sign in first')
  return { id: user.id, email: user.email }
}

// ── Sample cue data ───────────────────────────────────────────────────────────

const SAMPLE_CUES: CreateLyricCueInput[] = [
  {
    lyricDocumentId: '', // filled in at insert time
    startMs: 0,
    endMs: 2500,
    text: 'Welcome to VYZUALZ',
    style: {
      fontSize:  84,
      color:     '#ffffff',
    },
    animation: {
      in:    'scalePop',
      out:   'fadeDown',
      inMs:  300,
      outMs: 250,
    },
    effects: {
      glow:       1,
      beatPunch:  0.6,
    },
  },
  {
    lyricDocumentId: '',
    startMs: 3000,
    endMs: 6000,
    text: 'Lyrics locked to the audio clock',
    words: [
      { id: 'c2_w1', text: 'Lyrics', startMs: 3000, endMs: 3700 },
      { id: 'c2_w2', text: 'locked', startMs: 3700, endMs: 4300 },
      { id: 'c2_w3', text: 'to',     startMs: 4300, endMs: 4600 },
      { id: 'c2_w4', text: 'the',    startMs: 4600, endMs: 4900 },
      { id: 'c2_w5', text: 'audio',  startMs: 4900, endMs: 5400 },
      { id: 'c2_w6', text: 'clock',  startMs: 5400, endMs: 6000 },
    ],
    groups: [
      {
        id:      'c2_g1',
        wordIds: ['c2_w5', 'c2_w6'],
        style:   { color: '#00eaff' },
        effects: { glow: 1, rgbSplit: 0.2 },
      },
    ],
  },
  {
    lyricDocumentId: '',
    startMs: 6500,
    endMs: 9500,
    text: 'Style lives in JSONB',
    style: {
      color:    '#ff3df2',
      fontSize: 76,
    },
    animation: {
      in:    'glitch',
      out:   'glitchOut',
      inMs:  200,
      outMs: 250,
    },
    effects: {
      glitch:   0.45,
      rgbSplit: 0.35,
      glow:     0.9,
    },
  },
  {
    lyricDocumentId: '',
    startMs: 10000,
    endMs: 13500,
    text: 'Words can move on their own',
    words: [
      {
        id: 'c4_w1', text: 'Words', startMs: 10000, endMs: 10600,
        style: { color: '#ffffff' },
      },
      {
        id: 'c4_w2', text: 'can', startMs: 10600, endMs: 11100,
      },
      {
        id: 'c4_w3', text: 'move', startMs: 11100, endMs: 11900,
        style:     { color: '#00eaff', fontSize: 90 },
        animation: { in: 'waveReveal' },
        effects:   { bassScale: 0.6, beatPunch: 0.7 },
      },
      {
        id: 'c4_w4', text: 'on',    startMs: 11900, endMs: 12400,
      },
      {
        id: 'c4_w5', text: 'their', startMs: 12400, endMs: 12900,
      },
      {
        id: 'c4_w6', text: 'own', startMs: 12900, endMs: 13500,
        style: { color: '#ff3df2' },
      },
    ],
  },
  {
    lyricDocumentId: '',
    startMs: 14000,
    endMs: 17500,
    text: 'Ready for real-time rendering',
    style: {
      fontSize:   80,
      color:      '#ffffff',
      shadowBlur: 32,
    },
    animation: {
      in:    'fadeUp',
      out:   'blurOut',
      inMs:  250,
      outMs: 400,
    },
    effects: {
      glow:         1,
      bloom:        0.4,
      opacityPulse: 0.3,
    },
  },
]

// ── Seed ──────────────────────────────────────────────────────────────────────

/**
 * Insert one sample lyric document + 5 cues for the currently signed-in user.
 * Safe to call multiple times — each call creates a new document.
 */
export async function seedSampleLyricsForCurrentUser(): Promise<{
  document: LyricDocument
  cues: LyricCue[]
}> {
  const user = await requireCurrentUser()
  console.log(`[lyricsSeed] seeding for user ${user.email ?? user.id} …`)

  const result = await saveLyricDocumentAtomic({
    document: {
      title:        'VYZUALZ Lyric Test',
      artist:       'DRMVYZ',
      sourceType:   'manual',
      sourceFormat: 'json',
      globalOffsetMs: 0,
      metadata: {
        purpose:     'dev_seed',
        description: 'Sample lyric document for testing VYZUALZ timed lyrics',
      },
      defaultStyle: {
        fontFamily:   'Orbitron',
        fontSize:     72,
        fontWeight:   800,
        color:        '#ffffff',
        strokeColor:  '#00eaff',
        strokeWidth:  2,
        shadowColor:  '#00eaff',
        shadowBlur:   24,
        x:            0.5,
        y:            0.78,
        align:        'center',
        textTransform: 'none',
      },
      defaultAnimation: {
        in:     'fadeUp',
        out:    'fadeDown',
        inMs:   250,
        outMs:  300,
        easing: 'easeOutCubic',
      },
      defaultEffects: {
        glow:      0.8,
        rgbSplit:  0.12,
        beatPunch: 0.35,
        bassScale: 0.25,
      },
    },
    cues: SAMPLE_CUES,
    activate: true,
  })

  if (!result.ok) {
    throw new Error(`lyricsSeed: ${result.kind}: ${result.message}`)
  }

  const { document, cues } = result
  console.log(`[lyricsSeed] created document  id=${document.id}`)

  console.log(`[lyricsSeed] inserted ${cues.length} cues`)
  cues.forEach((c, i) =>
    console.log(`  cue ${i + 1}: [${c.startMs}–${c.endMs}ms] "${c.text}"`),
  )

  return { document, cues }
}

// ── Verify ────────────────────────────────────────────────────────────────────

/**
 * Find the most recent seeded document for the current user and return it with
 * its cues. Uses title + sourceType as the lookup key so it works even if the
 * metadata JSONB filter is unavailable.
 */
export async function verifyLatestSeededLyricsForCurrentUser(): Promise<{
  document: LyricDocument
  cues: LyricCue[]
} | null> {
  const user = await requireCurrentUser()
  console.log(`[lyricsSeed] verifying seed data for user ${user.email ?? user.id} …`)

  // Fetch all documents for the user and filter client-side for the seed marker.
  // getLyricDocumentsForUser already orders by updated_at desc, so the first
  // match is always the most recent seed run.
  const all = await getLyricDocumentsForUser(user.id)

  // Primary: match on metadata.purpose = 'dev_seed'
  // Fallback: match on title + sourceType
  const document =
    all.find(d => (d.metadata as Record<string, unknown>)['purpose'] === 'dev_seed') ??
    all.find(d => d.title === 'VYZUALZ Lyric Test' && d.sourceType === 'manual') ??
    null

  if (!document) {
    console.warn('[lyricsSeed] no seeded document found — run seedSampleLyricsForCurrentUser() first')
    return null
  }

  const cues = await getLyricCuesForDocument(document.id)

  console.log(`[lyricsSeed] found document id=${document.id}`)
  console.log(`[lyricsSeed] cue count: ${cues.length}`)
  cues.forEach((c, i) => {
    const wordCount  = c.words?.length  ?? 0
    const groupCount = c.groups?.length ?? 0
    console.log(
      `  cue ${i + 1}: [${c.startMs}–${c.endMs}ms] "${c.text}"` +
      (wordCount  ? `  words=${wordCount}`   : '') +
      (groupCount ? `  groups=${groupCount}` : ''),
    )
  })

  return { document, cues }
}

// ── Optional: wipe seed data ──────────────────────────────────────────────────

/**
 * Delete all seeded documents for the current user.
 * Cues are removed automatically via ON DELETE CASCADE.
 */
export async function wipeSeedLyricsForCurrentUser(): Promise<number> {
  const user = await requireCurrentUser()

  const all = await getLyricDocumentsForUser(user.id)
  const seeds = all.filter(
    d =>
      (d.metadata as Record<string, unknown>)['purpose'] === 'dev_seed' ||
      (d.title === 'VYZUALZ Lyric Test' && d.sourceType === 'manual'),
  )

  if (seeds.length === 0) {
    console.log('[lyricsSeed] no seed documents to delete')
    return 0
  }

  for (const doc of seeds) {
    const { error } = await (db as SupabaseClient)
      .from('lyric_documents')
      .delete()
      .eq('id', doc.id)
    if (error) console.error(`[lyricsSeed] failed to delete ${doc.id}:`, error.message)
    else console.log(`[lyricsSeed] deleted document ${doc.id}`)
  }

  return seeds.length
}
