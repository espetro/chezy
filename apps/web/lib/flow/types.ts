export type AutonomyLevel = "assist" | "cowork" | "autopilot";

export interface AutonomyOption {
  level: AutonomyLevel;
  title: string;
  description: string;
}

export type CommuteMax = 15 | 25 | 40;

export type MoveIn = { mode: "date"; date: string } | { mode: "flexible" };

export interface UserPreferences {
  workAddress: string;
  commuteMaxMin: CommuteMax | undefined;
  zones: string[];
  budgetMin: number;
  budgetMax: number;
  rooms: number;
  sizeMin: number;
  moveIn: MoveIn | undefined;
  mustHaves: string[];
  dealBreakers: string[];
  alerts: boolean;
  autonomy: AutonomyLevel;
}

export interface NeighborhoodProfile {
  shops: number;
  nightlife: number;
  safety: number;
  transitMinutesToWork: number;
  noise: number;
}

export type ListingTag =
  | "Furnished"
  | "Pets allowed"
  | "Bills included"
  | "Exterior-facing"
  | "Elevator"
  | "Terrace"
  | "Renovated";

export interface MatchReason {
  label: string;
  detail: string;
}

// FlowListing, not Listing: `Listing` is the DB row type in @/lib/db/schema and the two
// coexist in lib/flow/adapters.ts, so this keeps the designer's shape under a unique name.
export interface FlowListing {
  id: string;
  title: string;
  neighborhood: string;
  city: string;
  price: number;
  sizeM2: number;
  rooms: number;
  imageUrl: string;
  agency: string;
  tags: ListingTag[];
  depositMonths: number;
  sharedFlat: boolean;
  matchScore: number;
  matchReasons: MatchReason[];
  outdoorEvidence?: string;
  neighborhoodProfile: NeighborhoodProfile;
  availableFrom: string;
}

export type PipelineStage = "new" | "interested" | "contacted" | "visiting" | "negotiating";
