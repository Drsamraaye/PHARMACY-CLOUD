import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { businessDateKey, businessDateRecord } from "@/lib/business-date";

/** Applies an auditable USD-equivalent supplier payment to an invoice. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ purchaseId: z.string(), amount: z.coerce.number().positive().finite(), paymentMethod: z.string().optional(), accountId: z.string().optional(), note: z.string().optional(), paymentDate: z.string().optional().refine((value) => !value || !Number.isNaN(Date.parse(value)), "Payment date is invalid") }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Purchase and a positive payment amount are required" }, { status: 400 });
  const bill = await prisma.purchase.findFirst({ where: { id: parsed.data.purchaseId, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  const amountCents = Math.round(parsed.data.amount * 100); const totalCents = Math.round(Number(bill.total) * 100); const oldPaidCents = Math.round(Number(bill.paidAmount) * 100);
  if (amountCents > totalCents - oldPaidCents) return NextResponse.json({ error: "Payment cannot exceed the remaining bill balance" }, { status: 400 });
  const paidCents = oldPaidCents + amountCents;
  const method = parsed.data.paymentMethod || "Cash Dollar";
  const paymentDay = parsed.data.paymentDate || businessDateKey(new Date());
  const paymentCurrency = /shilling|slsh|somaliland/i.test(method) ? "SLSh" : "USD";
  const exchangeRate = Number(bill.exchangeRate);
  const paymentAmount = paymentCurrency === "SLSh" ? Math.round(amountCents * exchangeRate) / 100 : amountCents / 100;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (bill.branchId && await tx.dailyCloseout.findFirst({ where: { tenantId: session.tenantId, branchId: bill.branchId, businessDate: businessDateRecord(paymentDay) }, select: { id: true } })) throw new Error("This business day is closed; record the supplier payment on an open business day.");
      const changed = await tx.purchase.updateMany({ where: { id: bill.id, tenantId: session.tenantId, paidAmount: bill.paidAmount }, data: { paidAmount: paidCents / 100, status: paidCents >= totalCents ? "PAID" : "PARTIAL" } });
      if (!changed.count) throw new Error("The invoice balance changed. Refresh and try again.");
      await tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: bill.branchId, collection: "supplier-bill-payments", createdBy: session.userId, record: { purchaseId: bill.id, amount: amountCents / 100, usdEquivalent: amountCents / 100, paymentAmount, paymentCurrency, paymentMethod: method, accountId: parsed.data.accountId || null, note: parsed.data.note || null, paymentDate: paymentDay, exchangeRate } } });
      return tx.purchase.findUniqueOrThrow({ where: { id: bill.id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: { ...updated, balance: Math.max(0, Number(updated.total) - Number(updated.paidAmount)) } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Invoice changed during payment. Refresh and retry." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record supplier payment" }, { status: 400 });
  }
}
