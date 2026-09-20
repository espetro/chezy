// Bridge apps/web AI SDK `tool()` definitions into Mastra `createTool`s.
// The web tools take `username` in their input schema; on Telegram the user is
// already identified, so the field is stripped from the advertised schema and
// injected from the channel context at execute time — the model can never
// invent a username.
import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

export const USERNAME_CONTEXT_KEY = "chezy.username";
export const SESSION_CONTEXT_KEY = "chezy.sessionUserId";
export const THREAD_CONTEXT_KEY = "chezy.threadId";

export function usernameFromContext(requestContext: RequestContext | undefined): string {
  const username = requestContext?.get(USERNAME_CONTEXT_KEY);
  if (typeof username !== "string" || username.length === 0) {
    throw new Error(
      "chezy username is not resolved on this request context — the Telegram identity handler must run first",
    );
  }
  return username;
}

export function sessionFromContext(requestContext: RequestContext | undefined): string {
  const session = requestContext?.get(SESSION_CONTEXT_KEY);
  if (typeof session !== "string" || session.length === 0) {
    throw new Error(
      "chezy sessionUserId is not resolved on this request context — the Telegram identity handler must run first",
    );
  }
  return session;
}

interface WebTool {
  readonly description?: unknown;
  readonly execute?: unknown;
}

interface AdaptToolOptions<TInput extends v.ObjectSchema<v.ObjectEntries, undefined>> {
  readonly id: string;
  /** The AI SDK tool from apps/web, or its `{ sessionUserId }` factory.
   * Structural type: `ai`'s `Tool` is not assignable across schema generics. */
  readonly source: WebTool | ((ctx: { sessionUserId: string }) => WebTool);
  /** Raw Valibot object schema; may include `username`, which is stripped. */
  readonly input: TInput;
  readonly requireApproval?: boolean;
  /** Override when Telegram needs shorter wording. */
  readonly description?: string;
}

export function adaptTool<TInput extends v.ObjectSchema<v.ObjectEntries, undefined>>({
  id,
  source,
  input,
  requireApproval,
  description,
}: AdaptToolOptions<TInput>) {
  const hasUsername = "username" in input.entries;
  const exposed = hasUsername ? v.omit(input, ["username"]) : input;
  // Factory sources (web tools take `{ sessionUserId }`) are resolved per call
  // so the Telegram user's id closes over `scopedUsername`; a probe instance
  // supplies the static description.
  const isFactory = typeof source === "function";
  const probe = isFactory ? source({ sessionUserId: "" }) : source;
  if (!probe.execute) {
    throw new Error(`adaptTool(${id}): source tool has no execute`);
  }

  return createTool({
    id,
    description: description ?? (typeof probe.description === "string" ? probe.description : ""),
    inputSchema: toStandardJsonSchema(exposed),
    ...(requireApproval ? { requireApproval: true } : {}),
    execute: async (args, ctx) => {
      const tool = isFactory
        ? source({ sessionUserId: sessionFromContext(ctx.requestContext) })
        : source;
      const execute = tool.execute as (a: unknown, o: unknown) => unknown;
      return execute(
        hasUsername
          ? {
              ...(args as Record<string, unknown>),
              username: usernameFromContext(ctx.requestContext),
            }
          : (args as Record<string, unknown>),
        // AI SDK ToolExecutionOptions; only toolCallId/messages matter here.
        { toolCallId: "telegram", messages: [] } as never,
      );
    },
  });
}
