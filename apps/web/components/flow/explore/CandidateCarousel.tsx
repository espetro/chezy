"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { CandidateCard } from "~/components/flow/explore/CandidateCard";
import type { FlowListing } from "~/lib/flow/types";
import { cn } from "~/lib/utils";

interface CandidateCarouselProps {
  listings: FlowListing[];
  label: string;
  savedIds?: readonly string[];
  onToggleSave?: (listingId: string, saved: boolean) => Promise<boolean>;
  onDismiss?: (listingId: string) => Promise<boolean>;
  // Fires when the slide in view changes (buttons, dots, scroll or focus).
  onActiveChange?: (listing: FlowListing | undefined) => void;
  busy?: boolean;
}

// Manual carousel, no autoplay — WCAG 2.2.2 (Pause, Stop, Hide) is trivially satisfied by
// never moving content on its own. Follows the WAI-ARIA APG "Carousel" pattern: a labeled
// region, each slide as a `group` with its own position label, and Previous/Next buttons
// that are the primary navigation (arrow-key/native scroll still works for touch and
// keyboard-focus-follows-scroll, but isn't the only way in).
export const CandidateCarousel = ({
  listings,
  label,
  savedIds = [],
  onToggleSave,
  onDismiss,
  onActiveChange,
  busy,
}: CandidateCarouselProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | undefined>(undefined);
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndexState] = useState(0);
  const setActiveIndex = (index: number) => {
    setActiveIndexState(index);
    onActiveChange?.(listings[index]);
  };

  const total = listings.length;
  const currentIndex = Math.min(activeIndex, Math.max(0, total - 1));

  const visibleSlides = () =>
    Array.from(trackRef.current?.children ?? []).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        listings.some((listing) => listing.id === child.dataset.listingId),
    );

  const scrollToIndex = (index: number) => {
    const slide = visibleSlides()[index];
    if (!(slide instanceof HTMLElement)) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    slide.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    });
    setActiveIndex(index);
  };

  const goPrevious = () => {
    if (currentIndex > 0) scrollToIndex(currentIndex - 1);
  };
  const goNext = () => {
    if (currentIndex < total - 1) scrollToIndex(currentIndex + 1);
  };

  const focusReplacement = () => {
    if (!pendingFocus.current) return;
    const slides = visibleSlides();
    const slide = slides[0];
    pendingFocus.current = undefined;
    slide?.querySelector("a")?.focus({ preventScroll: true });
  };

  // Keeps activeIndex honest when the user free-scrolls or swipes past the button-driven
  // index (so the live region and disabled states stay accurate either way).
  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft } = track;
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    visibleSlides().forEach((child, index) => {
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
      <p
        tabIndex={-1}
        role="status"
        ref={(node) => {
          if (node && pendingFocus.current) {
            node.focus({ preventScroll: true });
            pendingFocus.current = undefined;
          }
        }}
        className="flex min-h-96 items-center justify-center rounded-cards bg-snow px-4 py-8 text-center text-[14px] text-fog shadow-sm focus-visible:outline-2 focus-visible:outline-obsidian sm:px-6"
      >
        No candidates match these filters yet.
      </p>
    );
  }

  return (
    <section aria-label={label} aria-roledescription="carousel" className="relative flex flex-col">
      <div
        ref={trackRef}
        onScroll={handleTrackScroll}
        className="relative flex snap-x snap-mandatory [scrollbar-width:none] gap-6 overflow-x-auto scroll-smooth pb-2 motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        <AnimatePresence initial={false} mode="popLayout" onExitComplete={focusReplacement}>
          {listings.map((listing, index) => (
            <motion.div
              key={listing.id}
              data-listing-id={listing.id}
              layout={reducedMotion ? false : "position"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion !== false ? 0 : -16 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${total}`}
              onFocusCapture={(event) => {
                const slide = event.currentTarget;
                const track = trackRef.current;
                const keyboard =
                  event.target instanceof HTMLElement && event.target.matches(":focus-visible");
                const slideRect = slide.getBoundingClientRect();
                const trackRect = track?.getBoundingClientRect();
                const clipped =
                  trackRect !== undefined &&
                  (slideRect.left < trackRect.left || slideRect.right > trackRect.right);
                if (keyboard || clipped) {
                  slide.scrollIntoView({
                    behavior: "instant",
                    block: "nearest",
                    inline: keyboard ? "start" : "nearest",
                  });
                }
                setActiveIndex(index);
              }}
              className="flex w-[85%] shrink-0 snap-start flex-col gap-2 sm:w-[380px]"
            >
              <CandidateCard
                listing={listing}
                saved={savedIds.includes(listing.id)}
                busy={busy}
                onToggleSave={onToggleSave}
                onDismiss={
                  onDismiss
                    ? async (listingId) => {
                        pendingFocus.current = listingId;
                        const saved = await onDismiss(listingId);
                        if (!saved) pendingFocus.current = undefined;
                        return saved;
                      }
                    : undefined
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div aria-live="polite" className="sr-only">
        Showing match {currentIndex + 1} of {total}
      </div>

      <div className="order-first mb-4 flex items-center justify-between gap-3 sm:order-none sm:mt-4 sm:mb-0">
        <div
          className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1.5 overflow-x-auto"
          role="group"
          aria-label="Choose a match to view"
        >
          {listings.map((listing, index) => (
            <button
              key={listing.id}
              type="button"
              aria-pressed={index === currentIndex}
              aria-label={`Go to match ${index + 1} of ${total}`}
              onClick={() => scrollToIndex(index)}
              className="group flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-obsidian"
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full transition-colors duration-200",
                  index === currentIndex ? "bg-obsidian" : "bg-mist group-hover:bg-ash",
                )}
              />
            </button>
          ))}
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={goPrevious}
            aria-disabled={currentIndex === 0}
            aria-label="Previous match"
            className="flex size-11 items-center justify-center rounded-full border border-mist bg-snow text-graphite transition-opacity hover:border-iron focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-disabled={currentIndex === total - 1}
            aria-label="Next match"
            className="flex size-11 items-center justify-center rounded-full border border-mist bg-snow text-graphite transition-opacity hover:border-iron focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};
