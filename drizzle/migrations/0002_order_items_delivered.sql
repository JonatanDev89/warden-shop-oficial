-- Add delivered column to order_items
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "delivered" boolean NOT NULL DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS "order_items_delivered_idx" ON "order_items" ("delivered");
