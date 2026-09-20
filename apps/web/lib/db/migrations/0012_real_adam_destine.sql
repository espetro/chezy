CREATE TABLE "capability_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"coverage" double precision NOT NULL,
	"provider_session_id" text,
	"provider_session_url" text,
	"pr_url" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adaptation_job" ADD COLUMN "capability_job_id" uuid;--> statement-breakpoint
ALTER TABLE "capability_job" ADD CONSTRAINT "capability_job_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capability_job_capability" ON "capability_job" USING btree ("capability");--> statement-breakpoint
ALTER TABLE "adaptation_job" ADD CONSTRAINT "adaptation_job_capability_job_id_capability_job_id_fk" FOREIGN KEY ("capability_job_id") REFERENCES "public"."capability_job"("id") ON DELETE set null ON UPDATE no action;