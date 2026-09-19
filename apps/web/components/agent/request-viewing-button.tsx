"use client";

import { CalendarPlus, Loader2 } from "lucide-react";
import { useState } from "react";

interface ViewingResult {
  status: "mock" | "dispatched" | "failed";
  channel: string;
  callId?: string;
  slotIso?: string;
  detail?: string;
}

const slotFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export function RequestViewingButton({
  propertyRef,
  className = "",
}: {
  propertyRef: string;
  className?: string;
}) {
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "pending" }
    | { phase: "done"; result: ViewingResult }
    | { phase: "error"; detail: string }
  >({ phase: "idle" });

  const request = async () => {
    setState({ phase: "pending" });
    try {
      const res = await fetch("/api/viewing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyRef }),
      });
      const data = (await res.json().catch(() => null)) as ViewingResult | null;
      if (res.ok && data && data.status !== "failed") {
        setState({ phase: "done", result: data });
      } else {
        setState({
          phase: "error",
          detail: data?.detail ?? "No se pudo reservar la visita.",
        });
      }
    } catch {
      setState({ phase: "error", detail: "Error de red al llamar a Chezy." });
    }
  };

  if (state.phase === "done") {
    const slot = state.result.slotIso
      ? slotFormatter.format(new Date(state.result.slotIso))
      : "horario por confirmar";
    return (
      <div
        className={`flex min-w-0 flex-1 flex-col gap-0.5 rounded-2xl bg-paper px-4 py-3 ${className}`}
      >
        <span className="font-semibold text-obsidian text-sm">
          Visita pre-agendada · {slot}
        </span>
        {state.result.status === "dispatched" && (
          <span className="text-ember text-xs">Llamada en curso (SLNG)</span>
        )}
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div
        className={`min-w-0 flex-1 rounded-2xl bg-red-50 px-4 py-3 text-red-700 text-sm ${className}`}
      >
        {state.detail}
      </div>
    );
  }

  return (
    <button
      className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-obsidian px-4 font-semibold text-sm text-snow transition-all hover:bg-slate active:scale-[0.98] disabled:opacity-70 ${className}`}
      disabled={state.phase === "pending"}
      onClick={request}
      type="button"
    >
      {state.phase === "pending" ? (
        <>
          <Loader2 className="h-4.5 w-4.5 animate-spin text-ember" />
          <span className="truncate">Chezy está llamando…</span>
        </>
      ) : (
        <>
          <CalendarPlus className="h-4.5 w-4.5 text-ember" />
          <span className="truncate">Reservar visita con Chezy</span>
        </>
      )}
    </button>
  );
}
