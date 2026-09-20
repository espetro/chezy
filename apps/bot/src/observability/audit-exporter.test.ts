import { describe, expect, it, vi } from "vitest";
import type { AnyExportedSpan, TracingEvent } from "@mastra/core/observability";
import { SpanType, TracingEventType } from "@mastra/core/observability";
import type { AuditEvent, AuditLogger } from "@chezy/observability";

import { ChezyAuditExporter } from "./audit-exporter";

function span(partial: Partial<AnyExportedSpan> & Pick<AnyExportedSpan, "id" | "type" | "name">) {
  return {
    traceId: "trace-1",
    isRootSpan: false,
    isEvent: false,
    startTime: new Date(Date.now() - 1000),
    endTime: new Date(),
    ...partial,
  } as AnyExportedSpan;
}

const ended = (exportedSpan: AnyExportedSpan): TracingEvent => ({
  type: TracingEventType.SPAN_ENDED,
  exportedSpan,
});

function collector() {
  const events: AuditEvent[] = [];
  const logger: AuditLogger = {
    emit: (e) => {
      events.push(e);
    },
    child: () => logger,
  };
  return { events, logger };
}

describe("ChezyAuditExporter", () => {
  it("emits one chat.turn.complete audit record per agent run", () => {
    const { events, logger } = collector();
    const exporter = new ChezyAuditExporter(logger);

    exporter.onTracingEvent(
      ended(
        span({
          id: "tool-1",
          type: SpanType.TOOL_CALL,
          name: "tool:searchListings",
          attributes: { success: true } as never,
          output: { listings: [{ id: "fotocasa:1" }, { id: "idealista:2" }] },
        }),
      ),
    );
    exporter.onTracingEvent(
      ended(
        span({
          id: "run-1",
          type: SpanType.AGENT_RUN,
          name: "agent:chezy",
          isRootSpan: true,
          metadata: { "chezy.username": "tg-1--abcd", "chezy.threadId": "chat-9" },
          output: { text: "Check https://www.idealista.com/inmueble/2/" } as never,
        }),
      ),
    );

    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.action).toBe("chat.turn.complete");
    expect(e.actor).toBe("tg-1--abcd");
    expect(e.target).toBe("chat-9");
    expect(e.outcome).toBe("success");
    const ctx = e.ctx as Record<string, unknown>;
    expect(ctx.channel).toBe("telegram");
    expect(ctx.latency_ms).toBeGreaterThanOrEqual(1000);
    expect(ctx.tools).toEqual([
      { name: "searchListings", ok: true, listingIds: ["fotocasa:1", "idealista:2"] },
    ]);
    expect(ctx.cited_listing_ids).toEqual(["idealista:2"]);
    expect(JSON.stringify(ctx)).not.toContain("hola");
  });

  it("drops trace buffers older than the TTL", () => {
    vi.useFakeTimers();
    const { events, logger } = collector();
    const exporter = new ChezyAuditExporter(logger);

    // A tool span starts on a trace whose root never ends.
    exporter.onTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: span({ id: "tool-stale", type: SpanType.TOOL_CALL, name: "tool:x" }),
    });
    // 11 minutes later an unrelated event arrives and evicts the stale buffer.
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    exporter.onTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: span({ id: "other", type: SpanType.MODEL_STEP, name: "step", traceId: "t2" }),
    });
    // The stale root ending late must not attribute the evicted tool call.
    exporter.onTracingEvent(
      ended(
        span({ id: "run-stale", type: SpanType.AGENT_RUN, name: "agent:chezy", isRootSpan: true }),
      ),
    );
    vi.useRealTimers();

    expect(events).toHaveLength(1);
    expect((events[0].ctx as { tools: unknown[] }).tools).toEqual([]);
  });

  it("emits chat.turn.fail with telegram:unknown actor when the root span errors", () => {
    const { events, logger } = collector();
    const exporter = new ChezyAuditExporter(logger);

    exporter.onTracingEvent(
      ended(
        span({
          id: "run-2",
          type: SpanType.AGENT_RUN,
          name: "agent:chezy",
          isRootSpan: true,
          errorInfo: { message: "boom" } as never,
        }),
      ),
    );

    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("chat.turn.fail");
    expect(events[0].actor).toBe("telegram:unknown");
    expect(events[0].outcome).toBe("failure");
    expect((events[0].ctx as { message?: string }).message).toBe("boom");
  });
});
