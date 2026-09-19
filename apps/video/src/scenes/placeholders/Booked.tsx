import { copy } from "../../copy/copy.schema";
import { CalendarCard } from "../mock/CalendarCard";
import { ChatBubble, ChatColumn } from "../mock/ChatBubble";
import { Chip } from "../mock/Chip";
import { MockTag } from "../mock/MockTag";
import type { SceneProps } from "./sceneProps";

// 5. booked — call-ended chip carries over, confirmation bubble, calendar
// card. The sidebar footer (tagline + sponsor strip + repo URL) fades in for
// the last 8 s from CheckpointSidebar.
export const Booked = ({ frames, showMockTag }: SceneProps) => {
  const at = (p: number) => Math.round(p * frames);
  const s = copy.checkpoints.booked.screen;
  const endedChip = copy.checkpoints.call.screen.endedChip;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {showMockTag && <MockTag />}
      <ChatColumn>
        <Chip text={endedChip} at={0} />
        <ChatBubble who="assistant" text={s.assistant} at={at(0.12)} />
        <CalendarCard
          day={s.calendar.day}
          month={s.calendar.month}
          title={s.calendar.title}
          time={s.calendar.time}
          at={at(0.45)}
        />
      </ChatColumn>
    </div>
  );
};
