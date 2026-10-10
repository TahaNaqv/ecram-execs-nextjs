"use client";

import { useEffect, useRef, useState } from "react";

// YouTube clip shown in the Experience section. Times are in seconds of the source video.
const VIDEO_ID = "KCGUxO9fcC0";
const START = 77; // 1:17
const END = 305; // 5:05
const PLAYBACK_RATE = 2;
const EMBED_ORIGIN = "https://www.youtube-nocookie.com";

const formatDuration = (seconds: number) => {
  const s = Math.round(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Click-to-play facade for the brand film. Nothing is loaded from YouTube until the visitor presses play,
 * which keeps the page fast and avoids third-party cookies; the privacy-enhanced embed is used throughout.
 * The clip plays muted at double speed, driven through the player's postMessage API so no YouTube script runs on this page.
 */
export function BrandFilm() {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!playing) return;

    const send = (func: string, args: unknown[] = []) =>
      frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), EMBED_ORIGIN);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EMBED_ORIGIN || event.source !== frameRef.current?.contentWindow) return;
      let data: { event?: string; info?: { playerState?: number; playbackRate?: number } };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data.event === "onReady") send("setPlaybackRate", [PLAYBACK_RATE]);
      const info = data.event === "infoDelivery" ? data.info : undefined;
      // The player can reset its speed when playback starts, so reapply it whenever it drifts
      if (info?.playerState === 1 && info.playbackRate !== undefined && info.playbackRate !== PLAYBACK_RATE) {
        send("setPlaybackRate", [PLAYBACK_RATE]);
      }
      // Return to the poster at the end rather than showing YouTube's end screen
      if (info?.playerState === 0) setPlaying(false);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playing]);

  // Subscribe to player events once the iframe has loaded
  const onFrameLoad = () => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: VIDEO_ID, channel: "widget" }), EMBED_ORIGIN);
  };

  const params = new URLSearchParams({
    start: String(START),
    end: String(END),
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    rel: "0",
    enablejsapi: "1",
    ...(typeof window !== "undefined" ? { origin: window.location.origin } : {}),
  });

  if (playing) {
    return (
      <div className="ph relative aspect-video w-full overflow-hidden">
        <iframe
          ref={frameRef}
          className="absolute inset-0 h-full w-full border-0"
          src={`${EMBED_ORIGIN}/embed/${VIDEO_ID}?${params}`}
          title="Ecram Execs — the arrival"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={onFrameLoad}
        />
      </div>
    );
  }

  return (
    <div className="ph p-5 gap-[10px] items-start aspect-[4/5] flex-col justify-end relative w-full md:p-7 md:items-end md:aspect-[21/9] md:justify-between md:gap-0 md:flex-row">
      <span className="text-ink-550 text-[10px] tracking-[0.18em] max-w-full uppercase md:text-[11px] md:tracking-[0.24em] md:max-w-none">
        Brand film — guest collected by a VLE 300 Electric, shot from the client&apos;s perspective
      </span>
      <button className="top-1/2 left-1/2 border border-ink-250 rounded-full items-center bg-transparent text-white cursor-pointer flex h-19 justify-center absolute [transform:translate(-50%,-50%)] w-19 md:h-24 md:w-24" type="button" onClick={() => setPlaying(true)} aria-label="Play the film" title="Play the film">
        <span className="ring" aria-hidden="true"></span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M8 5l11 7-11 7z"></path>
        </svg>
      </button>
      <span className="text-ink-450 font-display text-[11px] tracking-[0.32em]">
        {formatDuration((END - START) / PLAYBACK_RATE)}
      </span>
    </div>
  );
}
