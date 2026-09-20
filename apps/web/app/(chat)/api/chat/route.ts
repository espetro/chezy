import { createAuditLogger, getLogger } from "@chezy/observability";
import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "~/app/(auth)/auth";
import { env } from "~/lib/env";
import { entitlementsByUserType } from "~/lib/ai/entitlements";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
  getModelAvailability,
} from "~/lib/ai/models";
import { EMBEDDING_MODEL_ID, embedText } from "~/lib/ai/embeddings";
import { extractMemories, formatMemoryContext, isDuplicateMemory } from "~/lib/ai/memory";
import { type RequestHints, systemPrompt } from "~/lib/ai/prompts";
import { getLanguageModel } from "~/lib/ai/providers";
import { arrangeViewing } from "~/lib/ai/tools/arrange-viewing";
import { getListingInsightsTool } from "~/lib/ai/tools/get-listing-insights";
import { getListingTool } from "~/lib/ai/tools/get-listing";
import { identifyUser } from "~/lib/ai/tools/identify-user";
import { recordListingFeedback } from "~/lib/ai/tools/record-listing-feedback";
import { saveUserProfile } from "~/lib/ai/tools/save-user-profile";
import { searchListingsTool } from "~/lib/ai/tools/search-listings";
import {
  isProductionEnvironment,
  MEMORY_COSINE_DEDUP_THRESHOLD,
  MEMORY_RECALL_LIMIT,
} from "~/lib/constants";
import { findSimilarMemory, insertMemory, searchMemories } from "~/lib/db/memory-queries";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "~/lib/db/queries";
import type { DBMessage } from "~/lib/db/schema";
import { ChatbotError } from "~/lib/errors";
import { checkIpRateLimit } from "~/lib/ratelimit";
import type { ChatMessage, WaitingStatusData } from "~/lib/types";
import { convertToUIMessages, generateUUID } from "~/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

const HEALTH_CHECK_DELAY_MS = 9000;

const chatLogger = getLogger(["chezy", "chat"]);
const chatAudit = createAuditLogger("chat");

async function recallMemories(
  userId: string,
  latestUserMessage: ChatMessage | undefined,
): Promise<string> {
  if (!latestUserMessage) {
    return "";
  }

  try {
    const text = latestUserMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join(" ")
      .trim();

    if (!text) {
      return "";
    }

    const queryEmbedding = await embedText(text);
    const memories = await searchMemories({
      userId,
      queryEmbedding,
      limit: MEMORY_RECALL_LIMIT,
    });

    return formatMemoryContext(memories);
  } catch (error) {
    console.error("Memory recall failed, proceeding without memory:", error);
    return "";
  }
}

async function storeMemoriesFromTurn(
  userId: string,
  chatId: string,
  finishedMessages: ChatMessage[],
) {
  try {
    const facts = await extractMemories(
      finishedMessages.flatMap((m) =>
        m.parts
          .filter((part) => part.type === "text")
          .map((part) => ({ role: m.role, content: (part as { text: string }).text })),
      ),
    );

    for (const fact of facts) {
      const embedding = await embedText(fact);
      const similar = await findSimilarMemory({
        userId,
        contentEmbedding: embedding,
        threshold: MEMORY_COSINE_DEDUP_THRESHOLD,
      });

      if (similar) {
        continue;
      }

      await insertMemory({
        chatId,
        content: fact,
        embedding,
        embeddingModel: EMBEDDING_MODEL_ID,
        kind: "fact",
        userId,
      });
    }
  } catch (error) {
    console.error("Memory write failed (non-fatal):", error);
  }
}

function isModelStreamActivity(chunk: { type: string }) {
  return !["start", "start-step", "finish-step", "finish", "raw"].includes(chunk.type);
}

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch {
    return undefined;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } = requestBody;

    const [botIdResult, session] = await Promise.all([checkBotId().catch(() => undefined), auth()]);

    if (botIdResult?.isBot) {
      return new ChatbotError("forbidden:api").toResponse();
    }

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      differenceInHours: 1,
      id: session.user.id,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | undefined = undefined;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        title: "New chat",
        userId: session.user.id,
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" || p.state === "output-denied",
              )
              .map((p: Record<string, unknown>) => [String(p.toolCallId ?? ""), p]) ?? [],
        ),
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if ("toolCallId" in part && approvalStates.has(String(part.toolCallId))) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [...convertToUIMessages(messagesFromDb), message as ChatMessage];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      city,
      country,
      latitude,
      longitude,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            attachments: [],
            chatId: id,
            createdAt: new Date(),
            id: message.id,
            parts: message.parts,
            role: "user",
          },
        ],
      });
    }

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const modelMessages = await convertToModelMessages(uiMessages);

    chatAudit.emit({
      actor: session.user.id,
      action: "chat.turn.start",
      ctx: { model: chatModel },
      outcome: "pending",
      target: id,
    });

    const latestUserMessage = uiMessages.findLast((m) => m.role === "user") as
      | ChatMessage
      | undefined;
    const memoryContext = await recallMemories(session.user.id, latestUserMessage);

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const modelName = modelConfig?.name ?? chatModel;
        let hasModelActivity = false;
        let healthCheckTimer: ReturnType<typeof setTimeout> | undefined;

        const clearHealthCheckTimer = () => {
          if (healthCheckTimer) {
            clearTimeout(healthCheckTimer);
          }
        };

        const writeWaitingStatus = (phase: WaitingStatusData["phase"], messageText: string) => {
          if (hasModelActivity && phase !== "thinking") {
            return;
          }
          dataStream.write({
            data: {
              message: messageText,
              modelId: chatModel,
              modelName,
              phase,
            },
            transient: true,
            type: "data-waiting-status",
          });
        };

        writeWaitingStatus("waiting", "Waiting...");

        healthCheckTimer = setTimeout(() => {
          getModelAvailability(chatModel)
            .then((availability) => {
              if (availability === "impacted") {
                writeWaitingStatus(
                  "health",
                  `${modelName} may be slow or unavailable right now...`,
                );
              } else {
                writeWaitingStatus("still-waiting", "Still waiting...");
              }
            })
            .catch(() => {
              writeWaitingStatus("still-waiting", "Still waiting...");
            });
        }, HEALTH_CHECK_DELAY_MS);

        const markModelActive = () => {
          if (hasModelActivity) {
            return;
          }
          hasModelActivity = true;
          clearHealthCheckTimer();
          writeWaitingStatus("thinking", "Thinking...");
        };

        const stopWaitingStatus = () => {
          hasModelActivity = true;
          clearHealthCheckTimer();
        };

        const result = streamText({
          activeTools:
            isReasoningModel && !supportsTools
              ? []
              : [
                  "identifyUser",
                  "saveUserProfile",
                  "searchListings",
                  "recordListingFeedback",
                  "arrangeViewing",
                  "getListing",
                  "getListingInsights",
                ],
          instructions: systemPrompt({
            memoryContext,
            requestHints,
            supportsTools,
          }),
          messages: modelMessages,
          model: getLanguageModel(chatModel),
          onAbort() {
            stopWaitingStatus();
          },
          onChunk({ chunk }) {
            if (isModelStreamActivity(chunk)) {
              markModelActive();
            }
          },
          onEnd() {
            stopWaitingStatus();
          },
          onError({ error }) {
            stopWaitingStatus();
            chatLogger.error("model stream error: {error}", { error });
            chatAudit.emit({
              actor: session.user.id,
              action: "chat.turn.fail",
              ctx: {
                message: error instanceof Error ? error.message : String(error),
                model: chatModel,
              },
              outcome: "failure",
              target: id,
            });
          },
          providerOptions: {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          },
          stopWhen: isStepCount(5),
          telemetry: {
            functionId: "stream-text",
            isEnabled: isProductionEnvironment,
          },
          tools: {
            identifyUser: identifyUser({ sessionUserId: session.user.id }),
            recordListingFeedback: recordListingFeedback({
              sessionUserId: session.user.id,
            }),
            arrangeViewing: arrangeViewing({ sessionUserId: session.user.id }),
            searchListings: searchListingsTool({ sessionUserId: session.user.id }),
            getListing: getListingTool,
            getListingInsights: getListingInsightsTool,
            saveUserProfile: saveUserProfile({ sessionUserId: session.user.id }),
          },
        });

        dataStream.merge(
          toUIMessageStream({
            sendReasoning: isReasoningModel,
            stream: result.stream,
          }),
        );

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ data: title, type: "data-chat-title" });
            updateChatTitleById({ chatId: id, title });
          } catch {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onEnd: async ({ messages: finishedMessages }) => {
        chatAudit.emit({
          actor: session.user.id,
          action: "chat.turn.complete",
          ctx: { messageCount: finishedMessages.length, model: chatModel },
          outcome: "success",
          target: id,
        });
        if (isToolApprovalFlow) {
          await Promise.all(
            finishedMessages.map(async (finishedMsg) => {
              const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
              if (existingMsg) {
                await updateMessage({
                  id: finishedMsg.id,
                  parts: finishedMsg.parts,
                });
                return;
              }

              await saveMessages({
                messages: [
                  {
                    attachments: [],
                    chatId: id,
                    createdAt: new Date(),
                    id: finishedMsg.id,
                    parts: finishedMsg.parts,
                    role: finishedMsg.role,
                  },
                ],
              });
            }),
          );
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              attachments: [],
              chatId: id,
              createdAt: new Date(),
              id: currentMessage.id,
              parts: currentMessage.parts,
              role: currentMessage.role,
            })),
          });
        }

        await storeMemoriesFromTurn(session.user.id, id, finishedMessages);
      },
      onError: (error) => {
        chatLogger.error("chat stream failed: {error}", { error });
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests",
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        return "Oops, an error occurred!";
      },
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
    });

    return createUIMessageStreamResponse({
      async consumeSseStream({ stream: sseStream }) {
        if (!env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ chatId: id, streamId });
            await streamContext.createNewResumableStream(streamId, () => sseStream);
          }
        } catch {
          /* non-critical */
        }
      },
      stream,
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes("AI Gateway requires a valid credit card on file to service requests")
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    chatLogger.error("unhandled error in chat API: {error}", {
      error,
      vercelId,
    });
    chatAudit.emit({
      actor: "anonymous",
      action: "chat.turn.fail",
      ctx: { message: error instanceof Error ? error.message : String(error) },
      outcome: "failure",
      target: requestBody?.id,
    });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
