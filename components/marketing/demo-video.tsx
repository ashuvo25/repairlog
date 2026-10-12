"use client";

import { useRef, useState } from "react";

import { PlayIcon } from "@/components/ui/icons";

const CLOUDINARY_BASE = "https://res.cloudinary.com/dnbdcic4r/video/upload";
const VIDEO_ID = "v1791370713/RepairLog";

// The first frame is blank, so the poster is taken four seconds in.
const VIDEO_SRC = `${CLOUDINARY_BASE}/q_auto/${VIDEO_ID}.mp4`;
const POSTER_SRC = `${CLOUDINARY_BASE}/so_4,w_1600,q_auto,f_auto/${VIDEO_ID}.jpg`;

export function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function start() {
    setStarted(true);
    // Controls stay available if the browser refuses to start playback.
    videoRef.current?.play().catch(() => {});
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-[#f2ede2] shadow-[0_24px_60px_-20px_rgba(23,37,29,0.28)]">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        poster={POSTER_SRC}
        controls={started}
        playsInline
        preload="none"
        aria-label="RepairLog product walkthrough"
        className="size-full object-cover"
      />
      {started ? null : (
        <button
          type="button"
          onClick={start}
          className="group absolute inset-0 flex items-end justify-center pb-3 sm:pb-[7%]"
        >
          <span className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-primary py-1.5 pr-5 pl-1.5 text-sm font-semibold sm:min-h-12 sm:gap-3 sm:py-2 sm:pr-6 sm:pl-2 sm:text-base text-white shadow-lg transition-colors group-hover:bg-primary-hover">
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-primary sm:size-9">
              <PlayIcon className="size-4" />
            </span>
            Watch the walkthrough
          </span>
        </button>
      )}
    </div>
  );
}
