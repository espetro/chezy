import { ChatBubble } from "~/components/flow/onboarding/ChatBubble";

const dotDelays = ["0ms", "160ms", "320ms"];

export const ThinkingBubble = () => (
  <ChatBubble from="agent">
    <span role="status" aria-label="Agent is thinking" className="flex items-center gap-1 py-1.5">
      {dotDelays.map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-dot-pulse rounded-full bg-fog"
          style={{ animationDelay: delay }}
        />
      ))}
    </span>
  </ChatBubble>
);
