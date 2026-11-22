import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ReactPresetCard } from '../ReactPresetCard'
import {
  BRAND_ASSETS, BRAND_CARD_SHADOW, BRAND_FIXED_COLORS, BRAND_FONT_LINK, BRAND_FONTS, BRAND_GRADIENT, BRAND_GRID, BRAND_RADIUS_PX, BRAND_THEMES, BRAND_TOKEN_GROUPS, BRAND_TYPE_ROLES,
  buildBrandCss, contrastGrade, contrastRatio, parseCssColor, toHex, type BrandThemeId,
} from './brandKitModel'
import styles from './brandKitStudies.css?inline'

const asset = (file: string) => `${import.meta.env.BASE_URL ?? '/'}${file}`
const ALL_TOKENS = BRAND_TOKEN_GROUPS.flatMap(group => group.tokens)
const SECTIONS = [
  ['logo', 'Logo'], ['color', 'Color'], ['type', 'Type'], ['shape', 'Shape and depth'], ['texture', 'Backgrounds and effects'], ['components', 'Components'], ['web', 'For the website'],
] as const

/** A section header in the app's window-title role, with the mark's gradient node as its icon. */
function Section({ id, title, blurb, children }: { id: string; title: string; blurb: string; children: ReactNode }) {
  return (
    <section className="ll-brand-section" id={`brand-${id}`} aria-labelledby={`brand-${id}-title`}>
      <header className="ll-brand-section-head">
        <h2 id={`brand-${id}-title`}><i className="ll-brand-node" aria-hidden="true" />{title}</h2>
        <p>{blurb}</p>
      </header>
      {children}
    </section>
  )
}

function CopyButton({ text, label, copied, onCopy }: { text: string; label: string; copied: string | null; onCopy: (text: string) => void }) {
  return <button type="button" className="ll-brand-copy" onClick={() => onCopy(text)} aria-label={`Copy ${label}`}>{copied === text ? 'Copied' : 'Copy'}</button>
}

export function BrandKitStudies() {
  const root = useRef<HTMLDivElement | null>(null)
  const [theme, setTheme] = useState<BrandThemeId>('dark')
  const [values, setValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [tab, setTab] = useState('Presets')

  // The live value of every theme token, read from the running app's CSS under the chosen theme.
  useLayoutEffect(() => {
    if (!root.current) return
    const style = getComputedStyle(root.current), next: Record<string, string> = {}
    for (const { token } of ALL_TOKENS) { const value = style.getPropertyValue(token).trim(); if (value) next[token] = value }
    setValues(next)
  }, [theme])
  const value = (token: string, fallback: string) => values[token] ?? fallback
  const copy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined)
    setCopied(text); window.setTimeout(() => setCopied(current => current === text ? null : current), 1400)
  }, [])
  const css = buildBrandCss(values)
  const background = value('--color-background', '#090d0f')

  return (
    <div className="ll-brand" data-theme={theme} ref={root} data-brand-kit>
      <style>{styles}</style>

      <header className="ll-brand-hero">
        <img className="ll-brand-hero-mark" src={asset('stageless_wordmark.png')} alt="STAGELESS" />
        <div className="ll-brand-hero-copy">
          <h1>Brand Kit</h1>
          <p>The STAGELESS look as the application has it today, taken from the app itself: the logo and wordmark, fonts, color tokens, shapes, textures and effects. Values are read live from the app's styles.</p>
        </div>
        <div className="ll-brand-themes" role="radiogroup" aria-label="Theme preview">
          {BRAND_THEMES.map(entry => (
            <button key={entry.id} type="button" role="radio" aria-checked={theme === entry.id} data-active={theme === entry.id || undefined} onClick={() => setTheme(entry.id)} title={entry.note}>{entry.label}</button>
          ))}
        </div>
      </header>
      <nav className="ll-brand-index" aria-label="Brand Kit sections">
        {SECTIONS.map(([id, label]) => <button key={id} type="button" onClick={() => root.current?.querySelector(`#brand-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{label}</button>)}
      </nav>

      {/* ── Logo ─────────────────────────────────────────────────────────────────────────────────────────────── */}
      <Section id="logo" title="Logo and wordmark" blurb="The S is two strokes that end in round nodes, drawn in a cyan-to-azure gradient. The wordmark pairs it with STAGE in the same gradient and LESS in a hairline white, so it belongs on dark surfaces.">
        <div className="ll-brand-tiles ll-brand-tiles--logo">
          <figure className="ll-brand-tile" data-ground="night"><div className="ll-brand-stage"><img src={asset('stageless_logo.png')} alt="STAGELESS S mark on a dark ground" width={132} /></div><figcaption><b>Mark on dark</b><span>The primary use</span></figcaption></figure>
          <figure className="ll-brand-tile" data-ground="light"><div className="ll-brand-stage"><img src={asset('stageless_logo.png')} alt="STAGELESS S mark on a light ground" width={132} /></div><figcaption><b>Mark on light</b><span>Works on light panels</span></figcaption></figure>
          <figure className="ll-brand-tile ll-brand-tile--wide" data-ground="night"><div className="ll-brand-stage"><img src={asset('stageless_wordmark.png')} alt="STAGELESS wordmark on a dark ground" width={320} /></div><figcaption><b>Wordmark on dark</b><span>Mark and name together</span></figcaption></figure>
          <figure className="ll-brand-tile ll-brand-tile--wide" data-ground="light" data-avoid><div className="ll-brand-stage"><img src={asset('stageless_wordmark.png')} alt="STAGELESS wordmark on a light ground, where LESS disappears" width={320} /></div><figcaption><b>Wordmark on light</b><span>Avoid: LESS is white and vanishes</span></figcaption></figure>
          <figure className="ll-brand-tile ll-brand-tile--wide" data-ground="chrome">
            <div className="ll-brand-stage ll-brand-stage--header">
              <div className="ll-brand-appbar"><img src={asset('stageless_logo.png')} alt="" width={26} /><span className="ll-brand-appbar-tabs">{['React', 'Presets', 'Media', 'Shows'].map(name => <i key={name} data-active={name === 'Presets' || undefined}>{name}</i>)}</span></div>
            </div>
            <figcaption><b>In the app header</b><span>The mark at 26px beside the navigation</span></figcaption>
          </figure>
          <figure className="ll-brand-tile" data-ground="night">
            <div className="ll-brand-stage"><div className="ll-brand-clear"><img src={asset('stageless_logo.png')} alt="" width={96} /><i className="ll-brand-clear-x" aria-hidden="true">x</i></div></div>
            <figcaption><b>Clear space</b><span>Suggested: keep a quarter of the mark's height free all round</span></figcaption>
          </figure>
        </div>
        <div className="ll-brand-split">
          <div className="ll-brand-panel">
            <h3>Gradient</h3>
            <div className="ll-brand-gradient" style={{ background: BRAND_GRADIENT }} role="img" aria-label="Brand gradient from #00cfe1 to #0090dc, at 135 degrees" />
            <dl className="ll-brand-facts"><dt>Stops</dt><dd>#00cfe1 → #0090dc</dd><dt>Angle</dt><dd>135° (180° for a vertical stroke)</dd></dl>
            <CopyButton text={BRAND_GRADIENT} label="gradient" copied={copied} onCopy={copy} />
          </div>
          <div className="ll-brand-panel">
            <h3>Stroke and node</h3>
            <div className="ll-brand-stroke" aria-hidden="true"><span className="ll-brand-stroke-line" /><span className="ll-brand-stroke-node" /></div>
            <p className="ll-brand-note">Strokes are continuous, rounded and end in a round node. The app uses this for the selected row's edge and the loaded track marker.</p>
          </div>
          <div className="ll-brand-panel">
            <h3>Files</h3>
            <table className="ll-brand-table"><tbody>
              {BRAND_ASSETS.map(item => (
                <tr key={item.file}><th scope="row">{item.label}</th><td>{item.width} × {item.height} PNG<br /><small>{item.use}</small></td><td><a href={asset(item.file)} download={item.file}>{item.file}</a></td></tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </Section>

      {/* ── Color ────────────────────────────────────────────────────────────────────────────────────────────── */}
      <Section id="color" title="Color tokens" blurb={`Read live from the app's styles, in the ${BRAND_THEMES.find(entry => entry.id === theme)!.label} theme. Click any swatch to copy its value. Switch themes above to compare.`}>
        {BRAND_TOKEN_GROUPS.map(group => (
          <div className="ll-brand-group" key={group.id}>
            <h3>{group.title}<small>{group.blurb}</small></h3>
            <div className="ll-brand-swatches" data-group={group.id}>
              {group.tokens.map(item => {
                const raw = value(item.token, item.fallback), parsed = parseCssColor(raw)
                return (
                  <button key={item.token} type="button" className="ll-brand-swatch" onClick={() => copy(raw)} aria-label={`${item.label} ${raw}. Copy`}>
                    <span className="ll-brand-chip" data-translucent={(parsed && parsed.a < 1) || undefined} style={{ background: `var(${item.token})` }} />
                    <span className="ll-brand-swatch-copy"><b>{item.label}</b><code>{item.token}</code><span>{copied === raw ? 'Copied' : parsed && parsed.a === 1 ? `${toHex(parsed)}` : raw}</span>{item.note && <em>{item.note}</em>}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div className="ll-brand-group">
          <h3>Fixed colors<small>Written directly in the stylesheets; they do not change with the theme.</small></h3>
          <div className="ll-brand-swatches" data-group="fixed">
            {BRAND_FIXED_COLORS.map(item => (
              <button key={item.name} type="button" className="ll-brand-swatch" onClick={() => copy(item.value)} aria-label={`${item.name} ${item.value}. Copy`}>
                <span className="ll-brand-chip" style={{ background: item.value }} />
                <span className="ll-brand-swatch-copy"><b>{item.name}</b><code>{item.source}</code><span>{copied === item.value ? 'Copied' : item.value}</span><em>{item.note}</em></span>
              </button>
            ))}
          </div>
        </div>
        <div className="ll-brand-group">
          <h3>Text on the background<small>WCAG contrast of each text color over the page background in this theme.</small></h3>
          <div className="ll-brand-contrast">
            {BRAND_TOKEN_GROUPS.find(group => group.id === 'text')!.tokens.filter(item => item.token !== '--color-text-on-primary').map(item => {
              const ratio = contrastRatio(value(item.token, item.fallback), background)
              return <div key={item.token} className="ll-brand-contrast-row"><span style={{ color: `var(${item.token})` }}>Aa  The quick brown fox</span><small>{item.label}</small><b>{ratio ? `${ratio.toFixed(1)}:1 · ${contrastGrade(ratio)}` : '—'}</b></div>
            })}
            <div className="ll-brand-contrast-row"><span className="ll-brand-on-primary">Aa  Text on the primary color</span><small>On primary</small><b>{(() => { const ratio = contrastRatio(value('--color-text-on-primary', '#081014'), value('--color-primary', '#4ac7db')); return ratio ? `${ratio.toFixed(1)}:1 · ${contrastGrade(ratio)}` : '—' })()}</b></div>
          </div>
        </div>
      </Section>

      {/* ── Type ─────────────────────────────────────────────────────────────────────────────────────────────── */}
      <Section id="type" title="Typography" blurb="Two families do all the work: Space Grotesk speaks, Manrope explains. Roles below are drawn with the app's own type tokens.">
        <div className="ll-brand-fonts">
          {BRAND_FONTS.map(font => (
            <article className="ll-brand-font" key={font.id} style={{ fontFamily: font.stack }}>
              <header><span className="ll-brand-eyebrow">{font.role} font</span><code>{font.token}</code></header>
              <div className="ll-brand-aa" aria-hidden="true">Aa</div>
              <h3>{font.family}</h3>
              <p className="ll-brand-glyphs">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 &amp; . , ! ? @ # %</p>
              <ul className="ll-brand-weights">{font.weights.map(weight => <li key={weight} style={{ fontWeight: weight }}>{weight}<span>Stage</span></li>)}</ul>
              <p className="ll-brand-note">{font.use}</p>
            </article>
          ))}
        </div>
        <div className="ll-brand-group">
          <h3>Type roles<small>The shared roles from typography.css.</small></h3>
          <div className="ll-brand-roles">
            {BRAND_TYPE_ROLES.map(role => (
              <div className="ll-brand-role" key={role.id} data-role={role.id}>
                <span className="ll-brand-role-sample" style={role.style}>{role.sample}</span>
                <span className="ll-brand-role-label"><b>{role.label}</b><small>{role.spec}</small></span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Shape and depth ──────────────────────────────────────────────────────────────────────────────────── */}
      <Section id="shape" title="Shape and depth" blurb={`One ${BRAND_RADIUS_PX}px corner for windows, cards, fields and menus. Layers are separated by a hairline border, and only the sign-in card gets a glow.`}>
        <div className="ll-brand-split">
          <div className="ll-brand-panel">
            <h3>Layers</h3>
            <div className="ll-brand-layers" aria-label="Background, panel, card and surface, nested">
              <div className="ll-l1"><small>Background</small><div className="ll-l2"><small>Panel</small><div className="ll-l3"><small>Card</small><div className="ll-l4"><small>Surface</small></div></div></div></div>
            </div>
          </div>
          <div className="ll-brand-panel">
            <h3>Borders and corner</h3>
            <div className="ll-brand-borders">{['--color-border', '--color-border-subtle', '--color-border-faint'].map(token => <span key={token} style={{ borderColor: `var(${token})` }}>{token.replace('--color-', '')}</span>)}</div>
            <dl className="ll-brand-facts"><dt>Corner</dt><dd>{BRAND_RADIUS_PX}px everywhere (<code>--radius-group</code>)</dd><dt>Line</dt><dd>1px</dd></dl>
          </div>
          <div className="ll-brand-panel">
            <h3>Focus and glow</h3>
            <div className="ll-brand-focus"><button type="button">Focused control</button></div>
            <div className="ll-brand-glowcard" style={{ boxShadow: BRAND_CARD_SHADOW }}>Sign-in card glow</div>
          </div>
        </div>
      </Section>

      {/* ── Backgrounds and effects ──────────────────────────────────────────────────────────────────────────── */}
      <Section id="texture" title="Backgrounds, textures and effects" blurb="The look is near-black with a cool cast: a hairline cyan grid, soft cyan glows and HUD corner brackets. Nothing is noisy or glossy.">
        <div className="ll-brand-tiles ll-brand-tiles--texture">
          <figure className="ll-brand-tile"><div className="ll-brand-ground ll-brand-ground--app" /><figcaption><b>App ground</b><span>#090d0f, the page</span></figcaption></figure>
          <figure className="ll-brand-tile"><div className="ll-brand-ground ll-brand-ground--grid" /><figcaption><b>Sign-in grid</b><span>{BRAND_GRID.size}px cyan hairlines at 1.8% on #04060a</span></figcaption></figure>
          <figure className="ll-brand-tile"><div className="ll-brand-ground ll-brand-ground--stage" /><figcaption><b>Stage ground</b><span>#060d10 behind the visualizer</span></figcaption></figure>
          <figure className="ll-brand-tile"><div className="ll-brand-ground ll-brand-ground--glow" /><figcaption><b>Cyan glow</b><span>A soft #19bff2 bloom at 7%</span></figcaption></figure>
          <figure className="ll-brand-tile"><div className="ll-brand-ground ll-brand-ground--hud"><i /><i /></div><figcaption><b>HUD corners</b><span>1.5px cyan brackets at 45% and 20%</span></figcaption></figure>
          <figure className="ll-brand-tile"><div className="ll-brand-ground ll-brand-ground--text"><span className="ll-brand-gradient-text">STAGELESS</span></div><figcaption><b>Gradient text</b><span>Display type filled with the mark's gradient</span></figcaption></figure>
        </div>
        <p className="ll-brand-note">Motion is short and quiet: 140–150ms ease on color and border changes, no bounce. The visualizers themselves carry the color and movement; the interface around them stays dark and still.</p>
      </Section>

      {/* ── Components ───────────────────────────────────────────────────────────────────────────────────────── */}
      <Section id="components" title="Components" blurb="The recurring controls, shown with the app's own classes where they exist.">
        <div className="ll-brand-split ll-brand-split--components">
          <div className="ll-brand-panel">
            <h3>Buttons</h3>
            <div className="ll-brand-row">
              <button type="button" className="ll-brand-btn ll-brand-btn--tint">Log in</button>
              <button type="button" className="ll-brand-btn ll-brand-btn--solid">Save</button>
              <button type="button" className="ll-brand-btn ll-brand-btn--ghost">Cancel</button>
            </div>
            <p className="ll-brand-note">Tint (the sign-in button): 16% cyan fill, 40% cyan border, #8ef4ff text, uppercase.</p>
          </div>
          <div className="ll-brand-panel">
            <h3>Tabs</h3>
            <div className="ll-brand-tabs" role="group" aria-label="Example tabs">
              {['Presets', 'Layers', 'Media'].map(name => <button key={name} type="button" aria-pressed={tab === name} className={`dv-underline-tab${tab === name ? ' is-active' : ''}`} onClick={() => setTab(name)}>{name}</button>)}
            </div>
            <p className="ll-brand-note">Manrope 700 at 11px, with a primary underline on the active tab.</p>
          </div>
          <div className="ll-brand-panel">
            <h3>Fields</h3>
            <label className="ll-brand-field"><span>Email</span><input type="text" placeholder="you@example.com" readOnly /></label>
            <div className="ll-brand-row ll-brand-row--controls">
              <span className="ll-brand-toggle" data-on aria-hidden="true" />
              <span className="ll-brand-slider" aria-hidden="true"><i /></span>
              <span className="ll-brand-chipbtn">Cinema 2.0</span>
            </div>
          </div>
          <div className="ll-brand-panel">
            <h3>Notices</h3>
            <ul className="ll-brand-notices">
              {([['info', 'Info', '#67f7ff'], ['success', 'Success', '#61d6aa'], ['warning', 'Warning', '#d8b95a'], ['error', 'Error', '#f87171']] as const).map(([tone, label, color]) => (
                <li key={tone} style={{ ['--tone' as string]: color }}><i aria-hidden="true" />{label}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="ll-brand-group">
          <h3>Preset cards<small>Full-bleed artwork, with the name on a gradient that darkens toward the bottom.</small></h3>
          <div className="ll-brand-cards">
            {[['inertia', 'Inertia'], ['crate-paradox-weave', 'Paradox Weave'], ['crate-bass-sigil', 'Bass Sigil']].map(([key, title], index) => (
              <div className="ll-brand-card" key={key}>
                <ReactPresetCard id={`brand-kit-${key}`} title={title!} description="" activateLabel={`Example card: ${title}`} onActivate={() => undefined} isActive={index === 0}
                  backdrop={<img className="ll-brand-card-art" src={asset(`preset-artwork/drmvyz.cinema2.${key}.webp`)} alt="" />} chips={[{ label: 'Cinema 2.0' }]} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── For the website ──────────────────────────────────────────────────────────────────────────────────── */}
      <Section id="web" title="For the website" blurb="A starting point built only from the tokens above, and the stylesheet to paste so the site and the app stay the same brand.">
        <div className="ll-brand-site" data-theme="dark" aria-label="Website mockup">
          <div className="ll-brand-site-grid" aria-hidden="true" />
          <header className="ll-brand-site-nav"><img src={asset('stageless_wordmark.png')} alt="STAGELESS" /><nav>{['Product', 'Engines', 'Pricing', 'Docs'].map(name => <a key={name} href="#brand-web" onClick={event => event.preventDefault()}>{name}</a>)}</nav><button type="button" className="ll-brand-btn ll-brand-btn--tint">Sign in</button></header>
          <div className="ll-brand-site-hero">
            <span className="ll-brand-eyebrow">Live visuals for DJs</span>
            <h2>Every set, <span className="ll-brand-gradient-text">stageless</span></h2>
            <p>Audio-reactive visuals that follow your music, built for the booth and the big screen.</p>
            <div className="ll-brand-row"><button type="button" className="ll-brand-btn ll-brand-btn--solid">Get started</button><button type="button" className="ll-brand-btn ll-brand-btn--ghost">Watch the demo</button></div>
          </div>
          <div className="ll-brand-site-cards">{['Engines', 'Presets', 'Shows'].map(name => <div key={name}><b>{name}</b><span>A line about {name.toLowerCase()} in Manrope, muted.</span></div>)}</div>
        </div>
        <div className="ll-brand-split">
          <div className="ll-brand-panel ll-brand-panel--wide">
            <h3>Stylesheet<CopyButton text={css} label="stylesheet" copied={copied} onCopy={copy} /></h3>
            <pre className="ll-brand-code" tabIndex={0}>{css}</pre>
          </div>
          <div className="ll-brand-panel">
            <h3>Fonts</h3>
            <pre className="ll-brand-code ll-brand-code--short" tabIndex={0}>{`<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${BRAND_FONT_LINK}" rel="stylesheet">`}</pre>
            <CopyButton text={`<link href="${BRAND_FONT_LINK}" rel="stylesheet">`} label="font link" copied={copied} onCopy={copy} />
            <ul className="ll-brand-checklist"><li>Page background <code>--color-background</code>, text <code>--color-text</code></li><li>Headings in Space Grotesk, body and labels in Manrope</li><li>One {BRAND_RADIUS_PX}px corner and hairline borders</li><li>Wordmark on dark surfaces only</li></ul>
          </div>
        </div>
      </Section>
    </div>
  )
}
