-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "costAtSale" INTEGER;


-- Back-fill legacy rows with current product cost as the best available approximation.
-- Ceil'd so we never overstate profit; comment on the column notes this is imprecise for
-- rows written before this migration. New rows always populate costAtSale exactly.
UPDATE "SaleLine" sl SET "costAtSale" = CEIL(p."costPerCarton"::numeric / GREATEST(p."unitsPerCarton", 1))::int FROM "Product" p WHERE p.id = sl."productId" AND sl."costAtSale" IS NULL;
