CREATE TABLE "SearchProfile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"workAddress" text NOT NULL,
	"workLat" double precision,
	"workLon" double precision,
	"maxCommuteMin" integer NOT NULL,
	"neighbourhoods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"minPriceEur" integer NOT NULL,
	"maxPriceEur" integer NOT NULL,
	"minRooms" integer NOT NULL,
	"minM2" integer NOT NULL,
	"moveDate" text,
	"flexibleDays" integer DEFAULT 0 NOT NULL,
	"mustHaves" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"redLines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alertsEnabled" boolean DEFAULT true NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "SearchProfile_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "SearchProfile" ADD CONSTRAINT "SearchProfile_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;