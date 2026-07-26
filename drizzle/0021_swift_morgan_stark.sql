CREATE TABLE `schedule_coverage_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`minimum_staff` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`days_of_week` text DEFAULT '0,1,2,3,4,5,6' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `schedule_coverage_rule_active_idx` ON `schedule_coverage_rules` (`active`,`role`);--> statement-breakpoint
ALTER TABLE `schedule_assignments` ADD `required_rank` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `schedule_assignments` ADD `claim_deadline` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `schedule_requests` ADD `target_status` text DEFAULT 'not_required' NOT NULL;