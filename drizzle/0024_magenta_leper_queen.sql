CREATE TABLE `schedule_shift_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'red' NOT NULL,
	`start_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`recurrence_days` integer NOT NULL,
	`coverage_plan_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `schedule_shift_pattern_active_idx` ON `schedule_shift_patterns` (`active`,`start_date`);--> statement-breakpoint
CREATE TABLE `schedule_staffing_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern_id` text NOT NULL,
	`name` text NOT NULL,
	`condition_type` text NOT NULL,
	`role` text NOT NULL,
	`minimum_staff` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`pattern_id`) REFERENCES `schedule_shift_patterns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `schedule_staffing_override_pattern_idx` ON `schedule_staffing_overrides` (`pattern_id`,`active`);
