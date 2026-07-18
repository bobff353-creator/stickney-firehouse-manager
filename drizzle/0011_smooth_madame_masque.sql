CREATE TABLE `record_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`action` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL,
	`changed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `record_revision_number_idx` ON `record_revisions` (`record_type`,`record_id`,`revision_number`);--> statement-breakpoint
ALTER TABLE `box_cards` ADD `status` text DEFAULT 'Active' NOT NULL;--> statement-breakpoint
ALTER TABLE `box_cards` ADD `created_by` text DEFAULT 'System' NOT NULL;--> statement-breakpoint
ALTER TABLE `box_cards` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `created_by` text DEFAULT 'System' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `updated_by` text DEFAULT 'System' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `locked_by` text;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `locked_at` text;--> statement-breakpoint
ALTER TABLE `pay_periods` ADD `created_by` text DEFAULT 'System' NOT NULL;--> statement-breakpoint
ALTER TABLE `pay_periods` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `pay_periods` ADD `updated_by` text DEFAULT 'System' NOT NULL;--> statement-breakpoint
ALTER TABLE `pay_periods` ADD `finalized_by` text;--> statement-breakpoint
ALTER TABLE `pay_periods` ADD `finalized_at` text;--> statement-breakpoint
ALTER TABLE `policies` ADD `status` text DEFAULT 'Active' NOT NULL;--> statement-breakpoint
ALTER TABLE `policies` ADD `created_by` text DEFAULT 'System' NOT NULL;--> statement-breakpoint
ALTER TABLE `policies` ADD `created_at` text;
