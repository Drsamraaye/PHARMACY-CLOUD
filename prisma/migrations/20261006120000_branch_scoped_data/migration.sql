ALTER TABLE "Supplier" ADD COLUMN "branchId" TEXT;
ALTER TABLE "BankAccount" ADD COLUMN "branchId" TEXT;

-- Existing tenant-wide inventory and operational records belong to the first
-- configured branch so they do not leak into every newly created branch.
UPDATE "Product" AS record
SET "branchId" = (SELECT branch."id" FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId" ORDER BY branch."createdAt", branch."id" LIMIT 1)
WHERE record."branchId" IS NULL AND EXISTS (SELECT 1 FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId");

UPDATE "Patient" AS record
SET "branchId" = (SELECT branch."id" FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId" ORDER BY branch."createdAt", branch."id" LIMIT 1)
WHERE record."branchId" IS NULL AND EXISTS (SELECT 1 FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId");

UPDATE "Sale" AS record
SET "branchId" = (SELECT branch."id" FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId" ORDER BY branch."createdAt", branch."id" LIMIT 1)
WHERE record."branchId" IS NULL AND EXISTS (SELECT 1 FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId");

UPDATE "Purchase" AS record
SET "branchId" = (SELECT branch."id" FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId" ORDER BY branch."createdAt", branch."id" LIMIT 1)
WHERE record."branchId" IS NULL AND EXISTS (SELECT 1 FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId");

UPDATE "ModuleRecord" AS record
SET "branchId" = (SELECT branch."id" FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId" ORDER BY branch."createdAt", branch."id" LIMIT 1)
WHERE record."branchId" IS NULL AND EXISTS (SELECT 1 FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId");

UPDATE "Supplier" AS record
SET "branchId" = (SELECT branch."id" FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId" ORDER BY branch."createdAt", branch."id" LIMIT 1)
WHERE EXISTS (SELECT 1 FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId");

UPDATE "BankAccount" AS record
SET "branchId" = (SELECT branch."id" FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId" ORDER BY branch."createdAt", branch."id" LIMIT 1)
WHERE record."branchId" IS NULL AND EXISTS (SELECT 1 FROM "Branch" AS branch WHERE branch."tenantId" = record."tenantId");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Supplier_tenantId_branchId_name_idx" ON "Supplier"("tenantId", "branchId", "name");
DROP INDEX "BankAccount_tenantId_name_key";
CREATE UNIQUE INDEX "BankAccount_tenantId_branchId_name_key" ON "BankAccount"("tenantId", "branchId", "name");
CREATE INDEX "BankAccount_tenantId_branchId_idx" ON "BankAccount"("tenantId", "branchId");
