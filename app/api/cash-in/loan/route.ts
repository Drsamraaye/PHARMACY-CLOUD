import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

type LoanRecord = Record<string, unknown>;
const recordOf = (value: unknown): LoanRecord => value && typeof value === "object" && !Array.isArray(value) ? value as LoanRecord : {};
const dateOf = (value: string, end = false) => { const [year, month, day] = value.split("-").map(Number); const date = new Date(year, month - 1, day); if (end) date.setHours(23,59,59,999); else date.setHours(0,0,0,0); return date; };

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const fromValue = params.get("from") || ""; const toValue = params.get("to") || "";
  const type = params.get("type") || ""; const userId = params.get("userId") || "";
  const from = fromValue ? dateOf(fromValue) : null; const to = toValue ? dateOf(toValue, true) : null;
  if ((fromValue && Number.isNaN(from?.getTime())) || (toValue && Number.isNaN(to?.getTime())) || (from && to && from > to)) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const [rows, typeRows, users] = await Promise.all([
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "cash-in/loans", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}), ...(userId ? { createdBy: userId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "cash-in/types", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const userNames = new Map(users.map(user => [user.id, user.fullName]));
  const data = rows.map(row => { const value = recordOf(row.record); const amount = Number(value.amount ?? value.total ?? value.loanAmount ?? 0); const paid = Number(value.paidAmount ?? value.paid ?? 0); return { id: row.id, date: String(value.date ?? value.loanDate ?? row.createdAt.toISOString()), type: String(value.type ?? value.loanType ?? value.title ?? "Business Loan"), amount, balance: Number(value.balance ?? value.remainingBalance ?? Math.max(0, amount - paid)), userId: row.createdBy || "", user: row.createdBy ? userNames.get(row.createdBy) || "—" : "—", note: String(value.note ?? value.description ?? "—") }; }).filter(row => !type || row.type === type);
  const types = typeRows.map(row => { const value = recordOf(row.record); return String(value.name ?? value.type ?? value.title ?? ""); }).filter(Boolean);
  const uniqueTypes = [...new Set([...types, ...data.map(row => row.type)])].sort();
  return NextResponse.json({ data, options: { types: uniqueTypes, users }, totals: { amount: data.reduce((sum, row) => sum + row.amount, 0), balance: data.reduce((sum, row) => sum + row.balance, 0) } });
}
export function POST(req: NextRequest) { return collectionPOST(req, "cash-in/loans"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "cash-in/loans"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "cash-in/loans"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "cash-in/loans"); }
