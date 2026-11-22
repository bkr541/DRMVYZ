/**
 * The STAGELESS brand as the application has it today, gathered in one place for the Brand Kit tab. Nothing here invents a style: colour tokens are read live from the
 * running app's CSS (`fallback` is the dark theme's value, shown where CSS is not available), and everything else quotes the stylesheet it comes from. A test keeps the
 * fallbacks and the quoted declarations in step with the CSS, so this file cannot quietly drift.
 */
export type BrandThemeId = 'dark' | 'light' | 'cdj'
export const BRAND_THEMES: readonly { id: BrandThemeId; label: string; note: string }[] = [
  { id: 'dark', label: 'Dark', note: 'The default and the brand look' },
  { id: 'light', label: 'Light', note: 'Standard UI colors only' },
  { id: 'cdj', label: 'CDJ', note: 'DropDex-style blue' },
]

export interface BrandToken { token: string; label: string; fallback: string; note?: string }
export interface BrandTokenGroup { id: string; title: string; blurb: string; tokens: readonly BrandToken[] }

/** Theme tokens (src/styles/appearance.css). They change with the theme. */
export const BRAND_TOKEN_GROUPS: readonly BrandTokenGroup[] = [
  { id: 'brand', title: 'Brand', blurb: 'The three colors the interface is built around: cyan leads, mint confirms, magenta marks the exception.', tokens: [
    { token: '--color-primary', label: 'Primary', fallback: '#4ac7db', note: 'Links, selection, the active tab, focus' },
    { token: '--color-secondary', label: 'Secondary', fallback: '#61d6aa', note: 'Success and supporting highlights' },
    { token: '--color-accent', label: 'Accent', fallback: '#b84fc9', note: 'Used sparingly, for emphasis' },
    { token: '--color-ring', label: 'Focus ring', fallback: '#4ac7db', note: 'Keyboard focus outline' },
  ] },
  { id: 'surfaces', title: 'Surfaces', blurb: 'Layers, one step apart each time something sits on top of another.', tokens: [
    { token: '--color-background', label: 'Background', fallback: '#090d0f', note: 'The page' },
    { token: '--color-panel', label: 'Panel', fallback: '#0b1012', note: 'Rails and windows' },
    { token: '--color-panel-alt', label: 'Panel alt', fallback: '#151a1d', note: 'Raised panels' },
    { token: '--color-card', label: 'Card', fallback: '#151a1d' },
    { token: '--color-popover', label: 'Popover', fallback: '#171b1d', note: 'Menus and dropdowns' },
    { token: '--color-surface', label: 'Surface', fallback: '#1a2024', note: 'Fields and chips' },
    { token: '--color-surface-hover', label: 'Surface hover', fallback: '#252d32' },
    { token: '--color-muted', label: 'Muted', fallback: '#1a2024' },
    { token: '--color-input', label: 'Input', fallback: '#1a2024' },
  ] },
  { id: 'borders', title: 'Borders', blurb: 'Cool grey-blue hairlines at three strengths.', tokens: [
    { token: '--color-border', label: 'Border', fallback: 'rgba(154, 178, 188, 0.26)', note: 'Windows and inputs' },
    { token: '--color-border-subtle', label: 'Subtle', fallback: 'rgba(154, 178, 188, 0.18)', note: 'Cards and rows' },
    { token: '--color-border-faint', label: 'Faint', fallback: 'rgba(154, 178, 188, 0.1)', note: 'Dividers' },
  ] },
  { id: 'text', title: 'Text', blurb: 'Four strengths of near-white, and the dark ink used on the primary color.', tokens: [
    { token: '--color-text-strong', label: 'Strong', fallback: 'rgba(245, 248, 250, 0.94)', note: 'Titles' },
    { token: '--color-text', label: 'Body', fallback: 'rgba(232, 238, 240, 0.88)' },
    { token: '--color-text-muted', label: 'Muted', fallback: 'rgba(196, 207, 211, 0.58)', note: 'Secondary text' },
    { token: '--color-text-faint', label: 'Faint', fallback: 'rgba(196, 207, 211, 0.32)', note: 'Placeholders and hints' },
    { token: '--color-text-on-primary', label: 'On primary', fallback: '#081014', note: 'Text on a primary fill' },
  ] },
]

export interface BrandFixedColor { name: string; value: string; source: string; note: string }
/** Colors written directly in the app's stylesheets; they do not change with the theme. */
export const BRAND_FIXED_COLORS: readonly BrandFixedColor[] = [
  { name: 'Mark gradient start', value: '#00cfe1', source: 'recordIndexStudies.css', note: 'Sampled from the S mark' },
  { name: 'Mark gradient end', value: '#0090dc', source: 'recordIndexStudies.css', note: 'Sampled from the S mark' },
  { name: 'Glow cyan', value: '#19bff2', source: 'auth.css', note: 'Sign-in card edge and glow, at low opacity' },
  { name: 'Tint button text', value: '#8ef4ff', source: 'auth.css', note: 'Text on the translucent cyan button' },
  { name: 'Sign-in ground', value: '#04060a', source: 'auth.css', note: 'The darkest surface, behind the grid' },
  { name: 'Stage ground', value: '#060d10', source: 'reactView.css', note: 'Behind the visualizer canvas' },
  { name: 'Success', value: '#61d6aa', source: 'vyzualz.css', note: 'Same as Secondary' },
  { name: 'Info', value: '#67f7ff', source: 'vyzualz.css', note: 'Notices' },
  { name: 'Warning', value: '#d8b95a', source: 'reactView.css', note: 'Notices' },
  { name: 'Error', value: '#f87171', source: 'vyzualz.css', note: 'Notices' },
]

export const BRAND_GRADIENT = 'linear-gradient(135deg, #00cfe1, #0090dc)'

export interface BrandFont { id: string; role: string; family: string; token: string; stack: string; weights: readonly number[]; use: string }
export const BRAND_FONTS: readonly BrandFont[] = [
  { id: 'primary', role: 'Primary', family: 'Space Grotesk', token: '--font-ui', stack: "'Space Grotesk', 'Helvetica Neue', system-ui, sans-serif", weights: [300, 400, 500, 600, 700],
    use: 'Headings, window titles, buttons, big engine names. The geometric, slightly technical voice.' },
  { id: 'secondary', role: 'Secondary', family: 'Manrope', token: '--font-mono', stack: "'Manrope', 'Helvetica Neue', system-ui, sans-serif", weights: [400, 500, 600, 700, 800],
    use: 'Field labels and values, tabs, library cards and preset names. Calm, even and very legible at 11px.' },
]
/** What the app loads from Google Fonts (index.html). */
export const BRAND_FONT_LINK = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Manrope:wght@200..800&display=swap'

export interface BrandTypeRole { id: string; label: string; spec: string; css: string; sample: string; style: Record<string, string | number> }
/** The shared type roles (src/styles/typography.css). `css` is the declaration as written there. */
export const BRAND_TYPE_ROLES: readonly BrandTypeRole[] = [
  { id: 'engine-label', label: 'Engine name', spec: 'Space Grotesk · 800 · 20–30px · uppercase', css: '800 clamp(20px, 8cqi, 30px)/1.1 var(--font-ui', sample: 'Cinema 2.0',
    style: { font: "800 28px/1.1 var(--font-ui)", letterSpacing: '.015em', textTransform: 'uppercase' } },
  { id: 'window-heading', label: 'Window heading', spec: 'Space Grotesk · 700 · 12px · tracking 0.15em', css: '--type-window-heading: 700 12px/1.2 var(--font-ui', sample: 'Preset Manager',
    style: { font: 'var(--type-window-heading)', letterSpacing: 'var(--type-window-heading-tracking, .15em)', textTransform: 'uppercase' } },
  { id: 'nested-heading', label: 'Nested group heading', spec: 'Space Grotesk · 800 · 11px', css: '--type-nested-group-heading: 800 11px/1 var(--font-ui', sample: 'Geometry',
    style: { font: 'var(--type-nested-group-heading)' } },
  { id: 'engine-eyebrow', label: 'Eyebrow', spec: 'Space Grotesk · 500 · 9px · tracking 0.24em', css: 'font: 500 9px/1.2 var(--font-ui', sample: 'Engine',
    style: { font: '500 9px/1.2 var(--font-ui)', letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--color-text-muted)' } },
  { id: 'preset-name', label: 'Preset name', spec: 'Manrope · 400 · 16px · tracking 0.12em · uppercase', css: '--type-preset-name-tracking: .12em', sample: 'Paradox Weave',
    style: { font: '400 16px/1.2 var(--type-preset-name-family, Manrope)', letterSpacing: '.12em', textTransform: 'uppercase' } },
  { id: 'card-title', label: 'Card title', spec: 'Manrope · 700 · 12.5px', css: 'font: 700 12.5px/1.2 var(--type-tab-family)', sample: 'Midnight Run',
    style: { font: '700 12.5px/1.2 var(--type-tab-family, Manrope)' } },
  { id: 'tab', label: 'Tab', spec: 'Manrope · 700 · 11px', css: '--type-tab: 700 11px/1 var(--font-mono', sample: 'Presets',
    style: { font: 'var(--type-tab)' } },
  { id: 'field', label: 'Field label and value', spec: 'Manrope · 600 · 11px', css: '--type-field-weight: 600', sample: 'Motion Speed  1.00',
    style: { font: 'var(--type-field-value)' } },
]

/** Where the brand's textures and shapes come from, quoted from the stylesheets. */
export const BRAND_RADIUS_PX = 6
export const BRAND_GRID = { size: 40, line: 'rgba(0, 229, 255, 0.018)', source: 'auth.css · .auth-root::before' }
export const BRAND_CARD_SHADOW = '0 0 0 1px rgba(25, 191, 242, 0.04), 0 0 60px rgba(25, 191, 242, 0.07), 0 32px 80px rgba(0, 0, 0, 0.7)'

export interface BrandAsset { file: string; label: string; width: number; height: number; use: string }
export const BRAND_ASSETS: readonly BrandAsset[] = [
  { file: 'stageless_logo.png', label: 'S mark', width: 1296, height: 1213, use: 'App header, sign-in card' },
  { file: 'stageless_wordmark.png', label: 'Wordmark with mark', width: 2172, height: 724, use: 'Brand lockup. Its "LESS" is white: dark surfaces only' },
]

// ── Color helpers (also used to print contrast) ───────────────────────────────────────────────────────────────────────────────────────
export interface Rgba { r: number; g: number; b: number; a: number }

export function parseCssColor(value: string): Rgba | null {
  const text = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text)
  if (hex) {
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map(c => c + c).join('') : hex[1]!
    return { r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16), a: 1 }
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(text)
  if (!rgb) return null
  const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4])
  return { r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]!, a: Math.max(0, Math.min(1, alpha)) }
}

export const toHex = ({ r, g, b }: Rgba) => `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`

const over = (top: Rgba, ground: Rgba): Rgba => ({ r: top.r * top.a + ground.r * (1 - top.a), g: top.g * top.a + ground.g * (1 - top.a), b: top.b * top.a + ground.b * (1 - top.a), a: 1 })
const luminance = ({ r, g, b }: Rgba) => { const lin = (v: number) => { const c = v / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }; return .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b) }

/** WCAG contrast of a (possibly translucent) foreground over a background, or null when either is not a color. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseCssColor(foreground), bg = parseCssColor(background)
  if (!fg || !bg) return null
  const solid = over(bg, { r: 0, g: 0, b: 0, a: 1 }), top = over(fg, solid)
  const [hi, lo] = [luminance(top), luminance(solid)].sort((x, y) => y - x)
  return (hi! + .05) / (lo! + .05)
}

export const contrastGrade = (ratio: number) => ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'Fails'

/** The brand as a stylesheet for a website: the theme's tokens, the fonts, the gradient and the shape. */
export function buildBrandCss(values: Readonly<Record<string, string>>): string {
  const lines = BRAND_TOKEN_GROUPS.flatMap(group => group.tokens.map(token => `  ${token.token}: ${values[token.token] ?? token.fallback};`))
  return [
    `/* STAGELESS brand tokens. Fonts: <link href="${BRAND_FONT_LINK}" rel="stylesheet"> */`,
    ':root {', ...lines,
    `  --font-ui: ${BRAND_FONTS[0]!.stack};`, `  --font-mono: ${BRAND_FONTS[1]!.stack};`,
    `  --radius: ${BRAND_RADIUS_PX}px;`, `  --brand-gradient: ${BRAND_GRADIENT};`,
    `  --brand-glow: ${BRAND_CARD_SHADOW};`, '}',
  ].join('\n')
}
