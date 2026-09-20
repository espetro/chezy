CREATE TABLE "adaptation_candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"run" integer NOT NULL,
	"attempt" integer NOT NULL,
	"provider_session_id" text,
	"spec" jsonb NOT NULL,
	"hash" text NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adaptation_job" ADD COLUMN "run" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "adaptation_job" ADD COLUMN "trace" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "adaptation_candidate" ADD CONSTRAINT "adaptation_candidate_job_id_adaptation_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."adaptation_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adaptation_candidate_job_run_attempt" ON "adaptation_candidate" USING btree ("job_id","run","attempt");