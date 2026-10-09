import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

type DebtRecord = Record<string, unknown>;
const recordOf = (value: unknown): DebtRecord => value && typeof value === "object" && !Array.isArray(value) ? value as DebtRecord : {};
const dateOf = (value: string, end = false) => { const [year, month, day] = value.split("-").map(Number); const date = new Date(year, month - 1, day); if (end) date.setHours(23,59,59,999); else date.setHours(0,0,0,0); return date; };

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const fromValue = params.get("from") || "";
  const toValue = params.get("to") || "";
  const selectedType = params.get("type") || "";
  const selectedUser = params.get("userId") || "";
  const search = (params.get("search") || "").trim().toLocaleLowerCase();
  const from = fromValue ? dateOf(fromValue) : null;
  const to = toValue ? dateOf(toValue, true) : null;
  if ((fromValue && Number.isNaN(from?.getTime())) || (toValue && Number.isNaN(to?.getTime())) || (from && to && from > to)) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const [records, users, customerOptions, accountRows] = await Promise.all([
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "debts", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}), ...(selectedUser ? { createdBy: selectedUser } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.patient.findMany({ where: { tenantId: session.tenantId, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 500 }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "setup/accounts", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, record: true }, orderBy: { createdAt: "asc" }, take: 500 }),
  ]);
  const accountOptions = accountRows.map(row => { const value = recordOf(row.record); return { id: row.id, name: String(value.name ?? value.accountName ?? "") }; }).filter(row => row.name);
  const recordValues = records.map(row => recordOf(row.record));
  const customerIds = [...new Set(recordValues.map(value => String(value.customerId || "")).filter(Boolean))];
  const accountIds = [...new Set(recordValues.map(value => String(value.accountId || "")).filter(Boolean))];
  const [customers, accounts] = await Promise.all([
    prisma.patient.findMany({ where: { tenantId: session.tenantId, id: { in: customerIds }, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "setup/accounts", id: { in: accountIds }, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, record: true } }),
  ]);
  const customerById = new Map(customers.map(row => [row.id, row.fullName]));
  const accountById = new Map(accounts.map(row => { const value = recordOf(row.record); return [row.id, String(value.name ?? value.accountName ?? "Account")]; }));
  const userById = new Map(users.map(user => [user.id, user.fullName]));
  const data = records.map(row => {
    const value = recordOf(row.record);
    const amount = Number(value.amount ?? value.total ?? value.debtAmount ?? 0);
    const paid = Number(value.paidAmount ?? value.paid ?? value.amountPaid ?? 0);
    const customerId = String(value.customerId || "");
    const accountId = String(value.accountId || "");
    return { id: row.id, createdAt: row.createdAt, date: String(value.date ?? value.debtDate ?? row.createdAt.toISOString()), type: String(value.type ?? value.debtType ?? value.title ?? "Debt"), amount, paid, balance: Number(value.balance ?? Math.max(0, amount - paid)), userId: row.createdBy || "", user: row.createdBy ? userById.get(row.createdBy) || "—" : "—", customerId, customer: customerById.get(customerId) || String(value.customerName || "—"), accountId, account: accountById.get(accountId) || String(value.accountName || "—"), note: String(value.note ?? value.description ?? "—") };
  }).filter(row => (!selectedType || row.type === selectedType) && (!search || row.customer.toLocaleLowerCase().includes(search)));
  const types = [...new Set(data.map(row => row.type))].sort();
  return NextResponse.json({ data, options: { users, types, customers: customerOptions, accounts: accountOptions }, totals: { amount: data.reduce((sum, row) => sum + row.amount, 0), paid: data.reduce((sum, row) => sum + row.paid, 0), balance: data.reduce((sum, row) => sum + row.balance, 0) } });
}
export function POST(req: NextRequest) { return collectionPOST(req, "debts"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "debts"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "debts"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "debts"); }
