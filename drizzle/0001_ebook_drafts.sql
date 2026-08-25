CREATE TABLE "ebook_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_email" text NOT NULL,
	"origin" text DEFAULT 'ia' NOT NULL,
	"category" text DEFAULT 'geral' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"title_mode" text DEFAULT 'ai' NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"theme" text NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT 'Motivador' NOT NULL,
	"language" text DEFAULT 'Português (Brasil)' NOT NULL,
	"page_count" integer DEFAULT 20 NOT NULL,
	"words_per_page" integer DEFAULT 250 NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"author_bio" text DEFAULT '' NOT NULL,
	"extra_instructions" text DEFAULT '' NOT NULL,
	"reference_material" text DEFAULT '' NOT NULL,
	"reference_source" text DEFAULT '' NOT NULL,
	"cover_source" text DEFAULT 'none' NOT NULL,
	"cover_suggestion" text DEFAULT '' NOT NULL,
	"cover_key" text,
	"source_file_name" text,
	"source_storage_key" text,
	"intro" text DEFAULT '' NOT NULL,
	"conclusion" text DEFAULT '' NOT NULL,
	"marketing" jsonb,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"status_message" text DEFAULT '' NOT NULL,
	"published_book_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ebook_draft_chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ebook_draft_chapters" ADD CONSTRAINT "ebook_draft_chapters_draft_id_ebook_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."ebook_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "draft_chapter_position_idx" ON "ebook_draft_chapters" USING btree ("draft_id","position");--> statement-breakpoint
CREATE INDEX "ebook_drafts_owner_idx" ON "ebook_drafts" USING btree ("owner_email");
