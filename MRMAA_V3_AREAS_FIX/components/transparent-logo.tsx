export function TransparentLogo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  // The background is already processed, when requested, at upload time.
  // Processing it again here could erase white or light-coloured logo artwork.
  return <img className={className} src={src} alt={alt} />;
}
