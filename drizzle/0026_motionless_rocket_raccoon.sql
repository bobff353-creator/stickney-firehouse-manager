CREATE TABLE `schedule_notification_rules` (
	`event_type` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`email_enabled` integer DEFAULT true NOT NULL,
	`sms_enabled` integer DEFAULT false NOT NULL,
	`delivery_timings` text DEFAULT '["immediate"]' NOT NULL,
	`updated_by` text DEFAULT 'System' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `employee_profiles` ADD `schedule_sms_opt_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `schedule_notifications` ADD `event_type` text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `schedule_notifications` ADD `scheduled_for` text DEFAULT '' NOT NULL;
