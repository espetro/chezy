"use client";

import type { BookingResult, ViewingResult } from "@chezy/contract";
import { useState } from "react";

import { propertyAt } from "@/lib/fixtures/mock-properties";

type View = "concierge" | "radar";
type Phase = "idle" | "calling" | "booked" | "error";

interface CallState {
  readonly phase: Phase;
  readonly transcript: readonly string[];
  readonly slotIso?: string;
  readonly detail?: string;
}

const MESSAGES: readonly { readonly role: "user" | "assistant"; readonly text: string }[] = [
  {
    role: "user",
    text: "Find me a bright 2 bed near Arc de Triomf, under 380k.",
  },
  {
    role: "assistant",
    text: "Three candidates. Card 1 has a problem: 0% direct sunlight, windows onto a 1.5 m lightwell, and it is 13% over the El Raval average.",
  },
  {
    role: "assistant",
    text: "Card 2 in Eixample is south facing and 17% under the neighborhood average. Want me to line that one up?",
  },
];

const IDLE: CallState = { phase: "idle", transcript: [] };

export default function Page(): React.JSX.Element {
  const [view, setView] = useState<View>("concierge");
  const [index, setIndex] = useState(0);
  const [call, setCall] = useState<CallState>(IDLE);
  const property = propertyAt(index);

  async function like(): Promise<void> {
    setCall({
      phase: "calling",
      transcript: [
        `Dialing ${property.agentLine}...`,
        "Agent: Hola, soy el asistente autonomo de Jessie. Llamo por el piso.",
        "Agency: Si, sigue disponible. Cuando quieres visitarlo?",
        "Agent: Manana a las 16:00 o el jueves a las 10:00.",
      ],
    });
    try {
      const viewingResponse = await fetch("/api/viewing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyRef: property.id,
          agencyPhone: property.agentLine,
        }),
      });
      const viewing = (await viewingResponse.json()) as ViewingResult;
      const slotIso =
        viewing.slotIso ?? new Date(Date.now() + 86_400_000).toISOString();

      const bookingResponse = await fetch("/api/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyRef: property.id,
          slotIso,
          durationMinutes: 30,
        }),
      });
      const booking = (await bookingResponse.json()) as BookingResult;

      const detail = booking.detail ?? viewing.detail;
      setCall({
        phase: booking.status === "booked" ? "booked" : "error",
        transcript: [
          `Dialing ${property.agentLine}...`,
          "Agent: Hola, soy el asistente autonomo de Jessie. Llamo por el piso.",
          "Agency: Si, sigue disponible. Cuando quieres visitarlo?",
          "Agent: Manana a las 16:00 o el jueves a las 10:00.",
          "Agency: Manana a las 16:00 esta bien.",
          "Agent: Perfecto, confirmo la visita. Hasta luego.",
        ],
        slotIso: booking.slotIso,
        ...(detail === undefined ? {} : { detail }),
      });
    } catch (error) {
      setCall({
        phase: "error",
        transcript: ["Call failed."],
        detail: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 64px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <strong style={{ letterSpacing: 1 }}>chezy</strong>
        <nav style={{ display: "flex", gap: 4, background: "#17171a", borderRadius: 10, padding: 4 }}>
          {(["concierge", "radar"] as const).map((name) => (
            <button
              key={name}
              onClick={() => setView(name)}
              style={{
                border: 0,
                borderRadius: 7,
                padding: "6px 14px",
                cursor: "pointer",
                background: view === name ? "#fafafa" : "transparent",
                color: view === name ? "#0a0a0a" : "#a1a1aa",
              }}
            >
              {name === "concierge" ? "Concierge" : "Radar"}
            </button>
          ))}
        </nav>
      </header>

      {view === "concierge" ? (
        <section style={{ marginTop: 24, display: "grid", gap: 10 }}>
          {MESSAGES.map((message, i) => (
            <div
              key={i}
              style={{
                justifySelf: message.role === "user" ? "end" : "start",
                maxWidth: "85%",
                background: message.role === "user" ? "#2563eb" : "#1c1c1e",
                padding: "10px 14px",
                borderRadius: 14,
                lineHeight: 1.4,
              }}
            >
              {message.text}
            </div>
          ))}
          <button
            onClick={() => setView("radar")}
            style={{
              marginTop: 8,
              justifySelf: "start",
              border: "1px solid #3b82f6",
              background: "transparent",
              color: "#60a5fa",
              borderRadius: 10,
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            {"->"} View on Radar
          </button>
        </section>
      ) : (
        <section style={{ marginTop: 24 }}>
          <article
            style={{
              border: "1px solid #27272a",
              borderRadius: 18,
              padding: 20,
              background: "#111113",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{property.title}</h2>
              <span style={{ color: "#a1a1aa" }}>{property.neighborhood}</span>
            </div>
            <p style={{ fontSize: 28, margin: "10px 0 4px" }}>
              {"EUR "}
              {property.priceEur.toLocaleString("en-US")}
            </p>
            <p style={{ margin: 0, color: "#a1a1aa" }}>
              {property.cadastralSqm} m2 · {property.pricePerSqm} EUR/m2 (barrio{" "}
              {property.neighborhoodAvgPerSqm})
            </p>
            {property.sunlight === "lightwell" ? (
              <p
                style={{
                  marginTop: 14,
                  background: "#3a2a08",
                  border: "1px solid #b45309",
                  color: "#fbbf24",
                  padding: "10px 12px",
                  borderRadius: 10,
                }}
              >
                Forensic warning: 0% direct sunlight, windows onto an inner patio.
              </p>
            ) : (
              <p style={{ marginTop: 14, color: "#4ade80" }}>
                Forensic check passed: direct sunlight confirmed.
              </p>
            )}
            <ul style={{ color: "#d4d4d8", lineHeight: 1.6 }}>
              {property.truthTags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </article>

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              onClick={() => {
                setCall(IDLE);
                setIndex((i) => i + 1);
              }}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: 12,
                border: "1px solid #3f3f46",
                background: "transparent",
                color: "#fafafa",
                cursor: "pointer",
              }}
            >
              Pass
            </button>
            <button
              onClick={() => void like()}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: 12,
                border: 0,
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Like, call the agency
            </button>
          </div>
        </section>
      )}

      {call.phase !== "idle" ? (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "#111113",
              border: "1px solid #27272a",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              {call.phase === "calling"
                ? "Live call"
                : call.phase === "booked"
                  ? "Viewing confirmed"
                  : "Call failed"}
            </h3>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 13,
                color: "#d4d4d8",
                display: "grid",
                gap: 6,
                marginBottom: 14,
              }}
            >
              {call.transcript.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
            {call.slotIso ? (
              <p style={{ color: "#4ade80" }}>
                Booked {new Date(call.slotIso).toLocaleString("es-ES")}
                {call.detail ? ` (${call.detail})` : ""}
              </p>
            ) : null}
            <button
              onClick={() => setCall(IDLE)}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 10,
                border: 0,
                background: "#27272a",
                color: "#fafafa",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
