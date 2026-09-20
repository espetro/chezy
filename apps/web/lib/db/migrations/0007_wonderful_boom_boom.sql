CREATE TABLE "adaptation_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feedback_event_id" uuid NOT NULL,
	"profile_version" text NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"source_listing_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_session_id" text,
	"provider_session_url" text,
	"candidate_spec" jsonb,
	"accepted_spec" jsonb,
	"validation_errors" jsonb,
	"error" text,
	"deadline_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adaptation_job" ADD CONSTRAINT "adaptation_job_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adaptation_job_user_event" ON "adaptation_job" USING btree ("user_id","feedback_event_id");