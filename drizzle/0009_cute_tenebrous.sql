CREATE TABLE `box_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`box_number` text DEFAULT '' NOT NULL,
	`access_notes` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `box_cards_title_idx` ON `box_cards` (`title`);--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`policy_number` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`effective_date` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `policies_title_idx` ON `policies` (`title`);