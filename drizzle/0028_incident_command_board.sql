CREATE TABLE `incident_command_boards` (
	`incident_id` text PRIMARY KEY NOT NULL,
	`board_state` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `incident_command_events` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`revision` integer NOT NULL,
	`event_type` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL,
	`event_payload` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incident_command_event_revision_idx` ON `incident_command_events` (`incident_id`,`revision`);
--> statement-breakpoint
CREATE INDEX `incident_command_events_incident_time_idx` ON `incident_command_events` (`incident_id`,`created_at`);
