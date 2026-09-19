import { copy } from "../../copy/copy.schema";
import { ChatBubble, ChatColumn } from "../mock/ChatBubble";
import { ListingCard } from "../mock/ListingCard";
import { MockTag } from "../mock/MockTag";
import type { SceneProps } from "./sceneProps";

// 2. shortlist — query bubble + three ListingCards staggered ~80 ms apart.
export const Shortlist = ({ frames, showMockTag }: SceneProps) => {
  const at = (p: number) => Math.round(p * frames);
  const s = copy.checkpoints.shortlist.screen;
  // 80 ms at 30 fps rounds to 2 frames; 3 reads better while staying faithful.
  const stagger = 3;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {showMockTag && <MockTag />}
      <ChatColumn>
        <ChatBubble who="user" text={s.user} at={at(0.06)} typeIn />
        <ChatBubble who="assistant" text={s.assistant} at={at(0.3)} />
        {s.cards.map((card, i) => (
          <ListingCard
            key={card.zone}
            card={card}
            index={i}
            at={at(0.42) + i * stagger}
          />
        ))}
      </ChatColumn>
    </div>
  );
};
