CREATE TABLE `allowed_domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain` text NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allowed_domains_domain_ci_unique` ON `allowed_domains` (lower("domain"));--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_one_id` integer NOT NULL,
	`player_two_id` integer NOT NULL,
	`result` text NOT NULL,
	`played_on` text NOT NULL,
	`sequence` integer NOT NULL,
	`registered_by` integer NOT NULL,
	`player_one_delta` integer NOT NULL,
	`player_two_delta` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_one_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`player_two_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`registered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "games_distinct_players" CHECK("games"."player_one_id" <> "games"."player_two_id"),
	CONSTRAINT "games_zero_sum" CHECK("games"."player_one_delta" + "games"."player_two_delta" = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_sequence_unique` ON `games` (`sequence`);--> statement-breakpoint
CREATE INDEX `games_recompute_order_idx` ON `games` (`played_on`,`sequence`);--> statement-breakpoint
CREATE TABLE `magic_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `magic_links_token_hash_unique` ON `magic_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `magic_links_email_idx` ON `magic_links` (`email`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar` text NOT NULL,
	`initial_rating` integer NOT NULL,
	`current_rating` integer NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`retired_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_initial_rating_range" CHECK("users"."initial_rating" between 1000 and 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_ci_unique` ON `users` (lower(trim("email")));--> statement-breakpoint
CREATE UNIQUE INDEX `users_display_name_ci_unique` ON `users` (lower(trim("display_name")));