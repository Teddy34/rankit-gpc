CREATE TABLE `rating_resets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`effective_on` text NOT NULL,
	`sequence` integer NOT NULL,
	`set_by` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`set_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "rating_resets_range" CHECK("rating_resets"."rating" between 1000 and 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rating_resets_sequence_unique` ON `rating_resets` (`sequence`);--> statement-breakpoint
CREATE INDEX `rating_resets_user_id_idx` ON `rating_resets` (`user_id`);--> statement-breakpoint
CREATE INDEX `rating_resets_recompute_order_idx` ON `rating_resets` (`effective_on`,`sequence`);