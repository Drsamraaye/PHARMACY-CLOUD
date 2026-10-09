import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RecordValue = Record<string, unknown>;
const recordOf = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const numberOf = (value: RecordValue, ...keys: string[]) => {
  for (const key of keys) { const number = Number(value[key]); if (Number.isFinite(number)) return number; }
  return 0;
};
const dateOf = (value: string, end = false) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (end) date.setHours(23, 59, 59, 999); else date.setHours(0, 0, 0, 0);
  return date;
};

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const fromValue = params.get("from") || `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const toValue = params.get("to") || `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;
  const search = (params.get("search") || "").trim().toLowerCase();
  const canChoose = session.role === "OWNER" || session.role === "ADMIN";
  const selectedBranch = canChoose ? (params.get("branchId") || "") : (session.branchId || "");
  const branchFilter = selectedBranch ? { branchId: selectedBranch } : session.branchId ? { branchId: session.branchId } : {};
  const from = dateOf(fromValue); const to = dateOf(toValue, true);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const saleScope = { tenantId: session.tenantId, ...branchFilter, status: { not: "VOID" }, createdAt: { gte: from, lte: to } };
  const recordScope = { tenantId: session.tenantId, deletedAt: null, ...branchFilter, createdAt: { gte: from, lte: to } };

  const [items, sales, expenses, supplierPayments, branches, accountRows] = await Promise.all([
    prisma.saleItem.findMany({ where: { sale: saleScope }, select: { productId: true, quantity: true, unitPrice: true, product: { select: { name: true, costPrice: true } } }, take: 50000 }),
    prisma.sale.findMany({ where: saleScope, select: { discount: true } }),
    prisma.moduleRecord.findMany({ where: { ...recordScope, collection: "expenses" }, select: { record: true, createdAt: true, createdBy: true } }),
    prisma.moduleRecord.findMany({ where: { ...recordScope, collection: "supplier-bill-payments" }, select: { record: true, createdAt: true, createdBy: true } }),
    canChoose ? prisma.branch.findMany({ where: { tenantId: session.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "setup/accounts", deletedAt: null }, select: { id: true, record: true } }),
  ]);

  const productMap = new Map<string, { productId: string; name: string; quantity: number; sale: number; cost: number }>();
  for (const item of items) {
    const row = productMap.get(item.productId) ?? { productId: item.productId, name: item.product.name, quantity: 0, sale: 0, cost: 0 };
    row.quantity += item.quantity;
    row.sale += Number(item.unitPrice) * item.quantity;
    row.cost += Number(item.product.costPrice) * item.quantity;
    productMap.set(item.productId, row);
  }
  const products = [...productMap.values()].filter(row => !search || row.name.toLowerCase().includes(search)).sort((a, b) => b.quantity - a.quantity).map(row => ({ ...row, profit: row.sale - row.cost }));
  const discount = sales.reduce((sum, sale) => sum + Number(sale.discount), 0);
  const totalSales = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const totalCost = items.reduce((sum, item) => sum + Number(item.product.costPrice) * item.quantity, 0);
  const grossMargin = totalSales - totalCost - discount;
  const expenseGroups = new Map<string, number>();
  const expenseRows = expenses.flatMap(row => {
    const value = recordOf(row.record);
    if (String(value.currency ?? "USD").toUpperCase() !== "USD") return [];
    const amount = numberOf(value, "amount", "totalAmount", "total");
    const name = String(value.expenseType ?? value.type ?? value.description ?? "Other expenses").trim() || "Other expenses";
    expenseGroups.set(name, (expenseGroups.get(name) || 0) + amount);
    return [{ id: row.createdAt.toISOString() + name, name: String(value.description ?? value.note ?? name), type: name, amount, date: row.createdAt }];
  });
  const expenseSummary = [...expenseGroups.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const totalExpenses = expenseSummary.reduce((sum, row) => sum + row.amount, 0);

  const purchaseIds = [...new Set(supplierPayments.map(row => String(recordOf(row.record).purchaseId ?? "")).filter(Boolean))];
  const [purchases, userIds] = await Promise.all([
    purchaseIds.length ? prisma.purchase.findMany({ where: { tenantId: session.tenantId, id: { in: purchaseIds } }, select: { id: true, supplier: { select: { name: true, phone: true } } } }) : Promise.resolve([]),
    Promise.resolve([...new Set([...expenses, ...supplierPayments].map(row => row.createdBy).filter((id): id is string => Boolean(id))) ]),
  ]);
  const supplierByPurchase = new Map(purchases.map(purchase => [purchase.id, purchase.supplier]));
  const accountNames = new Map(accountRows.map(account => [account.id, String(recordOf(account.record).name ?? recordOf(account.record).accountName ?? "Account")]));
  const userRows = userIds.length ? await prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const userById = new Map(userRows.map(user => [user.id, user.fullName]));
  const supplierRows = supplierPayments.map(row => {
    const value = recordOf(row.record); const purchaseId = String(value.purchaseId ?? ""); const supplier = supplierByPurchase.get(purchaseId);
    const accountId = String(value.accountId ?? "");
    return { id: row.createdAt.toISOString() + purchaseId, supplier: supplier?.name || String(value.supplierName ?? "Supplier"), phone: supplier?.phone || "—", user: row.createdBy ? userById.get(row.createdBy) || "—" : "—", method: String(value.paymentMethod ?? "—"), account: String(value.accountName ?? accountNames.get(accountId) ?? "Main Account"), amount: numberOf(value, "amount"), date: row.createdAt };
  });
  const totalSupplierPayments = supplierRows.reduce((sum, row) => sum + row.amount, 0);
  return NextResponse.json({ data: { products, expenseRows, expenseSummary, supplierRows, totals: { quantity: products.reduce((sum, row) => sum + row.quantity, 0), totalSales, totalCost, discount, grossMargin, totalExpenses, totalSupplierPayments, netProfit: grossMargin - totalExpenses }, range: { from: fromValue, to: toValue }, basis: "Current product cost prices" }, options: { branches } });
}
