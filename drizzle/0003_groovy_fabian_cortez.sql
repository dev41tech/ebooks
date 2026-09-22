CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`environment` text DEFAULT 'test' NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`total_items` integer DEFAULT 0 NOT NULL,
	`valid_items` integer DEFAULT 0 NOT NULL,
	`error_items` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
CREATE TABLE `staging_books` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`genre` text,
	`language` text DEFAULT 'pt-BR' NOT NULL,
	`description` text,
	`isbn` text,
	`source` text,
	`source_url` text,
	`license_type` text,
	`rights_status` text DEFAULT 'pending' NOT NULL,
	`file_name` text,
	`storage_key` text,
	`content_type` text,
	`file_size` integer,
	`status` text DEFAULT 'ready' NOT NULL,
	`validation_errors` text,
	`is_test` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staging_batch_title_author_idx` ON `staging_books` (`batch_id`,`title`,`author`);