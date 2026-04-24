CREATE TABLE IF NOT EXISTS "kit_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "minecraftId" varchar(128) NOT NULL,
  "name" varchar(256) NOT NULL,
  "price" numeric(10, 2) NOT NULL DEFAULT '0',
  "maxPerSlot" integer NOT NULL DEFAULT 64,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "kit_items_minecraftId_unique" UNIQUE("minecraftId")
);
