CREATE TABLE `editors` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guides` (
	`hero_id` text PRIMARY KEY NOT NULL,
	`draft_json` text NOT NULL,
	`published_json` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`updated_by` text NOT NULL,
	`mutation_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hero_id` text NOT NULL,
	`revision` integer NOT NULL,
	`snapshot` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL,
	`author` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_revisions_hero` ON `revisions` (`hero_id`,`revision`);