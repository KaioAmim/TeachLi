CREATE TABLE `gestures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`word` varchar(100) NOT NULL,
	`gloss` varchar(100),
	`landmarksData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gestures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`type` enum('professor','aluno') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`type` enum('speech_to_libras','libras_to_speech') NOT NULL,
	`originalText` text,
	`translatedText` text,
	`videoUrl` varchar(500),
	`confidence` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `translations_id` PRIMARY KEY(`id`)
);
