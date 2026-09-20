import * as v from "valibot";

export const userProfileSchema = v.object({
  areas: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
  budgetMinEur: v.optional(v.number()),
  budgetMaxEur: v.optional(v.number()),
  bedroomsMin: v.optional(v.number()),
  workLocation: v.optional(v.string()),
  freeformRequirements: v.optional(v.array(v.string())),
  // Scorer amenity keys: exterior, balcony_or_terrace, elevator,
  // air_conditioning, furnished, pets_allowed, heating.
  mustHaves: v.optional(v.array(v.string())),
  // Red-line keys: no_interior, no_high_deposit, no_flatmates.
  redLines: v.optional(v.array(v.string())),
  rejectedListingIds: v.optional(v.array(v.string())),
  maxCommuteMin: v.optional(v.number()),
  minM2: v.optional(v.number()),
  onboardedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export type UserProfile = v.InferOutput<typeof userProfileSchema>;

// Patch the agent sends: same shape, all fields optional.
export const userProfilePatchSchema = userProfileSchema;

export type UserProfilePatch = v.InferOutput<typeof userProfilePatchSchema>;

export const identifyUserInputSchema = v.object({
  username: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
});

export type IdentifyUserInput = v.InferOutput<typeof identifyUserInputSchema>;

export const saveUserProfileInputSchema = v.object({
  username: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  patch: userProfilePatchSchema,
});

export type SaveUserProfileInput = v.InferOutput<typeof saveUserProfileInputSchema>;
