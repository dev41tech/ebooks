ALTER TABLE "books" ADD COLUMN "category_main" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "categories_secondary" jsonb;--> statement-breakpoint
CREATE INDEX "books_category_main_idx" ON "books" USING btree ("category_main");
--> statement-breakpoint
ALTER TABLE "ebook_drafts" ADD COLUMN "category_main" text;--> statement-breakpoint
ALTER TABLE "ebook_drafts" ADD COLUMN "categories_secondary" jsonb;
