import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists incoming and outgoing tenant fund transfers. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (req.nextUrl.searchParams.get("mode") === "invoices") {
    const userId = req.nextUrl.searchParams.get("userId") || ""; const from = req.nextUrl.searchParams.get("from"); const to = req.nextUrl.searchParams.get("to");
    const dateRange = from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {};
    const [users, sales, currentUser] = await Promise.all([
      prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
      userId ? prisma.sale.findMany({ where: { tenantId: session.tenantId, userId, status: { not: "VOID" }, ...(session.branchId ? { branchId: session.branchId } : {}), ...dateRange }, include: { patient: { select: { fullName: true } } }, orderBy: { createdAt: "desc" }, take: 2000 }) : [],
      prisma.userProfile.findFirst({ where: { id: session.userId, tenantId: session.tenantId }, select: { id: true, fullName: true } }),
    ]);
    return NextResponse.json({ data: sales.map((sale) => ({ id: sale.id, invoiceNo: `INV-${sale.id.slice(-8).toUpperCase()}`, date: sale.createdAt, customer: sale.patient?.fullName ?? "Walk-in customer", type: sale.type, usdAmount: Number(sale.total), paidAmount: Number(sale.paidAmount) })), options: { users, currentUser } });
  }
  const data = await prisma.bankTransaction.findMany({ where: { tenantId: session.tenantId, type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] }, ...(session.branchId ? { bankAccount: { tenantId: session.tenantId } } : {}) }, include: { bankAccount: true }, orderBy: { createdAt: "desc" }, take: 1000 });
  return NextResponse.json({ data });
}

/** Transfers funds between tenant bank accounts and records both ledger entries. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const invoiceTransfer = z.object({ saleIds: z.array(z.string().min(1)).min(1).max(500), fromUserId: z.string().min(1) }).safeParse(body);
  if (invoiceTransfer.success) {
    if (invoiceTransfer.data.fromUserId === session.userId) return NextResponse.json({ error: "Invoices already belong to your account." }, { status: 400 });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.userProfile.findFirst({ where: { id: session.userId, tenantId: session.tenantId, isActive: true }, select: { id: true, fullName: true } });
        if (!target) throw new Error("Your user account is not active.");
        const where = { id: { in: invoiceTransfer.data.saleIds }, tenantId: session.tenantId, userId: invoiceTransfer.data.fromUserId, status: { not: "VOID" }, ...(session.branchId ? { branchId: session.branchId } : {}) };
        const found = await tx.sale.findMany({ where, select: { id: true } });
        if (found.length !== new Set(invoiceTransfer.data.saleIds).size) throw new Error("Some invoices are no longer available to transfer.");
        await tx.sale.updateMany({ where, data: { userId: target.id } });
        await tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "transaction-transfers", createdBy: session.userId, record: { fromUserId: invoiceTransfer.data.fromUserId, toUserId: target.id, saleIds: found.map((sale) => sale.id), transferredAt: new Date().toISOString() } } });
        return { transferred: found.length, toUser: target.fullName };
      }, { isolationLevel: "Serializable" });
      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invoice transfer failed" }, { status: 400 }); }
  }
  const parsed = z.object({ fromAccountId: z.string(), toAccountId: z.string(), amount: z.coerce.number().positive(), description: z.string().optional() }).safeParse(body);
  if (!parsed.success || parsed.data.fromAccountId === parsed.data.toAccountId) return NextResponse.json({ error: "Choose two different accounts and a positive amount" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const from = await tx.bankAccount.updateMany({ where: { id: parsed.data.fromAccountId, tenantId: session.tenantId, isActive: true, balance: { gte: parsed.data.amount } }, data: { balance: { decrement: parsed.data.amount } } });
      if (!from.count) throw new Error("Source account not found or has insufficient balance");
      const to = await tx.bankAccount.updateMany({ where: { id: parsed.data.toAccountId, tenantId: session.tenantId, isActive: true }, data: { balance: { increment: parsed.data.amount } } });
      if (!to.count) throw new Error("Destination account not found");
      const reference = `TRANSFER-${crypto.randomUUID()}`;
      const entries = await tx.bankTransaction.createMany({ data: [{ tenantId: session.tenantId, bankAccountId: parsed.data.fromAccountId, type: "TRANSFER_OUT", amount: parsed.data.amount, description: parsed.data.description, reference, createdBy: session.userId }, { tenantId: session.tenantId, bankAccountId: parsed.data.toAccountId, type: "TRANSFER_IN", amount: parsed.data.amount, description: parsed.data.description, reference, createdBy: session.userId }] });
      return { reference, entries: entries.count };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Transfer failed" }, { status: 400 }); }
}
