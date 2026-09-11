// Cinema 2.0 is an empty workspace shell for now: it establishes the engine
// option and its tab layout (Source / Layers on the left, Presets / Design /
// React / Output on the right) while each surface's real content is still to
// be built. Every tab renders this placeholder until then.

interface Cinema2PlaceholderProps {
  /** Which tab / surface this placeholder is standing in for. */
  area: string
}

export function Cinema2Placeholder({ area }: Cinema2PlaceholderProps) {
  return (
    <div className="rv-cinema2-placeholder" role="status">
      <span className="rv-cinema2-placeholder-eyebrow">Cinema 2.0</span>
      <span className="rv-cinema2-placeholder-area">{area}</span>
      <span className="rv-cinema2-placeholder-note">This workspace is under construction.</span>
    </div>
  )
}
