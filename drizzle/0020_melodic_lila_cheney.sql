CREATE TABLE `schedule_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text,
	`work_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`role` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`rotation_id` text,
	`status` text DEFAULT 'assigned' NOT NULL,
	`emergency` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rotation_id`) REFERENCES `schedule_rotations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `schedule_assignment_date_idx` ON `schedule_assignments` (`work_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_assignment_unique_idx` ON `schedule_assignments` (`employee_id`,`work_date`,`start_time`,`role`);--> statement-breakpoint
CREATE TABLE `schedule_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`in_app` integer DEFAULT true NOT NULL,
	`email` integer DEFAULT false NOT NULL,
	`sms` integer DEFAULT false NOT NULL,
	`delivery_status` text DEFAULT 'queued' NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `schedule_notification_employee_idx` ON `schedule_notifications` (`employee_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `schedule_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_type` text NOT NULL,
	`employee_id` text NOT NULL,
	`assignment_id` text,
	`target_employee_id` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`start_time` text DEFAULT '' NOT NULL,
	`end_time` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`repeat_mode` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignment_id`) REFERENCES `schedule_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `schedule_request_status_idx` ON `schedule_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `schedule_rotation_members` (
	`rotation_id` text NOT NULL,
	`employee_id` text NOT NULL,
	FOREIGN KEY (`rotation_id`) REFERENCES `schedule_rotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_rotation_member_idx` ON `schedule_rotation_members` (`rotation_id`,`employee_id`);--> statement-breakpoint
CREATE TABLE `schedule_rotations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`cycle_days` integer NOT NULL,
	`duty_days` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
