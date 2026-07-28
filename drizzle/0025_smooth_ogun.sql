CREATE TABLE `chief_board_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `chief_board_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chief_board_attachment_item_idx` ON `chief_board_attachments` (`item_id`);--> statement-breakpoint
ALTER TABLE `chief_board_items` ADD `starts_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `chief_board_items` ADD `ends_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `chief_board_items` ADD `expires_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `chief_board_items` ADD `invite_status` text DEFAULT '' NOT NULL;