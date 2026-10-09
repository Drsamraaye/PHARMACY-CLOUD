import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Tenant and active branch scoped transaction ledger for sales, purchases, and expenses. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const from = params.get("from"); const to = params.get("to"); const type = params.get("type") || "ALL";
  const customerId = params.get("customerId") || ""; const userId = params.get("userId") || ""; const paymentMethod = params.get("paymentMethod") || "";
  const dateRange = from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {};
  const branch = session.branchId ? { branchId: session.branchId } : {};
  const includeSales = type === "ALL" || type === "SALES" || type === "PHARMACY" || type === "LAB" || type === "SERVICE";
  const includePurchases = type === "ALL" || type === "PURCHASE";
  const includeExpenses = type === "ALL" || type === "EXPENSE";
  const [sales, purchases, expenseRecords, patients, users] = await Promise.all([
    includeSales ? prisma.sale.findMany({ where: { tenantId: session.tenantId, ...branch, ...dateRange, ...(customerId ? { patientId: customerId } : {}), ...(userId ? { userId } : {}), ...(paymentMethod ? { paymentMethod } : {}), ...(type !== "ALL" && type !== "SALES" ? { type } : {}) }, include: { patient: { select: { id: true, fullName: true, phone: true } }, items: { select: { quantity: true, product: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 2000 }) : [],
    includePurchases && !customerId && !paymentMethod && !userId ? prisma.purchase.findMany({ where: { tenantId: session.tenantId, ...branch, ...dateRange }, include: { supplier: { select: { id: true, name: true, phone: true } }, items: { select: { quantity: true, product: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 1000 }) : [],
    includeExpenses && !customerId ? prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "expenses", deletedAt: null, ...dateRange, ...(session.branchId ? { branchId: session.branchId } : {}), ...(userId ? { createdBy: userId } : {}) }, orderBy: { createdAt: "desc" }, take: 1000 }) : [],
    prisma.patient.findMany({ where: { tenantId: session.tenantId, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 1000 }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 500 }),
  ]);
  const userNames = new Map(users.map((user) => [user.id, user.fullName]));
  type LedgerRow = { id: string; date: Date; customer: string; phone: string; section: string; paymentMethod: string; account: string; user: string; quantity: number; out: number; in: number; currency: string; details: string };
  const ledger: LedgerRow[] = [
    ...sales.map((sale) => ({ id: sale.id, date: sale.createdAt, customer: sale.patient?.fullName ?? "Walk-in customer", phone: sale.patient?.phone ?? "—", section: sale.type, paymentMethod: sale.paymentMethod ?? "—", account: "—", user: userNames.get(sale.userId ?? "") ?? "—", quantity: sale.items.reduce((sum, item) => sum + item.quantity, 0), out: 0, in: Number(sale.paidAmount), currency: "USD", details: sale.items.map((item) => `${item.product.name} × ${item.quantity}`).join(", ") })),
    ...purchases.map((purchase) => ({ id: purchase.id, date: purchase.createdAt, customer: purchase.supplier?.name ?? "Supplier", phone: purchase.supplier?.phone ?? "—", section: "Purchase", paymentMethod: "—", account: "—", user: "—", quantity: purchase.items.reduce((sum, item) => sum + item.quantity, 0), out: Number(purchase.paidAmount), in: 0, currency: "USD", details: purchase.items.map((item) => `${item.product.name} × ${item.quantity}`).join(", ") })),
    ...expenseRecords.filter((record) => { const value = record.record as Record<string, unknown>; return !paymentMethod || String(value.paymentMethod ?? "") === paymentMethod; }).map((record) => { const value = record.record as Record<string, unknown>; return { id: record.id, date: record.createdAt, customer: String(value.description ?? value.type ?? "Expense"), phone: "—", section: "Expenses", paymentMethod: String(value.paymentMethod ?? "—"), account: String(value.accountName ?? "—"), user: userNames.get(record.createdBy ?? "") ?? "—", quantity: 0, out: Number(value.amount ?? 0), in: 0, currency: String(value.currency ?? "USD"), details: String(value.notes ?? value.description ?? value.type ?? "Expense") }; }),
  ];
  ledger.sort((a, b) => a.date.getTime() - b.date.getTime());
  const balances = new Map<string, number>();
  const withBalance = ledger.map((row) => { const current = (balances.get(row.currency) || 0) + row.in - row.out; balances.set(row.currency, current); return { ...row, balance: current }; }).reverse();
  const endingBalance = [...balances.values()].reduce((sum, value) => sum + value, 0);
  return NextResponse.json({ data: withBalance, options: { customers: patients, users, paymentMethods: [...new Set(ledger.map((row) => row.paymentMethod).filter((value) => value !== "—"))], totalQuantity: ledger.reduce((sum, row) => sum + row.quantity, 0), totalOut: ledger.reduce((sum, row) => sum + row.out, 0), totalIn: ledger.reduce((sum, row) => sum + row.in, 0), endingBalance } });
}
