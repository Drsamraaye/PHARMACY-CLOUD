import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Applies a partial or full payment to a tenant supplier bill. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ purchaseId: z.string(), amount: z.coerce.number().positive(), paymentMethod: z.string().optional(), accountId: z.string().optional(), note: z.string().optional(), paymentDate: z.string().optional().refine((value) => !value || !Number.isNaN(Date.parse(value)), "Payment date is invalid") }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Purchase and a positive payment amount are required" }, { status: 400 });
  const bill = await prisma.purchase.findFirst({ where: { id: parsed.data.purchaseId, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  const outstanding = Number(bill.total) - Number(bill.paidAmount);
  if (parsed.data.amount > outstanding) return NextResponse.json({ error: "Payment cannot exceed the remaining bill balance" }, { status: 400 });
  const paidAmount = Number(bill.paidAmount) + parsed.data.amount;
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.purchase.update({ where: { id: bill.id }, data: { paidAmount, status: paidAmount >= Number(bill.total) ? "PAID" : "PARTIAL" } });
    await tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "supplier-bill-payments", createdBy: session.userId, record: { purchaseId: bill.id, amount: parsed.data.amount, paymentMethod: parsed.data.paymentMethod || null, accountId: parsed.data.accountId || null, note: parsed.data.note || null, paymentDate: parsed.data.paymentDate || null } } });
    return next;
  });
  return NextResponse.json({ data: { ...updated, balance: Math.max(0, Number(updated.total) - Number(updated.paidAmount)) } });
}
