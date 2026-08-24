ALTER TABLE `staging_books` ADD `cover_key` text;--> statement-breakpoint
ALTER TABLE `staging_books` ADD `rights_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `staging_books` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `staging_books` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `staging_books` ADD `correction_note` text;--> statement-breakpoint
ALTER TABLE `staging_books` ADD `published_book_id` text;--> statement-breakpoint
ALTER TABLE `staging_books` ADD `updated_at` text;