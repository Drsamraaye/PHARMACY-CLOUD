ALTER TABLE "Product"
  ADD COLUMN "genericName" TEXT,
  ADD COLUMN "manufacturer" TEXT,
  ADD COLUMN "salePrice2" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "salePriceCurrency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "salePrice2Currency" TEXT NOT NULL DEFAULT 'SLSH',
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedBy" TEXT;

ALTER TABLE "ProductBatch" ADD COLUMN "supplierId" TEXT;
CREATE INDEX "ProductBatch_supplierId_idx" ON "ProductBatch"("supplierId");
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "Product" SET "archivedAt" = "updatedAt" WHERE "isActive" = false;
