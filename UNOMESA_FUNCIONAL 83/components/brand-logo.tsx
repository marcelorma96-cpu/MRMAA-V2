/** The approved artwork, with a white wordmark overlay on dark surfaces. */
export function BrandLogo({ className = "", inverse = false }: { className?: string; inverse?: boolean }) {
  return <span className={`brandLogo ${inverse ? "brandLogoInverse" : ""} ${className}`} role="img" aria-label="UnoMesa" translate="no">
    <img src="/brand/unomesa-logo.png" width="2172" height="724" alt="" draggable={false} />
    <img className="brandLogoLight" src="/brand/unomesa-logo.png" width="2172" height="724" alt="" aria-hidden="true" draggable={false} />
  </span>;
}
