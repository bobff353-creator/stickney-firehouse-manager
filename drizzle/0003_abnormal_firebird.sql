CREATE TABLE `daily_log_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`log_date` text NOT NULL,
	`shift_key` text NOT NULL,
	`sign_in_officer_id` text,
	`sign_in_at` text,
	`sign_in_equipment` text DEFAULT '{}' NOT NULL,
	`sign_in_note` text DEFAULT '' NOT NULL,
	`reviewed_notes` integer DEFAULT false NOT NULL,
	`sign_out_officer_id` text,
	`sign_out_at` text,
	`sign_out_equipment` text DEFAULT '{}' NOT NULL,
	`sign_out_note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`log_date`) REFERENCES `daily_logs`(`log_date`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sign_in_officer_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sign_out_officer_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `log_approval_date_shift_idx` ON `daily_log_approvals` (`log_date`,`shift_key`);--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `admin_unlocked` integer DEFAULT false NOT NULL;