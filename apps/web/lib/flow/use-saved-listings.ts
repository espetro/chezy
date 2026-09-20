"use client";

import { SavedOutputSchema } from "@chezy/contract";
import { useRef, useState } from "react";
import * as v from "valibot";

// Optimistic heart toggle backed by PUT /api/saved; rolls back on failure.
export const useSavedListings = (initialIds: readonly string[]) => {
  const [savedIds, setSavedIds] = useState<readonly string[]>(initialIds);
  const [error, setError] = useState<string>();
  const inFlight = useRef(new Set<string>());

  const apply = (listingId: string, saved: boolean) =>
    setSavedIds((current) =>
      saved
        ? current.includes(listingId)
          ? current
          : [...current, listingId]
        : current.filter((id) => id !== listingId),
    );

  const toggleSave = async (listingId: string, saved: boolean) => {
    if (inFlight.current.has(listingId)) return false;
    inFlight.current.add(listingId);
    setError(undefined);
    apply(listingId, saved);
    try {
      const response = await fetch("/api/saved", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, saved }),
      });
      if (!response.ok) throw new Error("Couldn't update your saved homes. Please retry.");
      const result = v.parse(SavedOutputSchema, await response.json());
      apply(result.listingId, result.saved);
      return true;
    } catch {
      apply(listingId, !saved);
      setError("Couldn't update your saved homes. Please retry.");
      return false;
    } finally {
      inFlight.current.delete(listingId);
    }
  };

  return { savedIds, toggleSave, error };
};
