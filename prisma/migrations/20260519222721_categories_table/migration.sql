-- Promote Product.category from a free-text string to a FK referencing
-- a new `Category` table. Each Category holds a shared emoji icon used
-- by the POS grid; Product.iconEmoji is a per-product override.
--
-- The migration is data-preserving: existing distinct Product.category
-- values are auto-promoted into Category rows, with each row's
-- generated UUID assigned back to Product.categoryId before the old
-- string column is dropped.

BEGIN;

-- 1. New Category table
CREATE TABLE "Category" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "slug"       TEXT NOT NULL,
    "iconEmoji"  TEXT NOT NULL DEFAULT '📦',
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "active"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- 2. New Product columns
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN "iconEmoji" TEXT;

-- 3. Backfill: one Category row per distinct existing Product.category.
--    IDs are gen_random_uuid() prefixed with "cat_" so they're easy to
--    spot vs Prisma-issued cuids that arrive after this migration.
INSERT INTO "Category" ("id", "name", "slug", "iconEmoji", "sortOrder", "active", "createdAt")
SELECT
    'cat_' || replace(gen_random_uuid()::text, '-', ''),
    name,
    lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')),
    '📦',
    0,
    true,
    NOW()
FROM (
    SELECT DISTINCT "category" AS name
    FROM "Product"
    WHERE "category" IS NOT NULL
) cats;

-- 4. Link each existing Product to its newly-created Category row.
UPDATE "Product" p
SET "categoryId" = c."id"
FROM "Category" c
WHERE p."category" = c."name";

-- 5. Now safe to drop the old string column.
ALTER TABLE "Product" DROP COLUMN "category";

-- 6. Foreign key + index
ALTER TABLE "Product"
    ADD CONSTRAINT "Product_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

COMMIT;
