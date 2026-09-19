"use client";

import { House } from "lucide-react";
import { useRef, useState } from "react";

export function ListingGallery({ photos, title }: { photos: string[]; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = () => {
    const el = track.current;
    if (!el) {
      return;
    }
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-cloud text-fog">
        <House className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] max-h-[380px] w-full overflow-hidden bg-cloud">
      <div
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        onScroll={onScroll}
        ref={track}
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((url, i) => (
          <div className="relative h-full min-w-full snap-center" key={url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${title} — foto ${i + 1}`}
              className="h-full w-full object-cover"
              src={url}
            />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-obsidian/40 via-transparent to-obsidian/30" />
      <div className="absolute right-4 bottom-4 z-10">
        <span className="rounded-full bg-obsidian/75 px-3 py-1 text-snow text-xs tracking-widest backdrop-blur-md">
          {index + 1} / {photos.length}
        </span>
      </div>
    </div>
  );
}
