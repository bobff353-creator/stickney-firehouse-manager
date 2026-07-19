ALTER TABLE `box_cards` ADD `department` text DEFAULT 'Stickney' NOT NULL;--> statement-breakpoint
ALTER TABLE `box_cards` ADD `document_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `box_cards` ADD `document_page` integer DEFAULT 0 NOT NULL;