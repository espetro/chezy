import type { Chat } from "~/lib/db/schema";

const PAGE_SIZE = 20;

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

export function getChatHistoryPaginationKey(pageIndex: number, previousPageData: ChatHistory) {
  if (previousPageData && previousPageData.hasMore === false) {
    return undefined;
  }

  if (pageIndex === 0) {
    return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?limit=${PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) {
    return undefined;
  }

  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}
