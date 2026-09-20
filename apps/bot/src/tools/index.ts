import { saveUserProfile as saveUserProfileTool } from "~/lib/ai/tools/save-user-profile";
import { saveUserProfileInput } from "~/lib/ai/tools/save-user-profile";
import { searchListingsInput, searchListingsTool } from "~/lib/ai/tools/search-listings";

import { adaptTool } from "./adapt";
import { arrangeViewing } from "./arrange-viewing";
import { recordListingFeedback } from "./record-feedback";

export const searchListings = adaptTool({
  id: "searchListings",
  source: searchListingsTool,
  input: searchListingsInput,
});

export const saveUserProfile = adaptTool({
  id: "saveUserProfile",
  source: saveUserProfileTool,
  input: saveUserProfileInput,
});

export const chezyTools = {
  searchListings,
  saveUserProfile,
  recordListingFeedback,
  arrangeViewing,
};
