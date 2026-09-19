"use client";

import { useState } from "react";

export type CandidateDismissHandler = (listingId: string) => void;

export function useCandidateDismissal() {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const dismissCandidate: CandidateDismissHandler = (listingId) => {
    setDismissedIds((ids) => (ids.includes(listingId) ? ids : [...ids, listingId]));
  };
  const restoreCandidate = (listingId: string) => {
    setDismissedIds((ids) => ids.filter((id) => id !== listingId));
  };
  return { dismissedIds, dismissCandidate, restoreCandidate };
}
