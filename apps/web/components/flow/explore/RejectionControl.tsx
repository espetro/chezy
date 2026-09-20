"use client";

import { FEEDBACK_REASONS, type FeedbackReason } from "@chezy/contract";
import { useCallback, useId, useRef, useState } from "react";
import { FlowButton } from "~/components/flow/ui/Button";
import type { FeedbackHandler } from "~/lib/flow/use-listing-feedback";

const labels: Record<FeedbackReason, string> = {
  too_expensive: "Too expensive",
  wrong_area: "Wrong area",
  missing_balcony: "Missing balcony",
};

interface RejectionControlProps {
  listingId: string;
  title: string;
  disabled?: boolean;
  onReject: FeedbackHandler;
}

export const RejectionControl = ({
  listingId,
  title,
  disabled,
  onReject,
}: RejectionControlProps) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const focusFirst = useCallback(
    (node: HTMLFieldSetElement | null) => node?.querySelector("button")?.focus(),
    [],
  );
  const close = () => {
    setOpen(false);
    root.current?.querySelector("button")?.focus();
  };
  return (
    <div
      ref={root}
      className="w-full"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          close();
        }
      }}
    >
      <FlowButton
        variant="ghost"
        className="w-full"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Not for me: ${title}`}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        Not for me
      </FlowButton>
      {open && (
        <fieldset
          ref={focusFirst}
          id={id}
          disabled={disabled}
          className="mt-2 flex flex-col gap-2 rounded-cards bg-snow p-3"
        >
          <legend className="text-sm">What would you change?</legend>
          {FEEDBACK_REASONS.map((reason) => (
            <FlowButton
              key={reason}
              variant="ghost"
              onClick={async () => {
                if (await onReject(listingId, reason)) setOpen(false);
              }}
            >
              {labels[reason]}
            </FlowButton>
          ))}
          <FlowButton variant="ghost" onClick={close}>
            Cancel
          </FlowButton>
        </fieldset>
      )}
    </div>
  );
};
