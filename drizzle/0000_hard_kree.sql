CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text,
	"anonymous_id" text,
	"event" text NOT NULL,
	"book_id" text,
	"chapter_id" text,
	"metadata" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"book_id" text NOT NULL,
	"chapter" integer DEFAULT 0 NOT NULL,
	"chapter_id" text,
	"label" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text,
	"title" text NOT NULL,
	"subtitle" text,
	"author" text NOT NULL,
	"author_id" text,
	"genre" text NOT NULL,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"isbn" text,
	"collection" text,
	"featured" boolean DEFAULT false NOT NULL,
	"free_chapters" integer DEFAULT 1 NOT NULL,
	"format" text,
	"age_rating" text,
	"description" text NOT NULL,
	"price_cents" integer,
	"subscribers_only" boolean DEFAULT false,
	"cover_key" text,
	"epub_key" text,
	"audio_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" text,
	"created_at" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"book_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_email" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"environment" text DEFAULT 'test' NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"valid_items" integer DEFAULT 0 NOT NULL,
	"error_items" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_email" text NOT NULL,
	"book_id" text,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role" text DEFAULT 'reader' NOT NULL,
	"taste_profile" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"book_id" text NOT NULL,
	"chapter" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"book_id" text NOT NULL,
	"chapter_id" text,
	"minutes" integer DEFAULT 0 NOT NULL,
	"started_at" text NOT NULL,
	"ended_at" text
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"book_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging_books" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"owner_email" text NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"genre" text,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"description" text,
	"isbn" text,
	"source" text,
	"source_url" text,
	"license_type" text,
	"rights_status" text DEFAULT 'pending' NOT NULL,
	"file_name" text,
	"storage_key" text,
	"content_type" text,
	"file_size" integer,
	"cover_key" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"rights_confirmed" boolean DEFAULT false NOT NULL,
	"reviewed_by" text,
	"reviewed_at" text,
	"correction_note" text,
	"published_book_id" text,
	"validation_errors" jsonb,
	"is_test" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"plan" text NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"provider" text DEFAULT 'pending' NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"current_period_end" text,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_owner_book_chapter_idx" ON "bookmarks" USING btree ("user_email","book_id","chapter");--> statement-breakpoint
CREATE UNIQUE INDEX "books_slug_idx" ON "books" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_owner_book_idx" ON "favorites" USING btree ("user_email","book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_storage_key_idx" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_idx" ON "profiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_owner_book_idx" ON "reading_progress" USING btree ("user_email","book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_owner_book_idx" ON "reviews" USING btree ("user_email","book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_batch_title_author_idx" ON "staging_books" USING btree ("batch_id","title","author");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_owner_idx" ON "subscriptions" USING btree ("user_email");