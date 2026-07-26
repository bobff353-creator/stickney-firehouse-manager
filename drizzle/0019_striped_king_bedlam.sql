CREATE TABLE `pay_rate_history` (
	`id` text PRIMARY KEY NOT NULL,
	`pay_scale_id` text NOT NULL,
	`effective_date` text NOT NULL,
	`regular_rate` real NOT NULL,
	`overtime_rate` real NOT NULL,
	`holiday_rate` real NOT NULL,
	`created_by` text DEFAULT 'System' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`pay_scale_id`) REFERENCES `pay_scales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_rate_history_scale_date_idx` ON `pay_rate_history` (`pay_scale_id`,`effective_date`);--> statement-breakpoint
CREATE INDEX `pay_rate_history_effective_idx` ON `pay_rate_history` (`effective_date`);
