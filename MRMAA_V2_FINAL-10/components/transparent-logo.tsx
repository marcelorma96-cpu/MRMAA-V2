"use client";

import { useEffect, useState } from "react";

export function TransparentLogo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [processed, setProcessed] = useState(src);

  useEffect(() => {
    if (!src) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return setProcessed(src);
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const r = pixels.data[i];
        const g = pixels.data[i + 1];
        const b = pixels.data[i + 2];
        const lightest = Math.min(r, g, b);
        const neutral = Math.max(r, g, b) - lightest < 24;
        if (neutral && lightest > 205) {
          const opacity = Math.max(0, Math.min(1, (245 - lightest) / 40));
          pixels.data[i + 3] = Math.round(pixels.data[i + 3] * opacity);
        }
      }
      ctx.putImageData(pixels, 0, 0);
      setProcessed(canvas.toDataURL("image/png"));
    };
    image.onerror = () => setProcessed(src);
    image.src = src;
  }, [src]);

  return <img className={className} src={processed} alt={alt} />;
}
