CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "Memory" (
	"chatId" uuid,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"embedding" vector(4096),
	"embeddingModel" varchar(64) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar DEFAULT 'fact' NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;