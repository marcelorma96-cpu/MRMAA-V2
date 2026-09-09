"use client";

import { useEffect, useState } from "react";

export function TransparentLogo({
  src,
  alt,
  className,
  adaptDarkInk = false,
}: {
  src: string;
  alt: string;
  className?: string;
  adaptDarkInk?: boolean;
}) {
  const [processed, setProcessed] = useState(src),
    [dark, setDark] = useState(false);

  useEffect(() => {
    if (!adaptDarkInk) return;
    const sync = () => setDark(document.documentElement.dataset.theme === "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [adaptDarkInk]);

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
        if (adaptDarkInk && dark && neutral && Math.max(r, g, b) < 75) {
          pixels.data[i] = 255;
          pixels.data[i + 1] = 255;
          pixels.data[i + 2] = 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
      setProcessed(canvas.toDataURL("image/png"));
    };
    image.onerror = () => setProcessed(src);
    image.src = src;
  }, [src, adaptDarkInk, dark]);

  return <img className={className} src={processed} alt={alt} />;
}
