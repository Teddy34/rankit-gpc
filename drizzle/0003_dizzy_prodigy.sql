CREATE TABLE `monthly_awards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`award_month` text NOT NULL,
	`user_id` integer NOT NULL,
	`level` text NOT NULL,
	`streak` integer NOT NULL,
	`awarded_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "monthly_awards_streak_positive" CHECK("monthly_awards"."streak" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_awards_month_unique` ON `monthly_awards` (`award_month`);--> statement-breakpoint
CREATE INDEX `monthly_awards_user_id_idx` ON `monthly_awards` (`user_id`);