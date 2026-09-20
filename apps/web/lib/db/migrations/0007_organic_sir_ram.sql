CREATE TABLE "Viewing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"listingId" text NOT NULL,
	"channel" text NOT NULL,
	"callId" text,
	"slotIso" text,
	"status" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Viewing" ADD CONSTRAINT "Viewing_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Viewing" ADD CONSTRAINT "Viewing_listingId_Listing_id_fk" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE no action ON UPDATE no action;