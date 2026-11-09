import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { businessDateKey, businessDateRecord } from "@/lib/business-date";

const schema = z.object({ supplierId: z.string().optional(), invoiceNo: z.string().optional(), purchaseDate: z.string().optional().refine((value) => !value || !Number.isNaN(Date.parse(value)), "Purchase date is invalid"), discount: z.coerce.number().finite().min(0).max(9_999_999_999.99).default(0), paidAmount: z.coerce.number().finite().min(0).max(9_999_999_999.99).default(0), notes: z.string().optional(), items: z.array(z.object({ productId: z.string(), quantity: z.coerce.number().int().positive().max(1_000_000), costPrice: z.coerce.number().finite().min(0).max(9_999_999_999.99), salePrice: z.coerce.number().finite().min(0).max(9_999_999_999.99).optional(), expiryDate: z.string().optional(), batchNo: z.string().optional() })).min(1) });

/** Lists purchases for the active tenant and branch. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await prisma.purchase.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { supplier: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ data });
}

/** Records a supplier purchase and receives its products into batches atomically. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid purchase" }, { status: 400 });
  const input = parsed.data; const ids = [...new Set(input.items.map((line) => line.productId))];
  const products = await prisma.product.findMany({ where: { tenantId: session.tenantId, id: { in: ids }, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true } });
  if (products.length !== ids.length) return NextResponse.json({ error: "One or more products were not found" }, { status: 400 });
  if (input.supplierId && !await prisma.supplier.findFirst({ where: { id: input.supplierId, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) } })) return NextResponse.json({ error: "Supplier not found in this branch" }, { status: 400 });
  const toCents = (amount: number) => Math.round(amount * 100);
  const subtotalCents = input.items.reduce((sum, line) => sum + line.quantity * toCents(line.costPrice), 0);
  const discountCents = toCents(input.discount);
  const paidCents = toCents(input.paidAmount);
  if (discountCents > subtotalCents || paidCents > subtotalCents - discountCents) return NextResponse.json({ error: "Discount or paid amount exceeds the purchase total" }, { status: 400 });
  const totalCents = subtotalCents - discountCents;
  if (!await prisma.exchangeRate.findFirst({ where: { tenantId: session.tenantId }, select: { id: true } })) return NextResponse.json({ error: "Set the centralized exchange rate before recording purchases" }, { status: 400 });
  const purchaseDay = input.purchaseDate || businessDateKey(new Date());
  try {
  const purchase = await prisma.$transaction(async (tx) => {
    if (session.branchId && await tx.dailyCloseout.findFirst({ where: { tenantId: session.tenantId, branchId: session.branchId, businessDate: businessDateRecord(purchaseDay) }, select: { id: true } })) throw new Error("This business day is closed; record the purchase on an open business day.");
    const rateRow = await tx.exchangeRate.findFirst({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } });
    if (!rateRow) throw new Error("Set the centralized exchange rate before recording purchases");
    const rate = Number(rateRow.rate);
    const rateMicros = BigInt(Math.round(rate * 1_000_000));
    const totalSLShCents = Number((BigInt(totalCents) * rateMicros + 500_000n) / 1_000_000n);
    const total = totalCents / 100;
    const created = await tx.purchase.create({ data: { tenantId: session.tenantId, branchId: session.branchId, supplierId: input.supplierId || null, total, exchangeRate: rate.toFixed(6), totalSLSh: totalSLShCents / 100, discount: discountCents / 100, paidAmount: paidCents / 100, invoiceNo: input.invoiceNo || null, notes: input.notes || null, createdAt: new Date(`${purchaseDay}T12:00:00+03:00`), status: paidCents >= totalCents ? "PAID" : paidCents > 0 ? "PARTIAL" : "UNPAID", items: { create: input.items.map((line) => ({ productId: line.productId, quantity: line.quantity, costPrice: line.costPrice })) } }, include: { items: true, supplier: true } });
    if (paidCents > 0) await tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "supplier-bill-payments", createdBy: session.userId, record: { purchaseId: created.id, amount: paidCents / 100, paymentAmount: paidCents / 100, paymentCurrency: "USD", paymentMethod: "Cash Dollar", paymentDate: purchaseDay, exchangeRate: rate } } });
    for (const line of input.items) {
      await tx.productBatch.create({ data: { productId: line.productId, quantity: line.quantity, costPrice: line.costPrice, supplierId: input.supplierId || null, expiryDate: line.expiryDate ? new Date(line.expiryDate) : null, batchNo: line.batchNo || null } });
      if (line.salePrice !== undefined) await tx.product.updateMany({ where: { id: line.productId, tenantId: session.tenantId }, data: { salePrice: line.salePrice } });
    }
    return created;
  }, { isolationLevel: "Serializable" });
  return NextResponse.json({ data: purchase }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Transactions changed during purchase. Refresh and retry." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Purchase could not be saved" }, { status: 400 });
  }
}
