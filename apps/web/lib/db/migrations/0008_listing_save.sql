CREATE TABLE "listing_save" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_save" ADD CONSTRAINT "listing_save_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_save" ADD CONSTRAINT "listing_save_listing_id_Listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."Listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_save_user_listing" ON "listing_save" USING btree ("user_id","listing_id");