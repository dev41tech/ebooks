CREATE TABLE `beta_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`book_id` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`chapter_label` text,
	`position` integer DEFAULT 0 NOT NULL,
	`app_version` text NOT NULL,
	`device` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_owner_date_idx` ON `beta_feedback` (`user_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `feedback_date_idx` ON `beta_feedback` (`created_at`);--> statement-breakpoint
ALTER TABLE `reviews` ADD `text_rating` integer;--> statement-breakpoint
CREATE INDEX `analytics_event_date_idx` ON `analytics_events` (`event`,`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_book_owner_event_idx` ON `analytics_events` (`book_id`,`user_email`,`event`,`created_at`);