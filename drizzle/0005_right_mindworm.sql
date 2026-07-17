CREATE TABLE `important_phone_numbers` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`emergency_number` text DEFAULT '' NOT NULL,
	`non_emergency_number` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `important_phone_category_sort_idx` ON `important_phone_numbers` (`category`,`sort_order`);