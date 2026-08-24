CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text,
	`minutes` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`book_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_owner_book_idx` ON `reviews` (`user_email`,`book_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`plan` text NOT NULL,
	`status` text DEFAULT 'trialing' NOT NULL,
	`provider` text DEFAULT 'pending' NOT NULL,
	`provider_customer_id` text,
	`provider_subscription_id` text,
	`current_period_end` text,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_owner_idx` ON `subscriptions` (`user_email`);