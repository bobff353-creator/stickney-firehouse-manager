CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pay_scale_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`pay_scale_id`) REFERENCES `pay_scales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `employees_active_sort_idx` ON `employees` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `pay_periods` (
	`start_date` text PRIMARY KEY NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pay_scales` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`regular_rate` real NOT NULL,
	`overtime_rate` real NOT NULL,
	`holiday_rate` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payroll_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`overtime_threshold` real DEFAULT 106 NOT NULL,
	`acting_officer_premium` real DEFAULT 1 NOT NULL,
	`dpw_multiplier` real DEFAULT 1.5 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`period_start` text NOT NULL,
	`work_date` text NOT NULL,
	`category` text NOT NULL,
	`hours` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`period_start`) REFERENCES `pay_periods`(`start_date`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_employee_date_category_idx` ON `time_entries` (`employee_id`,`work_date`,`category`);--> statement-breakpoint
CREATE INDEX `entry_period_employee_idx` ON `time_entries` (`period_start`,`employee_id`);