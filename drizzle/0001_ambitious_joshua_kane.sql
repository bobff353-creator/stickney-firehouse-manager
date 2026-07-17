CREATE TABLE `employee_profiles` (
	`employee_id` text PRIMARY KEY NOT NULL,
	`employee_number` text,
	`start_date` text,
	`end_date` text,
	`date_of_birth` text,
	`phone` text,
	`email` text,
	`address_line_1` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`employment_type` text DEFAULT 'Part-time' NOT NULL,
	`emergency_name` text,
	`emergency_relationship` text,
	`emergency_phone` text,
	`notes` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_profiles_number_idx` ON `employee_profiles` (`employee_number`);