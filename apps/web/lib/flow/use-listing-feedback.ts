"use client";

import {
  FeedbackOutputSchema,
  type FeedbackEvent,
  type FeedbackInput,
  type FeedbackReason,
} from "@chezy/contract";
import { useRef, useState, useTransition } from "react";
import * as v from "valibot";

export type FeedbackHandler = (listingId: string, reason: FeedbackReason) => Promise<boolean>;

export const useListingFeedback = (onSaved: (event: FeedbackEvent) => void) => {
  const inFlight = useRef(false);
  const retryInput = useRef<FeedbackInput | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const submit = async (
    method: "POST" | "DELETE" | "PATCH",
    input: FeedbackInput | { eventId: string } | { eventId: string; reason: FeedbackReason },
  ) => {
    if (inFlight.current || refreshing) return false;
    inFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch("/api/feedback", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Couldn't save your preference. Please retry.");
      const { event } = v.parse(FeedbackOutputSchema, await response.json());
      retryInput.current = undefined;
      startTransition(() => {
        onSaved(event);
      });
      return true;
    } catch {
      setError("Couldn't save your preference. Please retry.");
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const reject: FeedbackHandler = (listingId, reason) => {
    if (inFlight.current || refreshing) return Promise.resolve(false);
    if (retryInput.current?.listingId !== listingId || retryInput.current.reason !== reason) {
      retryInput.current = { eventId: crypto.randomUUID(), listingId, reason };
    }
    return submit("POST", retryInput.current);
  };

  return {
    reject,
    undo: (eventId: string) => submit("DELETE", { eventId }),
    refine: (eventId: string, reason: FeedbackReason) => submit("PATCH", { eventId, reason }),
    busy: saving || refreshing,
    error,
  };
};
