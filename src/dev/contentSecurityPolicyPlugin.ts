import { createRequire } from 'node:module'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const { buildContentSecurityPolicy } = require('../../native/security/contentSecurityPolicy.cjs') as {
  buildContentSecurityPolicy: (options?: { supabaseUrl?: string; delivery?: 'header' | 'meta' }) => string
}

/**
 * Production builds only: writes the app's Content Security Policy (native/security/contentSecurityPolicy.cjs) into every built HTML page as the
 * first tag in <head>, so it applies before anything loads. The development server is left without one (hot reload needs inline scripts).
 */
export function contentSecurityPolicyPlugin(): Plugin {
  let supabaseUrl = ''
  return {
    name: 'stageless-content-security-policy',
    apply: 'build',
    configResolved(config) {
      supabaseUrl = String(config.env.VITE_SUPABASE_URL ?? '')
    },
    transformIndexHtml: {
      order: 'post',
      handler: () => [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: buildContentSecurityPolicy({ supabaseUrl, delivery: 'meta' }) },
        injectTo: 'head-prepend',
      }],
    },
  }
}
