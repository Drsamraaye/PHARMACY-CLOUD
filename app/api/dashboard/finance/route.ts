import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type JsonRecord = Record<string, unknown>;
const recordOf = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const numberOf = (row: JsonRecord, ...keys: string[]) => { for (const key of keys) { const value = Number(row[key]); if (Number.isFinite(value)) return value; } return 0; };
const accountMatch = (record: JsonRecord, accountId: string, accountName: string) => !accountId || String(record.accountId ?? "") === accountId || String(record.accountName ?? "") === accountName;

/** Tenant/branch scoped financial dashboard data for the selected date range. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams; const fromValue = params.get("from") || new Date().toLocaleDateString("en-CA"); const toValue = params.get("to") || fromValue; const accountId = params.get("accountId") || "";
  const from = new Date(`${fromValue}T00:00:00`); const to = new Date(`${toValue}T23:59:59.999`); if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const branch = session.branchId ? { branchId: session.branchId } : {}; const moduleBranch = session.branchId ? { branchId: session.branchId } : {};
  const [sales, purchases, expenses, receipts, debts, billPayments, tickets, refunds, stock, customerSales, supplierPurchases, accountRows] = await Promise.all([
    prisma.sale.findMany({ where: { tenantId: session.tenantId, ...branch, status: { not: "VOID" }, createdAt: { gte: from, lte: to } }, select: { total: true, paidAmount: true, type: true } }),
    prisma.purchase.findMany({ where: { tenantId: session.tenantId, ...branch, createdAt: { gte: from, lte: to } }, select: { id: true, total: true, paidAmount: true, discount: true, createdAt: true, supplier: { select: { id: true, name: true, phone: true } } } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "expenses", deletedAt: null, ...moduleBranch, createdAt: { gte: from, lte: to } } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "customer-receipts", deletedAt: null, ...moduleBranch, createdAt: { gte: from, lte: to } } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "debts", deletedAt: null, ...moduleBranch, createdAt: { gte: from, lte: to } } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "supplier-bill-payments", deletedAt: null, ...moduleBranch, createdAt: { gte: from, lte: to } } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "tickets", deletedAt: null, ...moduleBranch, createdAt: { gte: from, lte: to } } }),
    prisma.refund.findMany({ where: { tenantId: session.tenantId, sale: branch, createdAt: { gte: from, lte: to } }, select: { amount: true } }),
    prisma.productBatch.findMany({ where: { product: { tenantId: session.tenantId, isActive: true, ...branch } }, select: { quantity: true, costPrice: true, product: { select: { costPrice: true, salePrice: true } } } }),
    prisma.sale.findMany({ where: { tenantId: session.tenantId, ...branch, status: { not: "VOID" }, patientId: { not: null } }, select: { total: true, paidAmount: true, patient: { select: { id: true, fullName: true, phone: true } } } }),
    prisma.purchase.findMany({ where: { tenantId: session.tenantId, ...branch }, select: { total: true, paidAmount: true, supplier: { select: { id: true, name: true, phone: true } } } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "setup/accounts", deletedAt: null }, orderBy: { createdAt: "asc" }, take: 500 }),
  ]);
  const accountOptions = accountRows.map((row) => ({ id: row.id, name: String(recordOf(row.record).name ?? recordOf(row.record).accountName ?? "Account") }));
  const selectedAccount = accountOptions.find((item) => item.id === accountId); const accountName = selectedAccount?.name ?? "";
  const filteredRecords = (rows: typeof expenses) => rows.filter((row) => accountMatch(recordOf(row.record), accountId, accountName));
  const filteredExpenses = filteredRecords(expenses); const filteredReceipts = filteredRecords(receipts); const filteredDebts = filteredRecords(debts); const filteredPayments = filteredRecords(billPayments);
  const sumRecords = (rows: typeof expenses, ...keys: string[]) => rows.reduce((sum, row) => sum + numberOf(recordOf(row.record), ...keys), 0);
  const salesTotal = sales.reduce((sum, row) => sum + Number(row.total), 0); const salesPaid = sales.reduce((sum, row) => sum + Number(row.paidAmount), 0);
  const pharmacySales = sales.filter((row) => row.type === "PHARMACY").reduce((sum, row) => sum + Number(row.total), 0);
  const labSales = sales.filter((row) => row.type === "LAB").reduce((sum, row) => sum + Number(row.total), 0); const serviceSales = sales.filter((row) => row.type === "SERVICE").reduce((sum, row) => sum + Number(row.total), 0);
  const debtCollection = sumRecords(filteredReceipts, "amount"); const debtAdded = sumRecords(filteredDebts, "amount", "total", "balance");
  const purchaseTotal = purchases.reduce((sum, row) => sum + Number(row.total), 0); const purchasePaid = purchases.reduce((sum, row) => sum + Number(row.paidAmount), 0);
  const normalExpenses = filteredExpenses.reduce((sum, row) => { const value = recordOf(row.record); return String(value.currency ?? "USD").toUpperCase() === "USD" ? sum + numberOf(value, "amount", "total") : sum; }, 0);
  const supplierPayments = sumRecords(filteredPayments, "amount"); const refundTotal = refunds.reduce((sum, row) => sum + Number(row.amount), 0);
  const stockValue = stock.reduce((sum, batch) => sum + batch.quantity * Number(batch.costPrice || batch.product.costPrice), 0); const stockAfterSale = stock.reduce((sum, batch) => sum + batch.quantity * Number(batch.product.salePrice), 0);
  const customers = new Map<string, { id: string; name: string; phone: string; balance: number }>();
  for (const sale of customerSales) if (sale.patient && Number(sale.total) > Number(sale.paidAmount)) { const old = customers.get(sale.patient.id) ?? { id: sale.patient.id, name: sale.patient.fullName, phone: sale.patient.phone ?? "—", balance: 0 }; old.balance += Number(sale.total) - Number(sale.paidAmount); customers.set(sale.patient.id, old); }
  const suppliers = new Map<string, { id: string; name: string; phone: string; balance: number }>();
  for (const purchase of supplierPurchases) if (purchase.supplier && Number(purchase.total) > Number(purchase.paidAmount)) { const old = suppliers.get(purchase.supplier.id) ?? { id: purchase.supplier.id, name: purchase.supplier.name, phone: purchase.supplier.phone ?? "—", balance: 0 }; old.balance += Number(purchase.total) - Number(purchase.paidAmount); suppliers.set(purchase.supplier.id, old); }
  const totalCustomerBalance = [...customers.values()].reduce((sum, row) => sum + row.balance, 0); const totalSupplierBalance = [...suppliers.values()].reduce((sum, row) => sum + row.balance, 0);
  const ticketsAmount = sumRecords(tickets, "amount", "total"); const totalIncome = salesPaid + debtCollection; const totalExpenses = purchasePaid + normalExpenses;
  return NextResponse.json({ data: {
    cards: { todaySales: salesTotal, debtCollection, todayDebt: debtAdded, purchaseAmount: purchaseTotal, stockValue, stockAfterSale, customerBalance: totalCustomerBalance, supplierBalance: totalSupplierBalance, labSales, services: serviceSales, tickets: ticketsAmount, supplierPayments, totalIncome, totalExpenses, netAmount: totalIncome - totalExpenses, normalExpenses, todayRefund: refundTotal },
    charts: { income: [{ label: "Sales", value: salesPaid, color: "#49b9bb" }, { label: "Debt Collection", value: debtCollection, color: "#9361f8" }, { label: "Debt", value: debtAdded, color: "#ff9a35" }], expenses: [{ label: "Purchase Expenses", value: purchasePaid }, { label: "Supplier Debt", value: totalSupplierBalance }, { label: "Normal Expenses", value: normalExpenses }] },
    customers: [...customers.values()].sort((a, b) => b.balance - a.balance).slice(0, 25), suppliers: [...suppliers.values()].sort((a, b) => b.balance - a.balance).slice(0, 25), accounts: accountOptions,
    selectedAccountId: accountId, range: { from: fromValue, to: toValue },
  } });
}
