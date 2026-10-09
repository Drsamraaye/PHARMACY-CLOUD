import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists purchases that still have returnable quantity, grouped for the supplier refund form. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supplierId = req.nextUrl.searchParams.get("supplierId");
  const [purchases, history] = await Promise.all([
    prisma.purchase.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), ...(supplierId ? { supplierId } : {}) }, include: { supplier: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "purchase-refunds" } }),
  ]);
  const returned = new Map<string, number>();
  for (const entry of history) { const record = entry.record as { purchaseId?: string; items?: { productId: string; quantity: number }[] }; for (const item of record.items ?? []) { const key = `${record.purchaseId}:${item.productId}`; returned.set(key, (returned.get(key) ?? 0) + item.quantity); } }
  const productIds = [...new Set(purchases.flatMap((purchase) => purchase.items.map((item) => item.productId)))];
  const batches = await prisma.productBatch.groupBy({ by: ["productId"], where: { productId: { in: productIds } }, _sum: { quantity: true } });
  const stock = new Map(batches.map((batch) => [batch.productId, batch._sum.quantity ?? 0]));
  const data = purchases.map((purchase) => ({ ...purchase, items: purchase.items.map((item) => ({ ...item, returnedQuantity: returned.get(`${purchase.id}:${item.productId}`) ?? 0, stock: stock.get(item.productId) ?? 0 })) }));
  return NextResponse.json({ data });
}

/** Returns supplier goods by decrementing available batches and saving a return record. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ purchaseId: z.string(), amount: z.coerce.number().positive(), reason: z.string().min(2), paymentMethod: z.string().optional(), accountId: z.string().optional(), notes: z.string().optional(), items: z.array(z.object({ productId: z.string(), quantity: z.coerce.number().int().positive() })).min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Purchase, reason, return items, and amount are required" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({ where: { id: parsed.data.purchaseId, tenantId: session.tenantId }, include: { items: true } });
      if (!purchase) throw new Error("Purchase not found");
      if (parsed.data.amount > Number(purchase.total)) throw new Error("Refund amount exceeds purchase value");
      const history = await tx.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "purchase-refunds" } });
      const already = new Map<string, number>();
      for (const record of history) { const value = record.record as { purchaseId?: string; items?: { productId: string; quantity: number }[] }; if (value.purchaseId === purchase.id) for (const line of value.items || []) already.set(line.productId, (already.get(line.productId) || 0) + line.quantity); }
      for (const line of parsed.data.items) { const purchased = purchase.items.filter((item) => item.productId === line.productId).reduce((sum, item) => sum + item.quantity, 0); if ((already.get(line.productId) || 0) + line.quantity > purchased) throw new Error("Return quantity exceeds the original purchase quantity"); }
      for (const line of parsed.data.items) {
        let remaining = line.quantity;
        const batches = await tx.productBatch.findMany({ where: { productId: line.productId, quantity: { gt: 0 } }, orderBy: [{ expiryDate: "desc" }, { createdAt: "desc" }] });
        for (const batch of batches) { if (!remaining) break; const quantity = Math.min(remaining, batch.quantity); const update = await tx.productBatch.updateMany({ where: { id: batch.id, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } }); if (!update.count) throw new Error("Stock changed while processing the supplier return"); remaining -= quantity; }
        if (remaining) throw new Error("Returned product quantity exceeds current stock");
      }
      const total = Number(purchase.total) - parsed.data.amount;
      const paidAmount = Math.min(Number(purchase.paidAmount), total);
      await tx.purchase.update({ where: { id: purchase.id }, data: { total, paidAmount, status: paidAmount >= total ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID" } });
      return tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "purchase-refunds", createdBy: session.userId, record: { purchaseId: purchase.id, amount: parsed.data.amount, reason: parsed.data.reason, paymentMethod: parsed.data.paymentMethod || null, accountId: parsed.data.accountId || null, notes: parsed.data.notes || null, items: parsed.data.items } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: { id: result.id, ...(result.record as object) } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Supplier return failed" }, { status: 400 }); }
}
