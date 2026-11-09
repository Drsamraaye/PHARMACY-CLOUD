import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { businessDateKey, businessDateRecord } from "@/lib/business-date";

/** Lists tenant and active-branch pharmacy sales with remaining refundable stock/value. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sales = await prisma.sale.findMany({ where: { tenantId: session.tenantId, type: "PHARMACY", status: { not: "VOID" }, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { patient: { select: { id: true, fullName: true, phone: true } }, items: { include: { product: { select: { id: true, name: true, salePrice: true } } } }, refunds: { include: { items: true } }, creditNotes: { where: { kind: "RETURN" }, include: { items: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  const data = sales.map((sale) => {
    const returned = new Map<string, number>();
    for (const refund of sale.refunds) for (const item of refund.items) returned.set(item.productId, (returned.get(item.productId) || 0) + item.quantity);
    for (const credit of sale.creditNotes) for (const item of credit.items) returned.set(item.productId, (returned.get(item.productId) || 0) + item.quantity);
    const refundedAmount = sale.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
    const subtotalCents = sale.items.reduce((sum, item) => sum + Math.round(Number(item.unitPrice) * 100) * item.quantity, 0);
    const totalCents = Math.round(Number(sale.total) * 100);
    return { id: sale.id, date: sale.createdAt, total: Number(sale.total), paidAmount: Number(sale.paidAmount), refundedAmount, refundableAmount: Math.max(0, Math.min(Number(sale.paidAmount), Number(sale.total)) - refundedAmount), patient: sale.patient, items: sale.items.map((item) => ({ productId: item.productId, name: item.product.name, soldQuantity: item.quantity, returnedQuantity: returned.get(item.productId) || 0, unitPrice: subtotalCents > 0 ? Math.round(Math.round(Number(item.unitPrice) * 100) * totalCents / subtotalCents) / 100 : Number(item.unitPrice) })) };
  });
  return NextResponse.json({ data });
}

/** Refunds a previous sale, restores returned pharmacy units, and keeps an audit record. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ saleId: z.string(), amount: z.coerce.number().positive(), reason: z.string().trim().min(2), items: z.array(z.object({ productId: z.string(), quantity: z.coerce.number().int().positive() })).min(1), paymentMethod: z.string().trim().max(80).optional(), accountId: z.string().trim().max(120).optional(), notes: z.string().max(1000).optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid refund" }, { status: 400 });
  try {
    const data = await prisma.$transaction(async (tx) => {
      const refundDay = businessDateKey(new Date());
      if (session.branchId && await tx.dailyCloseout.findFirst({ where: { tenantId: session.tenantId, branchId: session.branchId, businessDate: businessDateRecord(refundDay) }, select: { id: true } })) throw new Error("This business day is closed; record the refund on an open business day.");
      const sale = await tx.sale.findFirst({ where: { id: parsed.data.saleId, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), status: { not: "VOID" } }, include: { items: { include: { product: true } }, creditNotes: { where: { kind: "RETURN" }, include: { items: true } } } });
      if (!sale) throw new Error("Sale not found");
      const previousRefunds = await tx.refund.aggregate({ where: { saleId: sale.id }, _sum: { amount: true } });
      const refundable = Math.max(0, Math.min(Number(sale.paidAmount), Number(sale.total)) - Number(previousRefunds._sum.amount || 0));
      if (parsed.data.amount > refundable) throw new Error("Refund exceeds the amount paid on this sale");
      const sold = new Map(sale.items.map((item) => [item.productId, item.quantity]));
      const subtotalCents = sale.items.reduce((sum, item) => sum + Math.round(Number(item.unitPrice) * 100) * item.quantity, 0);
      const totalCents = Math.round(Number(sale.total) * 100);
      const unitPrices = new Map(sale.items.map((item) => [item.productId, subtotalCents > 0 ? Math.round(Math.round(Number(item.unitPrice) * 100) * totalCents / subtotalCents) / 100 : Number(item.unitPrice)]));
      const previous = await tx.refundItem.groupBy({ by: ["productId"], where: { refund: { saleId: sale.id } }, _sum: { quantity: true } });
      const alreadyReturned = new Map(previous.map((row) => [row.productId, row._sum.quantity || 0]));
      for (const credit of sale.creditNotes) for (const item of credit.items) alreadyReturned.set(item.productId, (alreadyReturned.get(item.productId) || 0) + item.quantity);
      for (const line of parsed.data.items) if ((alreadyReturned.get(line.productId) || 0) + line.quantity > (sold.get(line.productId) || 0)) throw new Error("Returned quantity exceeds the original sale quantity");
      const itemRefundAmount = parsed.data.items.reduce((sum, line) => sum + (unitPrices.get(line.productId) || 0) * line.quantity, 0);
      if (Math.abs(itemRefundAmount - parsed.data.amount) > 0.01) throw new Error("Refund amount must match the returned items");
      const costPrices = new Map(sale.items.map((item) => [item.productId, Number(item.costPrice)]));
      const refund = await tx.refund.create({ data: { tenantId: session.tenantId, saleId: sale.id, amount: parsed.data.amount, exchangeRate: sale.exchangeRate, reflectedInSale: false, reason: parsed.data.reason, items: { create: parsed.data.items.map((item) => ({ ...item, costPrice: costPrices.get(item.productId) ?? 0 })) } }, include: { items: true } });
      const method = parsed.data.paymentMethod || "Cash Dollar";
      const localCurrency = /shilling|slsh|somaliland/i.test(method);
      const rate = Number(sale.exchangeRate);
      const zaad = /zaad/i.test(method);
      await tx.salePayment.create({ data: { tenantId: session.tenantId, branchId: sale.branchId, saleId: sale.id, userId: session.userId, method: `${zaad ? "Zaad" : "Cash"} ${localCurrency ? "Shilling" : "Dollar"}`, currency: localCurrency ? "SLSh" : "USD", amount: localCurrency ? -Math.round(parsed.data.amount * rate * 100) / 100 : -parsed.data.amount, exchangeRate: rate, usdEquivalent: -parsed.data.amount } });
      if (parsed.data.paymentMethod || parsed.data.accountId || parsed.data.notes) await tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "refund-details", createdBy: session.userId, record: { refundId: refund.id, paymentMethod: parsed.data.paymentMethod || "", accountId: parsed.data.accountId || "", notes: parsed.data.notes || "" } } });
      for (const line of parsed.data.items) {
        const saleLine = sale.items.find((item) => item.productId === line.productId);
        if (sale.type === "PHARMACY" && saleLine) {
          await tx.productBatch.create({ data: { productId: line.productId, quantity: line.quantity, costPrice: saleLine.costPrice, batchNo: `RETURN-${refund.id.slice(-8)}` } });
          await tx.productHistory.create({ data: { tenantId: session.tenantId, productId: line.productId, userId: session.userId, action: "PATIENT_REFUND_RETURN", details: `${line.quantity} returned from sale ${sale.id}; refund ${refund.id}` } });
        }
      }
      return refund;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Refund could not be processed" }, { status: 400 }); }
}
