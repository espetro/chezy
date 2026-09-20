"use client";

import { createContext, type ReactNode, useContext } from "react";

// True inside the flow chat sheet/drawer. Chat message renderers use it to pick
// the compact flow presentation (e.g. the listing mini bar) over the full cards.
const EmbeddedChatContext = createContext(false);

export const EmbeddedChatProvider = ({ children }: { children: ReactNode }) => (
  <EmbeddedChatContext.Provider value={true}>{children}</EmbeddedChatContext.Provider>
);

export const useIsEmbeddedChat = () => useContext(EmbeddedChatContext);
