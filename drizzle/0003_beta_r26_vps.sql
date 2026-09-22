CREATE TABLE "beta_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"book_id" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"chapter_label" text,
	"position" integer DEFAULT 0 NOT NULL,
	"app_version" text NOT NULL,
	"device" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"query" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_attempts" (
	"email" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"window_start" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"salt" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_metadata" (
	"key" text PRIMARY KEY NOT NULL,
	"metadata" jsonb NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_progress" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "reading_progress" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "text_rating" integer;
--> statement-breakpoint
CREATE INDEX "feedback_owner_date_idx" ON "beta_feedback" USING btree ("user_email","created_at");
--> statement-breakpoint
CREATE INDEX "feedback_date_idx" ON "beta_feedback" USING btree ("created_at");
