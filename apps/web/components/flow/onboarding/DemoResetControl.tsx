"use client";

import { useState } from "react";

import { clearDemoAutoCallMarkers } from "~/lib/demo/storage";

export const DemoResetControl = () => {
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
      className="mx-auto w-full max-w-xl space-y-2 rounded-xl bg-snow p-4 text-sm"
    >
      <p>Fixture demo: Norrsken, €1,500–2,500/month, 2 bedrooms, balcony or terrace.</p>
      <p>Replaces this session’s preferences. Uses seeded listings and mock calls.</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void reset(true)}
          className="rounded-lg bg-ember px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Reset and load demo"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void reset(false)}
          className="rounded-lg bg-paper px-4 py-2 disabled:opacity-50"
        >
          Reset to empty onboarding
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : undefined}
    </section>
  );
};
