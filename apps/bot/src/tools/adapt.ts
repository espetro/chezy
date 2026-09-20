// Bridge apps/web AI SDK `tool()` definitions into Mastra `createTool`s.
// The web tools take `username` in their input schema; on Telegram the user is
// already identified, so the field is stripped from the advertised schema and
// injected from the channel context at execute time — the model can never
// invent a username.
import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import type { Tool } from "ai";
import * as v from "valibot";

export const USERNAME_CONTEXT_KEY = "chezy.username";

export function usernameFromContext(requestContext: RequestContext | undefined): string {
  const username = requestContext?.get(USERNAME_CONTEXT_KEY);
  if (typeof username !== "string" || username.length === 0) {
    throw new Error(
      "chezy username is not resolved on this request context — the Telegram identity handler must run first",
    );
  }
  return username;
}

interface AdaptToolOptions<TInput extends v.ObjectSchema<v.ObjectEntries, undefined>> {
  readonly id: string;
  /** The AI SDK tool from apps/web (`description` + `execute`). */
  readonly source: Tool;
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
  const execute = source.execute as ((args: unknown, options: unknown) => unknown) | undefined;
  if (!execute) {
    throw new Error(`adaptTool(${id}): source tool has no execute`);
  }

  return createTool({
    id,
    description: description ?? (typeof source.description === "string" ? source.description : ""),
    inputSchema: toStandardJsonSchema(exposed),
    ...(requireApproval ? { requireApproval: true } : {}),
    execute: async (args, ctx) =>
      execute(
        hasUsername
          ? {
              ...(args as Record<string, unknown>),
              username: usernameFromContext(ctx.requestContext),
            }
          : (args as Record<string, unknown>),
        // AI SDK ToolExecutionOptions; only toolCallId/messages matter here.
        { toolCallId: "telegram", messages: [] } as never,
      ),
  });
}
