"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { useChatLauncher } from "~/components/flow/ui/ChatLauncher";

// Always-visible composer pinned to the bottom of /explore. General purpose
// (preferences, a listing, anything): the question opens the chat drawer as
// the first message. Step 2 grows this bar into the conversation itself.
export const FlowChatBar = () => {
  const { open } = useChatLauncher();
  const [question, setQuestion] = useState("");
  const trimmed = question.trim();

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-paper via-paper/95 to-paper/0 px-4 pt-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
      <form
        aria-label="Ask Chezy"
        className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full border border-cloud bg-snow py-1.5 pr-1.5 pl-3 shadow-[0_8px_30px_rgba(9,9,11,0.12)] md:max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed) return;
          open({ message: trimmed });
          setQuestion("");
        }}
      >
        <FlowAgentMark size="sm" className="shrink-0" />
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          aria-label="Ask Chezy"
          placeholder="Ask Chezy anything…"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] text-obsidian placeholder:text-fog focus-visible:outline-none"
        />
        <button
          type="submit"
          aria-label="Send question"
          disabled={!trimmed}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-obsidian text-snow transition-colors hover:bg-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obsidian disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowUp size={18} aria-hidden />
        </button>
      </form>
    </div>
  );
};
