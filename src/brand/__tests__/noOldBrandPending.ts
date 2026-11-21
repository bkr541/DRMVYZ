/**
 * Files that still contain old-brand text. Remove an entry when its phase lands
 * (docs/stageless-rename.md). Goal: empty. Regenerate the candidates with
 * BRAND_GUARD_DUMP=/tmp/x npx vitest run src/brand
 */
export const PENDING_FILES: string[] = [
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'android-tv-receiver/app/src/main/res/values/strings.xml',
  'electron/main.cjs',
  'index.html',
  'package.json',
  'scripts/electron-dev-processes.mjs',
  'scripts/run-electron-dev.mjs',
  'src/components/vyzualz/layout/MobilePreviewLauncher.tsx',
  'src/components/vyzualz/layout/mobileAppPreview.ts',
  'src/components/vyzualz/react/LayoutLabModal.tsx',
  'src/components/vyzualz/react/trackTimeline/TrackTimelineModal.tsx',
  'supabase/functions/_shared/vocalReference.ts',
  'supabase/functions/lyric-transcription/index.ts',
]
