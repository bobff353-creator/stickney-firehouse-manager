CREATE TABLE `chief_board_items` (
	`id` text PRIMARY KEY NOT NULL,
	`item_type` text DEFAULT 'note' NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`event_date` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_by` text DEFAULT 'System' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chief_board_active_date_idx` ON `chief_board_items` (`active`,`event_date`);