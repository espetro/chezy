import type { ReactNode } from "react";
import { theme } from "../theme";

// iPhone 15 class: 393x852 CSS px drawn at 1.1x (432x937) with a dark bezel
// and an island cutout. Children are clipped to the screen (Q20/Q24).
// Capture target for teammates: 393x852 @ deviceScaleFactor 3 = 1179x2556.
const SCREEN_W = 393;
const SCREEN_H = 852;
const SCALE = 1.1;
const BEZEL = 12;

export const PhoneFrame = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      width: SCREEN_W + BEZEL * 2,
      height: SCREEN_H + BEZEL * 2,
      transform: `scale(${SCALE})`,
      transformOrigin: "center center",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: BEZEL,
        boxSizing: "border-box",
        borderRadius: 62,
        background: "#000",
        border: `1px solid ${theme.hairline}`,
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px ${theme.hairline}`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 50,
          overflow: "hidden",
          background: theme.canvas,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 11,
            left: "50%",
            transform: "translateX(-50%)",
            width: 96,
            height: 27,
            borderRadius: 14,
            background: "#000",
            zIndex: 20,
          }}
        />
        {children}
      </div>
    </div>
  </div>
);
