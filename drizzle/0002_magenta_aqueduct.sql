CREATE TABLE `edit_links` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL
);
