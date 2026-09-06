CREATE TABLE `edit_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `edit_password` (
	`id` text PRIMARY KEY NOT NULL,
	`password_hash` text,
	`salt` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`mutation_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `edit_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`password_revision` integer NOT NULL,
	`expires_at` text NOT NULL
);
