import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DataRecord = Record<string, unknown>;
const recordOf = (value: unknown): DataRecord => value && typeof value === "object" && !Array.isArray(value) ? value as DataRecord : {};
const amountOf = (record: DataRecord, ...fields: string[]) => {
  for (const field of fields) {
    const amount = Number(record[field]);
    if (Number.isFinite(amount)) return amount;
  }
  return 0;
};
const dateOf = (value: string, end = false) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (end) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
};

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const fromValue = params.get("from") || `${defaultStart.getFullYear()}-${String(defaultStart.getMonth() + 1).padStart(2, "0")}-01`;
  const toValue = params.get("to") || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const from = dateOf(fromValue);
  const to = dateOf(toValue, true);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const canChoose = session.role === "OWNER" || session.role === "ADMIN";
  const branchId = canChoose ? (params.get("branch") || "") : (session.branchId || "");
  const userId = params.get("user") || "";
  const branchFilter = branchId ? { branchId } : session.branchId ? { branchId: session.branchId } : {};
  const recordFilter = { tenantId: session.tenantId, deletedAt: null, ...branchFilter, createdAt: { gte: from, lte: to } };

  const [sales, expenses, loans, branches, users] = await Promise.all([
    prisma.sale.findMany({
      where: { tenantId: session.tenantId, ...branchFilter, status: { not: "VOID" }, createdAt: { gte: from, lte: to }, ...(userId ? { userId } : {}) },
      select: { paidAmount: true },
    }),
    prisma.moduleRecord.findMany({
      where: { ...recordFilter, collection: "expenses", ...(userId ? { createdBy: userId } : {}) },
      select: { record: true },
    }),
    prisma.moduleRecord.findMany({
      where: { ...recordFilter, collection: "cash-in/loans", ...(userId ? { createdBy: userId } : {}) },
      select: { record: true },
    }),
    canChoose ? prisma.branch.findMany({ where: { tenantId: session.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canChoose ? prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(branchId ? { branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }) : Promise.resolve([]),
  ]);

  const totalIncome = sales.reduce((sum, sale) => sum + Number(sale.paidAmount), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + amountOf(recordOf(item.record), "amount", "totalAmount", "total"), 0);
  const businessLoanPaid = loans.reduce((sum, item) => sum + amountOf(recordOf(item.record), "paidAmount", "amount", "paid", "payment"), 0);
  return NextResponse.json({ data: { totalIncome, totalExpenses, businessLoanPaid, netCashFlow: totalIncome - totalExpenses - businessLoanPaid, branches, users, range: { from: fromValue, to: toValue } } });
}
