CREATE TABLE `daily_duties` (
	`id` text PRIMARY KEY NOT NULL,
	`day_of_week` integer NOT NULL,
	`shift_key` text NOT NULL,
	`duty` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT 'System' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_duties_day_shift_idx` ON `daily_duties` (`day_of_week`,`shift_key`);