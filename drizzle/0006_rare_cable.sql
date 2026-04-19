CREATE TABLE `store_customization` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pixKey` varchar(256),
	`pixKeyType` enum('cpf','email','phone','random'),
	`storeName` varchar(256),
	`storeDescription` text,
	`bannerText` text,
	`bannerColor` varchar(7),
	`primaryColor` varchar(7),
	`secondaryColor` varchar(7),
	`logoUrl` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_customization_id` PRIMARY KEY(`id`)
);
