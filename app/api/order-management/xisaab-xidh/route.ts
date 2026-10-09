import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Calculates daily sales receipts and shows recorded close-outs. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10); const from = new Date(`${date}T00:00:00.000Z`); const to = new Date(`${date}T23:59:59.999Z`);
  const [sales, byPaymentMethod, reconciliations, expenses, accounts] = await Promise.all([
    prisma.sale.aggregate({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), createdAt: { gte: from, lte: to }, status: { not: "VOID" } }, _sum: { total: true, paidAmount: true, discount: true }, _count: { _all: true } }),
    prisma.sale.groupBy({ by: ["paymentMethod"], where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), createdAt: { gte: from, lte: to }, status: { not: "VOID" } }, _sum: { paidAmount: true }, _count: { _all: true } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), collection: "daily-reconciliation", createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), collection: "expenses", createdAt: { gte: from, lte: to }, deletedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.bankAccount.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, name: true, currency: true, balance: true }, orderBy: { name: "asc" } }),
  ]);
  const expenseRows = expenses.map((row) => {
    const record = row.record as Record<string, unknown>;
    return { id: row.id, description: String(record.description ?? ""), type: String(record.type ?? ""), amount: Number(record.amount ?? 0), currency: String(record.currency ?? "USD"), createdAt: row.createdAt };
  });
  const expenseTotal = expenseRows.reduce((sum, row) => sum + (row.currency === "USD" ? Number(row.amount ?? 0) : 0), 0);
  const paymentSummary = byPaymentMethod.map((row) => ({ method: row.paymentMethod || "Unspecified", amount: Number(row._sum.paidAmount || 0), transactions: row._count._all }));
  return NextResponse.json({ data: { date, sales: Number(sales._sum.total || 0), cashIn: Number(sales._sum.paidAmount || 0), discounts: Number(sales._sum.discount || 0), expenses: expenseRows, expenseTotal, net: Number(sales._sum.paidAmount || 0) - expenseTotal, transactions: sales._count._all, paymentSummary, accounts: accounts.map((account) => ({ ...account, balance: Number(account.balance) })), reconciliations: reconciliations.map((record) => ({ id: record.id, ...(record.record as object), createdAt: record.createdAt })) } });
}

/** Records the counted cash and calculated difference for the selected business day. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ date: z.string(), countedCash: z.coerce.number().min(0), notes: z.string().optional() }).safeParse(await req.json());
  if (!parsed.success || Number.isNaN(Date.parse(parsed.data?.date || ""))) return NextResponse.json({ error: "Valid date and counted cash are required" }, { status: 400 });
  const start = new Date(`${parsed.data.date}T00:00:00.000Z`); const end = new Date(`${parsed.data.date}T23:59:59.999Z`);
  const sales = await prisma.sale.aggregate({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), createdAt: { gte: start, lte: end }, status: { not: "VOID" } }, _sum: { paidAmount: true } });
  const expectedCash = Number(sales._sum.paidAmount || 0);
  const data = await prisma.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "daily-reconciliation", createdBy: session.userId, record: { date: parsed.data.date, expectedCash, countedCash: parsed.data.countedCash, difference: parsed.data.countedCash - expectedCash, notes: parsed.data.notes || "" } } });
  return NextResponse.json({ data: { id: data.id, ...(data.record as object) } }, { status: 201 });
}
