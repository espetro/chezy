import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { copy } from "../../copy/copy.schema";
import { theme } from "../../theme";
import { ChatBubble } from "../mock/ChatBubble";
import { InsightCard } from "../mock/InsightCard";
import { ListingCard } from "../mock/ListingCard";
import { MockTag } from "../mock/MockTag";
import type { SceneProps } from "./sceneProps";

// 3. forensic — cards 1 & 2 carry over; "I checked both.", amber warning under
// card 1, green pass under card 2. Stage push-in 1.0 -> 1.12 over ~6 s while
// the amber card is read, then back (push-out into the transition).
export const Forensic = ({ frames, showMockTag }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (p: number) => Math.round(p * frames);
  const s = copy.checkpoints.forensic.screen;
  const [card1, card2] = copy.checkpoints.shortlist.screen.cards;

  const amberAt = at(0.24);
  const pushEnd = amberAt + Math.round(6 * fps);
  const zoom = interpolate(
    frame,
    [amberAt, pushEnd, pushEnd + Math.round(1 * fps), frames],
    [1, 1.12, 1.12, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${zoom})`,
        transformOrigin: "center 38%",
      }}
    >
      {showMockTag && <MockTag />}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "56px 14px 18px",
          background: theme.canvas,
        }}
      >
        <ChatBubble who="assistant" text={s.checked} at={at(0.08)} />
        {card1 && <ListingCard card={card1} index={0} at={0} compact />}
        <InsightCard
          variant="amber"
          title={s.amberTitle}
          summary={s.amberSummary}
          bullets={s.amberBullets}
          at={amberAt}
        />
        {card2 && <ListingCard card={card2} index={1} at={0} compact />}
        <InsightCard variant="green" title={s.greenLine} at={at(0.62)} />
      </div>
    </div>
  );
};
