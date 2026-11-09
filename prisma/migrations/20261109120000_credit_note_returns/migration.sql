ALTER TABLE "CreditNote" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'BALANCE';

CREATE INDEX "CreditNote_tenantId_saleId_kind_createdAt_idx"
  ON "CreditNote"("tenantId", "saleId", "kind", "createdAt");

CREATE TABLE "CreditNoteItem" (
  "id" TEXT NOT NULL,
  "creditNoteId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT "CreditNoteItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreditNoteItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CreditNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CreditNoteItem_creditNoteId_idx" ON "CreditNoteItem"("creditNoteId");
