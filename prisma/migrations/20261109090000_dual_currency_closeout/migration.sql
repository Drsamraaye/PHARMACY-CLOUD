ALTER TABLE "Sale"
  ADD COLUMN "exchangeRate" DECIMAL(14,6) NOT NULL DEFAULT 1,
  ADD COLUMN "totalUsd" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Purchase"
  ADD COLUMN "exchangeRate" DECIMAL(14,6) NOT NULL DEFAULT 1,
  ADD COLUMN "totalSLSh" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SaleItem" ADD COLUMN "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RefundItem" ADD COLUMN "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Refund" ADD COLUMN "exchangeRate" DECIMAL(14,6) NOT NULL DEFAULT 1;
ALTER TABLE "Refund" ADD COLUMN "reflectedInSale" BOOLEAN NOT NULL DEFAULT TRUE;

-- Preserve historical sale totals as USD values without recalculating them.
UPDATE "Sale" SET "totalUsd" = "total" WHERE "totalUsd" = 0;

CREATE TABLE "ExchangeRate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "rate" DECIMAL(14,6) NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExchangeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ExchangeRate_tenantId_createdAt_idx" ON "ExchangeRate"("tenantId", "createdAt");

CREATE TABLE "SalePayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "saleId" TEXT NOT NULL,
  "userId" TEXT,
  "method" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "exchangeRate" DECIMAL(14,6) NOT NULL,
  "usdEquivalent" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalePayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SalePayment_tenantId_branchId_createdAt_idx" ON "SalePayment"("tenantId", "branchId", "createdAt");
CREATE INDEX "SalePayment_saleId_createdAt_idx" ON "SalePayment"("saleId", "createdAt");
CREATE INDEX "SalePayment_tenantId_method_currency_createdAt_idx" ON "SalePayment"("tenantId", "method", "currency", "createdAt");

CREATE TABLE "DailyCloseout" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "businessDate" DATE NOT NULL,
  "closedBy" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exchangeRate" DECIMAL(14,6) NOT NULL,
  "expectedCashSLSh" DECIMAL(14,2) NOT NULL,
  "expectedCashUSD" DECIMAL(14,2) NOT NULL,
  "expectedZaadSLSh" DECIMAL(14,2) NOT NULL,
  "expectedZaadUSD" DECIMAL(14,2) NOT NULL,
  "actualCashSLSh" DECIMAL(14,2) NOT NULL,
  "actualCashUSD" DECIMAL(14,2) NOT NULL,
  "actualZaadSLSh" DECIMAL(14,2) NOT NULL,
  "actualZaadUSD" DECIMAL(14,2) NOT NULL,
  "differenceCashSLSh" DECIMAL(14,2) NOT NULL,
  "differenceCashUSD" DECIMAL(14,2) NOT NULL,
  "differenceZaadSLSh" DECIMAL(14,2) NOT NULL,
  "differenceZaadUSD" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL,
  CONSTRAINT "DailyCloseout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyCloseout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DailyCloseout_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DailyCloseout_tenantId_branchId_businessDate_key" ON "DailyCloseout"("tenantId", "branchId", "businessDate");
CREATE INDEX "DailyCloseout_tenantId_businessDate_idx" ON "DailyCloseout"("tenantId", "businessDate");
CREATE INDEX "DailyCloseout_branchId_businessDate_idx" ON "DailyCloseout"("branchId", "businessDate");

