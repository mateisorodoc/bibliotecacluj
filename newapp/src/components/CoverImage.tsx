import React, { useEffect, useMemo, useState } from "react";

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
      base: "#3a2c22",
      accent: "#75614c",
      border: "#22180f",
      text: "#f0e8dd",
      texture: "#ffffff"
    },
    {
      base: "#2e4048",
      accent: "#57717d",
      border: "#182329",
      text: "#e8f0f3",
      texture: "#ffffff"
    },
    {
      base: "#4a1f30",
      accent: "#8a445d",
      border: "#2a111b",
      text: "#f6e7ec",
      texture: "#ffffff"
    },
    {
      base: "#25403a",
      accent: "#4a786d",
      border: "#162620",
      text: "#e5f1ed",
      texture: "#ffffff"
    },
    {
      base: "#483723",
      accent: "#7c6447",
      border: "#2b2114",
      text: "#f2ebde",
      texture: "#ffffff"
    },
    {
      base: "#322947",
      accent: "#665086",
      border: "#1e172b",
      text: "#ece8f6",
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

function buildBookPlaceholderSvg(seedValue: string, titleValue: string): string {
  const palette = choosePalette(seedValue);
  const cleanTitle = titleValue
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 36);
  const titleTop = cleanTitle.slice(0, 18) || "Biblioteca";
  const titleBottom = cleanTitle.slice(18) || "Alternativa Cluj";

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
      <rect x="88" y="0" width="2" height="720" fill="${palette.texture}" opacity="0.22"/>
      <rect x="70" y="92" width="352" height="536" rx="4" fill="none" stroke="${palette.texture}" stroke-width="2" opacity="0.25"/>
      <rect x="110" y="172" width="260" height="258" rx="10" fill="${palette.border}" opacity="0.24"/>
      <rect x="124" y="482" width="232" height="2" fill="${palette.texture}" opacity="0.2"/>
      <rect x="124" y="500" width="190" height="2" fill="${palette.texture}" opacity="0.16"/>
      <text x="240" y="242" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="${palette.text}" letter-spacing="4">ARHIVA DIGITALA</text>
      <text x="240" y="308" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="${palette.text}">${titleTop}</text>
      <text x="240" y="344" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="${palette.text}">${titleBottom}</text>
      <text x="240" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="${palette.text}" opacity="0.8">Biblioteca Alternativa Cluj</text>
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
  const paletteSeed = seed || title || "generic";
  const genericBookCover = useMemo(() => buildBookPlaceholderSvg(paletteSeed, title || "Biblioteca Alternativa Cluj"), [paletteSeed, title]);
  const preferredSrc = (src || "").trim() || genericBookCover;
  const [currentSrc, setCurrentSrc] = useState(preferredSrc);

  useEffect(() => {
    setCurrentSrc(preferredSrc);
  }, [preferredSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt || title}
      className={className}
      referrerPolicy={referrerPolicy}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        if (currentSrc !== genericBookCover) {
          setCurrentSrc(genericBookCover);
        }
      }}
    />
  );
}
