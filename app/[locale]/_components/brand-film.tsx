"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// The client's showreel (new cut supplied 31 Oct 2026, 1080p30, 9 Mbps, 57.3 MB), re-encoded to H.264 high profile 1080p30 at
// about 3.5 Mbps, AAC 160 kbps stereo, faststart: 21.4 MB. The poster is the frame at 3.0 s, where the chauffeur greets the
// passenger at the airport. A new cut needs new filenames: /assets is cached for 7 days.
// (The earlier cuts, brand-film.mp4 from scripts/build-brand-film.mts, brand-film-v2.mp4 and brand-film-v3.mp4, no longer feed this.)
const SRC = "/assets/brand-film-v4.mp4";
const POSTER = "/assets/brand-film-poster-v4.jpg";
const DURATION = 50; // seconds; keep in step with the film (49.85 s)

const formatDuration = (seconds: number) => {
  const s = Math.round(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Click-to-play brand film, self-hosted. Nothing is downloaded until the visitor presses play, and it plays with sound
 * because the press counts as the user gesture browsers require. It pauses when scrolled out of view so the music
 * never carries on unseen, and returns to the poster when it ends.
 */
export type BrandFilmCopy = { videoLabel: string; play: string; playTitle: string };

export function BrandFilm({ copy }: { copy: BrandFilmCopy }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!playing || !video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, [playing]);

  // play() is called inside the click handler itself, as iOS Safari only allows sound from within the gesture
  const start = () => {
    setPlaying(true);
    // If the browser still refuses, the native controls are showing, so the visitor can start it from there
    videoRef.current?.play().catch(() => {});
  };

  const reset = () => {
    setPlaying(false);
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="ph relative aspect-video w-full overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-black object-cover"
          src={SRC}
          poster={POSTER}
          preload="none"
          playsInline
          controls={playing}
          controlsList="nodownload"
          disablePictureInPicture={!playing}
          tabIndex={playing ? 0 : -1}
          aria-hidden={!playing}
          aria-label={copy.videoLabel}
          onEnded={reset}
        />
        {!playing && (
          <div className="keep-navy p-4 gap-[10px] items-start flex flex-col justify-end absolute inset-0 md:p-7 md:items-end md:justify-end md:gap-0 md:flex-row">
            <Image className="object-cover" src={POSTER} alt="" fill sizes="(min-width: 1536px) 1392px, (min-width: 1280px) 1232px, 100vw" />
            {/* Darkens the daylight still to sit with the site and keep the caption and controls legible */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(var(--ec-black-rgb),0.45)_0%,rgba(var(--ec-black-rgb),0.35)_45%,rgba(var(--ec-black-rgb),0.85)_100%)]" aria-hidden="true"></div>
            <button className="top-1/2 left-1/2 border border-ink-250 rounded-full items-center bg-[rgba(var(--ec-black-rgb),0.5)] shadow-[0_0_0_6px_rgba(var(--ec-black-rgb),0.35),0_0_32px_8px_rgba(var(--ec-black-rgb),0.55)] text-white cursor-pointer flex h-14 justify-center absolute [transform:translate(-50%,-50%)] w-14 md:h-24 md:w-24" type="button" onClick={start} aria-label={copy.play} title={copy.playTitle}>
              <span className="ring" aria-hidden="true"></span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M8 5l11 7-11 7z"></path>
              </svg>
            </button>
            <span className="relative text-ink-300 font-display text-[11px] tracking-[0.32em]">
              {formatDuration(DURATION)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
