"use client";

import { FlaskConical } from "lucide-react";
import { useState } from "react";

import { FlowButton } from "~/components/flow/ui/Button";
import { clearDemoAutoCallMarkers } from "~/lib/demo/storage";

export const DemoResetControl = () => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const reset = async (loadPersona: boolean) => {
    setPending(true);
    setError(undefined);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    try {
      const response = await fetch(`${basePath}/api/demo/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loadPersona }),
      });
      if (!response.ok) {
        const result: { error?: string } = await response.json();
        throw new Error(result.error ?? "Couldn't reset the demo.");
      }
      try {
        clearDemoAutoCallMarkers(window.localStorage);
      } catch {
        throw new Error("Profile reset, but browser storage is blocked. Enable storage and retry.");
      }
      window.location.assign(`${basePath}${loadPersona ? "/explore" : "/onboarding"}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't reset the demo.");
      setPending(false);
    }
  };

  return (
    <section
      aria-label="Demo reset"
      className="mx-auto w-full max-w-md px-4 pt-3 sm:max-w-xl sm:px-6"
    >
      <div className="rounded-cards bg-snow px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-label-md text-fog">
            <FlaskConical size={14} aria-hidden />
            Demo tools
          </p>
          <FlowButton
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls="demo-reset-panel"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide" : "Show"}
          </FlowButton>
        </div>
        {open ? (
          <div id="demo-reset-panel" className="mt-3 space-y-3">
            <p className="text-[13px] text-fog">
              Fixture demo: Norrsken, €1,500–2,500/month, 2 bedrooms, balcony or terrace.
            </p>
            <p className="text-[13px] text-fog">
              Replaces this session’s preferences. Uses seeded listings and mock calls.
            </p>
            <div className="flex flex-wrap gap-2">
              <FlowButton size="sm" disabled={pending} onClick={() => void reset(true)}>
                {pending ? "Resetting…" : "Reset and load demo"}
              </FlowButton>
              <FlowButton
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => void reset(false)}
              >
                Reset to empty onboarding
              </FlowButton>
            </div>
            {error ? (
              <p role="alert" className="text-ember">
                {error}
              </p>
            ) : undefined}
          </div>
        ) : undefined}
      </div>
    </section>
  );
};
