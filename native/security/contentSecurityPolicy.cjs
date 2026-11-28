'use strict'

/**
 * The app's Content Security Policy (beta remediation SEC-03). One policy, built here, is delivered two ways for the built app:
 *   - as a <meta> tag that the production build writes into index.html (vite.config.ts), which covers the web build and Electron alike;
 *   - as a response header from Electron's drmvyz-app:// protocol, which can also forbid framing (frame-ancestors is ignored in a <meta> tag).
 * The development server gets no policy: Vite's hot reload injects inline scripts and a websocket.
 *
 * What it allows, and why:
 *   script-src   only the app's own bundles; WebAssembly (Draco, ONNX background removal, MediaPipe, vtracer) via 'wasm-unsafe-eval'. No inline
 *                scripts and no eval: the build has neither, so an injected <script> or javascript: URL cannot run.
 *   worker-src   the app's own workers, and blob: workers that WebAssembly runtimes start.
 *   style-src    the app's stylesheets, inline style attributes (React styles), and Google Fonts' stylesheet.
 *   font-src     the app's fonts, data: fonts, and Google Fonts' files.
 *   img-src      the app's images, data:/blob: images, and any https image (signed Storage URLs, admin-entered announcement images).
 *   media-src    the same for audio and video.
 *   connect-src  the app itself, data:/blob: (local media), and Supabase (REST, Storage, Edge Functions, Realtime). Nothing else can be fetched.
 *   frame-src    the app's own pages and srcdoc/data/blob frames (Layout Lab previews). No third-party embeds.
 *   object-src none (no plugins); base-uri and form-action limited to the app.
 */

const SUPABASE_SOURCES = ['https://*.supabase.co', 'wss://*.supabase.co']

/** Supabase on a custom domain (VITE_SUPABASE_URL not on *.supabase.co) is allowed explicitly, for https and its websocket. */
function customSupabaseSources(supabaseUrl) {
  try {
    if (!supabaseUrl) return []
    const url = new URL(supabaseUrl)
    if (url.hostname.endsWith('.supabase.co')) return []
    return [url.origin, url.origin.replace(/^http/, 'ws')]
  } catch {
    return []
  }
}

/**
 * @param {{ supabaseUrl?: string, delivery?: 'header' | 'meta' }} [options]
 * @returns {string} the policy, directives separated by "; "
 */
function buildContentSecurityPolicy({ supabaseUrl = '', delivery = 'header' } = {}) {
  const directives = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", "'wasm-unsafe-eval'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['style-src', ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']],
    ['font-src', ["'self'", 'data:', 'https://fonts.gstatic.com']],
    ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['media-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['connect-src', ["'self'", 'data:', 'blob:', ...SUPABASE_SOURCES, ...customSupabaseSources(supabaseUrl)]],
    ['frame-src', ["'self'", 'data:', 'blob:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ]
  if (delivery === 'header') directives.push(['frame-ancestors', ["'none'"]])
  return directives.map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ')
}

module.exports = { buildContentSecurityPolicy }
