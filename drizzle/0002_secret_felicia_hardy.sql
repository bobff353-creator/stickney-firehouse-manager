CREATE TABLE `daily_log_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`log_date` text NOT NULL,
	`report_number` text DEFAULT '' NOT NULL,
	`time_out` text DEFAULT '' NOT NULL,
	`time_in` text DEFAULT '' NOT NULL,
	`responding_units` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`call_type` text DEFAULT 'EMS' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`log_date`) REFERENCES `daily_logs`(`log_date`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `log_calls_date_sort_idx` ON `daily_log_calls` (`log_date`,`sort_order`);--> statement-breakpoint
CREATE TABLE `daily_log_staffing` (
	`id` text PRIMARY KEY NOT NULL,
	`log_date` text NOT NULL,
	`shift_key` text NOT NULL,
	`employee_id` text,
	`time_in` text DEFAULT '' NOT NULL,
	`time_out` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`log_date`) REFERENCES `daily_logs`(`log_date`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `log_staffing_date_shift_idx` ON `daily_log_staffing` (`log_date`,`shift_key`,`sort_order`);--> statement-breakpoint
CREATE TABLE `daily_logs` (
	`log_date` text PRIMARY KEY NOT NULL,
	`shift_notes` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
