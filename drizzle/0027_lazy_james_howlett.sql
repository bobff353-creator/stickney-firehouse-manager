CREATE TABLE `employee_permission_overrides` (
	`employee_id` text NOT NULL,
	`permission_key` text NOT NULL,
	`effect` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`employee_id`, `permission_key`),
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rank_permissions` (
	`rank` text NOT NULL,
	`permission_key` text NOT NULL,
	`allowed` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`rank`, `permission_key`)
);
