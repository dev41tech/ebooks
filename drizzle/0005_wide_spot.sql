CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter` integer DEFAULT 0 NOT NULL,
	`chapter_id` text,
	`label` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_owner_book_chapter_idx` ON `bookmarks` (`user_email`,`book_id`,`chapter`);--> statement-breakpoint
ALTER TABLE `books` ADD `language` text DEFAULT 'pt-BR' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `isbn` text;--> statement-breakpoint
ALTER TABLE `books` ADD `collection` text;--> statement-breakpoint
ALTER TABLE `books` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `free_chapters` integer DEFAULT 1 NOT NULL;