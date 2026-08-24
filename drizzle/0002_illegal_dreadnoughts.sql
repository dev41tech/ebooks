CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`book_id` text,
	`kind` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_storage_key_idx` ON `media_assets` (`storage_key`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_books` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text,
	`title` text NOT NULL,
	`subtitle` text,
	`author` text NOT NULL,
	`author_id` text,
	`genre` text NOT NULL,
	`format` text,
	`age_rating` text,
	`description` text NOT NULL,
	`price_cents` integer,
	`subscribers_only` integer DEFAULT false,
	`cover_key` text,
	`epub_key` text,
	`audio_key` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_books`("id", "slug", "title", "subtitle", "author", "author_id", "genre", "format", "age_rating", "description", "price_cents", "subscribers_only", "cover_key", "epub_key", "audio_key", "status", "published_at", "created_at", "updated_at")
SELECT "id", NULL, "title", NULL, "author", NULL, "genre", NULL, NULL, "description", NULL, false, NULL, NULL, NULL, "status", NULL, "created_at", NULL FROM `books`;--> statement-breakpoint
DROP TABLE `books`;--> statement-breakpoint
ALTER TABLE `__new_books` RENAME TO `books`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `books_slug_idx` ON `books` (`slug`);
