CREATE TABLE `discovery_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`query` text NOT NULL,
	`created_at` integer NOT NULL
);
