import { copy } from "../../copy/copy.schema";
import { ChatBubble, ChatColumn } from "../mock/ChatBubble";
import { MockTag } from "../mock/MockTag";
import type { SceneProps } from "./sceneProps";

// 1. brief — onboarding chat: greeting, identity, three profile fields,
// confirmation. Contract: apps/video/CAPTURE.md.
export const Brief = ({ frames, showMockTag }: SceneProps) => {
  const at = (p: number) => Math.round(p * frames);
  const s = copy.checkpoints.brief.screen;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {showMockTag && <MockTag />}
      <ChatColumn>
        <ChatBubble who="assistant" text={s.greeting} at={at(0.02)} />
        <ChatBubble who="user" text={s.user1} at={at(0.14)} typeIn />
        <ChatBubble who="assistant" text={s.assistant1} at={at(0.4)} />
        <ChatBubble who="user" text={s.user2} at={at(0.64)} typeIn />
        <ChatBubble who="assistant" text={s.assistant2} at={at(0.82)} />
      </ChatColumn>
    </div>
  );
};
