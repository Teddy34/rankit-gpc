ALTER TABLE `monthly_awards` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `monthly_awards` ADD `deleted_by` integer REFERENCES users(id);