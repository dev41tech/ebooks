CREATE TABLE `master_attempts` (
	`email` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `master_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `master_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL
);
