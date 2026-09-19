ALTER TABLE "User" ADD COLUMN "profile" json;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "username" varchar(64);--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_username_unique" UNIQUE("username");