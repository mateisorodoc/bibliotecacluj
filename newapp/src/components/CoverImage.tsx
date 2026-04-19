import React, { useMemo, useState } from "react";

type CoverImageProps = {
  src?: string;
  title: string;
  seed?: string;
  className?: string;
  alt?: string;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>["referrerPolicy"];
};

function choosePalette(seedValue: string) {
  const palettes = [
    {
      base: "#4a2f25",
      accent: "#7b5a47",
      border: "#2f1d17",
      text: "#f1e8dd",
      texture: "#ffffff"
    },
    {
      base: "#5b3a2b",
      accent: "#8a624d",
      border: "#352117",
      text: "#f4e9de",
      texture: "#ffffff"
    },
    {
      base: "#4f1f24",
      accent: "#8e3b46",
      border: "#2e1014",
      text: "#f7e6e8",
      texture: "#ffffff"
    },
    {
      base: "#642329",
      accent: "#9a4953",
      border: "#3a1116",
      text: "#f8eaec",
      texture: "#ffffff"
    },
    {
      base: "#1f3c2d",
      accent: "#3e6d56",
      border: "#14261d",
      text: "#e5f1ea",
      texture: "#ffffff"
    },
    {
      base: "#244433",
      accent: "#4a7a60",
      border: "#15281e",
      text: "#e8f2ec",
      texture: "#ffffff"
    }
  ];

  // FNV-1a gives a more even spread for similar ids/titles.
  let hash = 2166136261;
  for (let index = 0; index < seedValue.length; index += 1) {
    hash ^= seedValue.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return palettes[(hash >>> 0) % palettes.length];
}

function buildBookPlaceholderSvg(seedValue: string): string {
  const palette = choosePalette(seedValue);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720" role="img" aria-label="Coperta generica">
      <defs>
        <linearGradient id="coverG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette.accent}"/>
          <stop offset="100%" stop-color="${palette.base}"/>
        </linearGradient>
        <linearGradient id="spineG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${palette.border}"/>
          <stop offset="100%" stop-color="${palette.base}"/>
        </linearGradient>
      </defs>
      <rect width="480" height="720" fill="url(#coverG)"/>
      <rect x="36" y="0" width="52" height="720" fill="url(#spineG)" opacity="0.96"/>
      <rect x="88" y="0" width="2" height="720" fill="${palette.texture}" opacity="0.2"/>
      <rect x="70" y="92" width="352" height="536" rx="4" fill="none" stroke="${palette.texture}" stroke-width="2" opacity="0.22"/>
      <rect x="110" y="238" width="260" height="170" rx="10" fill="${palette.border}" opacity="0.22"/>
      <text x="240" y="312" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${palette.text}">Biblioteca</text>
      <text x="240" y="350" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="${palette.text}">Alternativa Cluj</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function CoverImage({
  src,
  title,
  seed,
  className,
  alt,
  referrerPolicy = "no-referrer"
}: CoverImageProps) {
  const genericBookCover = useMemo(() => buildBookPlaceholderSvg(seed || title || "generic"), [seed, title]);
  const [currentSrc, setCurrentSrc] = useState(genericBookCover);

  return (
    <img
      src={currentSrc}
      alt={alt || title}
      className={className}
      referrerPolicy={referrerPolicy}
      onError={() => {
        if (currentSrc !== genericBookCover) {
          setCurrentSrc(genericBookCover);
        }
      }}
    />
  );
}
