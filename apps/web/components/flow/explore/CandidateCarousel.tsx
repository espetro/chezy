"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { CandidateCard } from "@/components/flow/explore/CandidateCard";
import type { FlowListing } from "@/lib/flow/types";
import { cn } from "@/lib/utils";

interface CandidateCarouselProps {
  listings: FlowListing[];
  label: string;
}

// Manual carousel, no autoplay — WCAG 2.2.2 (Pause, Stop, Hide) is trivially satisfied by
// never moving content on its own. Follows the WAI-ARIA APG "Carousel" pattern: a labeled
// region, each slide as a `group` with its own position label, and Previous/Next buttons
// that are the primary navigation (arrow-key/native scroll still works for touch and
// keyboard-focus-follows-scroll, but isn't the only way in).
export const CandidateCarousel = ({ listings, label }: CandidateCarouselProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const total = listings.length;

  const scrollToIndex = (index: number) => {
    const track = trackRef.current;
    const slide = track?.children[index];
    if (!(slide instanceof HTMLElement)) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    slide.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    });
    setActiveIndex(index);
  };

  const goPrevious = () => scrollToIndex(Math.max(activeIndex - 1, 0));
  const goNext = () => scrollToIndex(Math.min(activeIndex + 1, total - 1));

  // Keeps activeIndex honest when the user free-scrolls or swipes past the button-driven
  // index (so the live region and disabled states stay accurate either way).
  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, children } = track;
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    Array.from(children).forEach((child, index) => {
      if (!(child instanceof HTMLElement)) return;
      const distance = Math.abs(child.offsetLeft - scrollLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });
    setActiveIndex(closest);
  };

  if (total === 0) {
    return (
      <p className="rounded-cards bg-snow px-4 py-8 text-center text-[14px] text-fog shadow-sm sm:px-6">
        No candidates match these filters yet.
      </p>
    );
  }

  return (
    <section aria-label={label} aria-roledescription="carousel" className="relative">
      <div
        ref={trackRef}
        onScroll={handleTrackScroll}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {listings.map((listing, index) => (
          <div
            key={listing.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${total}`}
            className="w-[85%] shrink-0 snap-start sm:w-[380px]"
          >
            <CandidateCard listing={listing} />
          </div>
        ))}
      </div>

      <div aria-live="polite" className="sr-only">
        Showing match {activeIndex + 1} of {total}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Choose a match to view">
          {listings.map((listing, index) => (
            <button
              key={listing.id}
              type="button"
              aria-pressed={index === activeIndex}
              aria-label={`Go to match ${index + 1} of ${total}`}
              onClick={() => scrollToIndex(index)}
              className="group flex h-11 w-5 shrink-0 items-center justify-center"
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full transition-colors duration-200",
                  index === activeIndex ? "bg-obsidian" : "bg-mist group-hover:bg-ash",
                )}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={goPrevious}
            disabled={activeIndex === 0}
            aria-label="Previous match"
            className="flex size-11 items-center justify-center rounded-full border border-mist bg-snow text-graphite transition-opacity hover:border-iron disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={activeIndex === total - 1}
            aria-label="Next match"
            className="flex size-11 items-center justify-center rounded-full border border-mist bg-snow text-graphite transition-opacity hover:border-iron disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};
