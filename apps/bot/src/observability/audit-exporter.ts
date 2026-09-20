// Folds each agent run into the same `chat.turn.*` audit vocabulary the web
// route emits (apps/web app/(chat)/api/chat/route.ts), via the shared
// `summarizeTurn` from `~/lib/ai/turn-audit`. Spans are buffered per traceId;
// the record is emitted once the root AGENT_RUN span has ended AND every
// started TOOL_CALL span has ended — approval-gated tools end after the root
// (the run suspends, then resumes in the same trace), so a naive
// emit-on-root-end would lose them.
import type {
  AnyExportedSpan,
  ObservabilityExporter,
  TracingEvent,
} from "@mastra/core/observability";
import { SpanType, TracingEventType } from "@mastra/core/observability";
import { createAuditLogger, type AuditLogger } from "@chezy/observability";

import { DEFAULT_CHAT_MODEL_ID } from "~/lib/constants";
import { summarizeTurn } from "~/lib/ai/turn-audit";

import { env } from "../env";
import { THREAD_CONTEXT_KEY, USERNAME_CONTEXT_KEY } from "../tools/adapt";

// A trace whose root never ends (crashed run, dropped events) would otherwise
// leak its buffer forever; evict entries older than this on every event.
const TRACE_BUFFER_TTL_MS = 10 * 60 * 1000;

interface TraceBuffer {
  firstSeen: number;
  root?: AnyExportedSpan;
  pendingToolSpans: Set<string>;
  toolCalls: Array<{ name: string; ok: boolean; result?: unknown; input?: unknown }>;
}

// TOOL_CALL span names look like `tool: 'arrangeViewing'` or the bare tool id
// depending on the SDK version; normalise both.
function toolNameOf(span: AnyExportedSpan): string {
  const quoted = /^tool:\s*'([^']+)'/.exec(span.name);
  if (quoted) return quoted[1];
  return span.name.replace(/^tool:\s*/, "");
}

export class ChezyAuditExporter implements ObservabilityExporter {
  readonly name = "chezy-audit";
  private readonly traces = new Map<string, TraceBuffer>();
  private readonly audit: AuditLogger;

  constructor(auditLogger?: AuditLogger) {
    this.audit = auditLogger ?? createAuditLogger("chat");
  }

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.onTracingEvent(event);
  }

  async flush(): Promise<void> {}

  async shutdown(): Promise<void> {
    this.traces.clear();
  }

  onTracingEvent(event: TracingEvent): void {
    const now = Date.now();
    for (const [traceId, b] of this.traces) {
      if (now - b.firstSeen > TRACE_BUFFER_TTL_MS) {
        this.traces.delete(traceId);
      }
    }

    const span = event.exportedSpan;
    const buffer = this.traces.get(span.traceId) ?? {
      firstSeen: now,
      pendingToolSpans: new Set(),
      toolCalls: [],
    };
    this.traces.set(span.traceId, buffer);

    if (span.type === SpanType.TOOL_CALL) {
      if (event.type === TracingEventType.SPAN_STARTED) {
        buffer.pendingToolSpans.add(span.id);
        return;
      }
      if (event.type === TracingEventType.SPAN_ENDED) {
        buffer.pendingToolSpans.delete(span.id);
        const attrs = span.attributes as { success?: boolean } | undefined;
        const ok = attrs?.success ?? !span.errorInfo;
        buffer.toolCalls.push({
          name: toolNameOf(span),
          ok: Boolean(ok),
          result: span.output,
          input: span.input,
        });
        this.maybeEmit(span.traceId, buffer);
      }
      return;
    }

    if (
      event.type === TracingEventType.SPAN_ENDED &&
      span.type === SpanType.AGENT_RUN &&
      span.isRootSpan
    ) {
      buffer.root = span;
      this.maybeEmit(span.traceId, buffer);
    }
  }

  private maybeEmit(traceId: string, buffer: TraceBuffer): void {
    const span = buffer.root;
    if (!span || buffer.pendingToolSpans.size > 0) {
      return;
    }
    this.traces.delete(traceId);

    // requestContextKeys lifts these into span.metadata; some SDK paths also
    // serialize the whole requestContext onto the root span. Read both.
    const ctx = {
      ...(span.requestContext ?? {}),
      ...(span.metadata ?? {}),
    } as Record<string, unknown>;
    const username = ctx[USERNAME_CONTEXT_KEY];
    const threadId = ctx[THREAD_CONTEXT_KEY];
    const output = span.output as { text?: string } | undefined;
    const failed = Boolean(span.errorInfo);

    const summary = summarizeTurn({
      channel: "telegram",
      model: env.CHEZY_MODEL_ID ?? DEFAULT_CHAT_MODEL_ID,
      startedAt: span.startTime.getTime(),
      toolCalls: buffer.toolCalls,
      assistantText: output?.text ?? "",
    });

    this.audit.emit({
      actor: typeof username === "string" && username.length > 0 ? username : "telegram:unknown",
      action: failed ? "chat.turn.fail" : "chat.turn.complete",
      target: typeof threadId === "string" ? threadId : undefined,
      outcome: failed ? "failure" : "success",
      ctx: {
        ...summary,
        ...(failed ? { message: span.errorInfo?.message } : {}),
      },
    });
  }
}
