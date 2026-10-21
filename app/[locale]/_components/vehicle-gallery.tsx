"use client";

import { useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

export function VehicleGallery({
  name,
  images,
  alt,
  copy,
}: {
  name: string;
  images: string[];
  alt: string;
  copy: {
    label: string;
    prev: string;
    next: string;
    enlarge: string;
    close: string;
    counter: string;
    lightbox: string;
  };
}) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  };

  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  };

  return (
    <>
      <div 
        onClick={() => setLightboxOpen(true)}
        className="w-full aspect-[16/10] relative bg-ink-100 overflow-hidden group cursor-pointer rounded-xs border border-ink-200"
      >
        <Image
          src={images[index]}
          alt={`${alt} — ${index + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 350px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          priority={index === 0}
        />

        {/* Small Sleek Nav Arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label={copy.prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-black text-white rounded-full transition-all opacity-80 group-hover:opacity-100 cursor-pointer shadow-md"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={copy.next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-black text-white rounded-full transition-all opacity-80 group-hover:opacity-100 cursor-pointer shadow-md"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </>
        )}

        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 tracking-widest rounded-xs">
          {index + 1} / {images.length}
        </div>

        <div className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-xs opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </div>
      </div>

      {lightboxOpen && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          aria-label={copy.lightbox}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative w-full max-w-5xl aspect-[16/10] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[index]}
              alt={`${alt} — ${index + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label={copy.close}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer text-lg z-10"
            >
              ✕
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  aria-label={copy.prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/60 hover:bg-black text-white rounded-full transition-all cursor-pointer shadow-lg"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label={copy.next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/60 hover:bg-black text-white rounded-full transition-all cursor-pointer shadow-lg"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 tracking-widest rounded-full">
              {index + 1} / {images.length} — {name}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}