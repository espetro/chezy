CREATE TABLE "ListingInsight" (
	"listingId" text PRIMARY KEY NOT NULL,
	"insights" jsonb NOT NULL,
	"model" text NOT NULL,
	"promptVersion" integer NOT NULL,
	"promptTokens" integer,
	"completionTokens" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"conditionScore" integer,
	"flooringDominant" text,
	"flooringAll" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ceilingFeatures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"windowSize" text,
	"lightNatural" text,
	"facing" text,
	"outdoorSpaces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"furnished" text,
	"style" text,
	"acVisible" boolean,
	"virtualStaging" boolean
);
--> statement-breakpoint
ALTER TABLE "ListingInsight" ADD CONSTRAINT "ListingInsight_listingId_Listing_id_fk" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE cascade ON UPDATE no action;