/**
 * Files that still contain old-brand text. Remove an entry when its phase lands
 * (docs/stageless-rename.md). Goal: empty. Regenerate the candidates with
 * BRAND_GUARD_DUMP=/tmp/x npx vitest run src/brand
 */
export const PENDING_FILES: string[] = [
  'android-tv-receiver/app/src/main/res/values/strings.xml',
  'supabase/functions/_shared/vocalReference.ts',
  'supabase/functions/lyric-transcription/index.ts',
]
