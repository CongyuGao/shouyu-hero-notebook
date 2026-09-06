CREATE TABLE `libraries` (
	`kind` text PRIMARY KEY NOT NULL,
	`items_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
