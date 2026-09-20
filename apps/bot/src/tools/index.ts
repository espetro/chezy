import { listingFeedbackInputSchema, saveUserProfileInputSchema } from "@chezy/contract";

import {
  arrangeViewingInput,
  arrangeViewing as arrangeViewingTool,
} from "~/lib/ai/tools/arrange-viewing";
import { recordListingFeedback as recordListingFeedbackTool } from "~/lib/ai/tools/record-listing-feedback";
import { saveUserProfile as saveUserProfileTool } from "~/lib/ai/tools/save-user-profile";
import { searchListingsInput, searchListingsTool } from "~/lib/ai/tools/search-listings";

import { adaptTool } from "./adapt";

export const searchListings = adaptTool({
  id: "searchListings",
  source: searchListingsTool,
  input: searchListingsInput,
});

export const saveUserProfile = adaptTool({
  id: "saveUserProfile",
  source: saveUserProfileTool,
  input: saveUserProfileInputSchema,
});

export const recordListingFeedback = adaptTool({
  id: "recordListingFeedback",
  source: recordListingFeedbackTool,
  input: listingFeedbackInputSchema,
});

export const arrangeViewing = adaptTool({
  id: "arrangeViewing",
  source: arrangeViewingTool,
  input: arrangeViewingInput,
  requireApproval: true,
});

export const chezyTools = {
  searchListings,
  saveUserProfile,
  recordListingFeedback,
  arrangeViewing,
};
