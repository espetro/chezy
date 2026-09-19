import type { UIMessage, UIMessagePart } from "ai";
import { type ClassValue, clsx } from "clsx";
import { formatISO } from "date-fns";
import { twMerge } from "tailwind-merge";
import type { DBMessage, Document } from "~/lib/db/schema";
import { FETCH_TIMEOUT_MS } from "./constants";
import { ChatbotError, type ErrorCode } from "./errors";
import type { ChatMessage, ChatTools, CustomUIDataTypes } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Scraped/API-sourced URLs must not reach an href unchecked: a javascript: or
// data: URI would run script on click. Returns undefined for anything that is
// not an absolute http(s) URL.
export function safeHttpUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

// Bounds the time to response headers only. Clearing the timer once fetch
// resolves keeps long-lived streaming bodies (the chat transport) alive, and a
// caller-supplied signal is merged rather than replaced.
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    FETCH_TIMEOUT_MS,
  );
  const signal = init?.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;

  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}

export const fetcher = async (url: string) => {
  let response: Response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      throw new ChatbotError("timeout:api");
    }
    throw error;
  }

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatbotError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const response = await fetchWithTimeout(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatbotError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      throw new ChatbotError("timeout:chat");
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new ChatbotError("offline:chat");
    }

    throw error;
  }
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDocumentTimestampByIndex(documents: Document[], index: number) {
  if (!documents) {
    return new Date();
  }
  if (index > documents.length) {
    return new Date();
  }

  return documents[index].createdAt;
}

export function sanitizeText(text: string) {
  return text.replace("<has_function_call>", "");
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join("");
}
