import { theme } from "../../theme";

// "mock" pill marking placeholder scenes until teammates drop real captures.
// Controlled by config.showMockTags.
export const MockTag = () => (
  <div
    style={{
      position: "absolute",
      top: 52,
      right: 12,
      zIndex: 15,
      fontFamily: theme.fontMono,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: theme.amber,
      background: "rgba(0,0,0,0.6)",
      border: `1px solid ${theme.amber}`,
      borderRadius: 6,
      padding: "3px 8px",
    }}
  >
    mock
  </div>
);
