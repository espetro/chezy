CREATE TABLE "listing_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"listing_id" text NOT NULL,
	"reason" text NOT NULL,
	"profile_version" text NOT NULL,
	"facts" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"undone_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "listing_feedback" ADD CONSTRAINT "listing_feedback_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_feedback" ADD CONSTRAINT "listing_feedback_listing_id_Listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."Listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_feedback_user_event" ON "listing_feedback" USING btree ("user_id","event_id");