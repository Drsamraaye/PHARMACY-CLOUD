import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists outstanding credit notes for the tenant. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (req.nextUrl.searchParams.get("sourceSales") === "true") {
    const sales = await prisma.sale.findMany({ where: { tenantId: session.tenantId, status: { not: "VOID" }, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { patient: { select: { id: true, fullName: true, phone: true } }, items: { include: { product: { select: { id: true, name: true } } } }, creditNotes: { select: { amount: true, remainingAmount: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
    return NextResponse.json({ data: sales.map((sale) => { const used = sale.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0); return { id: sale.id, date: sale.createdAt, total: Number(sale.total), paidAmount: Number(sale.paidAmount), patient: sale.patient, items: sale.items.map((item) => ({ productId: item.productId, name: item.product.name, quantity: item.quantity, unitPrice: Number(item.unitPrice) })), creditAmount: used, remainingCredit: Math.max(0, Number(sale.total) - used) }; }) });
  }
  const data = await prisma.creditNote.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" }, take: 1000 }); return NextResponse.json({ data });
}

/** Issues a reusable non-cash credit note against a previous sale. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ saleId: z.string(), amount: z.coerce.number().positive(), paymentMethod: z.string().trim().max(80).optional(), accountId: z.string().trim().max(120).optional(), notes: z.string().max(1000).optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Sale and a positive credit amount are required" }, { status: 400 });
  const data = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id: parsed.data.saleId, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, patientId: true, total: true } });
    if (!sale) throw new Error("Sale not found");
    const credits = await tx.creditNote.aggregate({ where: { saleId: sale.id }, _sum: { amount: true } });
    const available = Number(sale.total) - Number(credits._sum.amount || 0);
    if (parsed.data.amount > available) throw new Error("Credit amount exceeds the uncredited sale value");
    const credit = await tx.creditNote.create({ data: { tenantId: session.tenantId, saleId: sale.id, patientId: sale.patientId, amount: parsed.data.amount, remainingAmount: parsed.data.amount } });
    if (parsed.data.paymentMethod || parsed.data.accountId || parsed.data.notes) await tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "credit-note-details", createdBy: session.userId, record: { creditNoteId: credit.id, paymentMethod: parsed.data.paymentMethod || "", accountId: parsed.data.accountId || "", notes: parsed.data.notes || "" } } });
    return credit;
  }).catch((error) => error instanceof Error ? error : new Error("Credit note could not be created"));
  if (data instanceof Error) return NextResponse.json({ error: data.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
