import { copy } from "../../copy/copy.schema";
import { ChatBubble, ChatColumn } from "../mock/ChatBubble";
import { Chip } from "../mock/Chip";
import { MockTag } from "../mock/MockTag";
import type { SceneProps } from "./sceneProps";

// 5. handoff — simulation-ended chip carries over, truthful status bubble, and
// a second bubble describing the live-mode dispatched state. No calendar tile:
// nothing was booked. The chat holds while the stack segment takes the left zone.
export const Handoff = ({ frames, showMockTag }: SceneProps) => {
  const at = (p: number) => Math.round(p * frames);
  const s = copy.checkpoints.handoff.screen;
  const endedChip = copy.checkpoints.call.screen.endedChip;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {showMockTag && <MockTag />}
      <ChatColumn>
        <Chip text={endedChip} at={0} />
        <ChatBubble who="assistant" text={s.assistant} at={at(0.12)} />
        <ChatBubble who="assistant" text={s.status} at={at(0.45)} />
      </ChatColumn>
    </div>
  );
};
