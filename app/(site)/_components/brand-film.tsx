"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Built by scripts/build-brand-film.mts: the source cut to 1:17–5:05 at double speed, with background_music.mp3 as its soundtrack
const SRC = "/assets/brand-film.mp4";
const POSTER = "/assets/brand-film-poster.jpg";
const DURATION = 114; // seconds; keep in step with the build script
const CAPTION = "Brand film — guest collected by a VLE 300 Electric, shot from the client's perspective";

const formatDuration = (seconds: number) => {
  const s = Math.round(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Click-to-play brand film, self-hosted. Nothing is downloaded until the visitor presses play, and it plays with sound
 * because the press counts as the user gesture browsers require. It pauses when scrolled out of view so the music
 * never carries on unseen, and returns to the poster when it ends.
 */
export function BrandFilm() {
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
          aria-label="Ecram Execs — the arrival"
          onEnded={reset}
        />
        {!playing && (
          <div className="p-4 gap-[10px] items-start flex flex-col justify-end absolute inset-0 md:p-7 md:items-end md:justify-between md:gap-0 md:flex-row">
            <Image className="object-cover" src={POSTER} alt="" fill sizes="(min-width: 1536px) 1392px, (min-width: 1280px) 1232px, 100vw" />
            {/* Darkens the daylight still to sit with the site and keep the caption and controls legible */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,11,0.45)_0%,rgba(10,10,11,0.35)_45%,rgba(10,10,11,0.85)_100%)]" aria-hidden="true"></div>
            <span className="relative hidden text-ink-300 text-[11px] tracking-[0.24em] uppercase md:block">
              {CAPTION}
            </span>
            <button className="top-1/2 left-1/2 border border-ink-250 rounded-full items-center bg-[rgba(10,10,11,0.5)] shadow-[0_0_0_6px_rgba(10,10,11,0.35),0_0_32px_8px_rgba(10,10,11,0.55)] text-white cursor-pointer flex h-14 justify-center absolute [transform:translate(-50%,-50%)] w-14 md:h-24 md:w-24" type="button" onClick={start} aria-label="Play the film (with sound)" title="Play the film">
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
      {/* On phones the 16:9 frame is too short to hold the caption, so it sits underneath */}
      <span className="text-ink-450 text-[10px] tracking-[0.18em] uppercase md:hidden">
        {CAPTION}
      </span>
    </div>
  );
}
