"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "motion/react";
import { memo, useCallback } from "react";
import { suggestions } from "~/lib/constants";
import type { ChatMessage } from "~/lib/types";
import { Suggestion } from "../ai-elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  syncUrl?: boolean;
};

function PureSuggestedActions({ chatId, sendMessage, syncUrl = true }: SuggestedActionsProps) {
  const suggestedActions = suggestions;
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (syncUrl) {
        window.history.pushState(
          {},
          "",
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`,
        );
      }
      sendMessage({
        parts: [{ text: suggestion, type: "text" }],
        role: "user",
      });
    },
    [chatId, sendMessage, syncUrl],
  );

  return (
    <div
      className="flex w-full gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible"
      data-testid="suggested-actions"
      style={{
        msOverflowStyle: "none",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="min-w-[200px] shrink-0 sm:min-w-0 sm:shrink"
          exit={{ opacity: 0, y: 16 }}
          initial={{ opacity: 0, y: 16 }}
          key={suggestedAction}
          transition={{
            delay: 0.06 * index,
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Suggestion
            className="h-auto w-full rounded-xl border border-border/50 bg-card/30 px-4 py-3 text-left text-[12px] leading-relaxed whitespace-nowrap text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-card/60 hover:text-foreground hover:shadow-[var(--shadow-card)] sm:p-4 sm:text-[13px] sm:whitespace-normal"
            onClick={handleSuggestionClick}
            suggestion={suggestedAction}
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, (prevProps, nextProps) => {
  if (prevProps.chatId !== nextProps.chatId) {
    return false;
  }
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
    return false;
  }
  if (prevProps.syncUrl !== nextProps.syncUrl) {
    return false;
  }

  return true;
});
