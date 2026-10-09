import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

type CashRecord = Record<string, unknown>;
const recordOf = (value: unknown): CashRecord => value && typeof value === "object" && !Array.isArray(value) ? value as CashRecord : {};
const dateOf = (value: string, end = false) => { const [year, month, day] = value.split("-").map(Number); const date = new Date(year, month - 1, day); if (end) date.setHours(23,59,59,999); else date.setHours(0,0,0,0); return date; };

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const fromValue = params.get("from") || "";
  const toValue = params.get("to") || "";
  const selectedType = params.get("type") || "";
  const selectedUser = params.get("userId") || "";
  const search = (params.get("search") || "").trim().toLowerCase();
  const from = fromValue ? dateOf(fromValue) : null;
  const to = toValue ? dateOf(toValue, true) : null;
  if (fromValue && Number.isNaN(from?.getTime()) || toValue && Number.isNaN(to?.getTime()) || from && to && from > to) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const [records, typeRows, users] = await Promise.all([
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "cash-in", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}), ...(selectedUser ? { createdBy: selectedUser } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "cash-in/types", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const userById = new Map(users.map(user => [user.id, user.fullName]));
  const data = records.map(row => {
    const value = recordOf(row.record);
    return { id: row.id, createdAt: row.createdAt, date: String(value.date ?? value.cashDate ?? row.createdAt.toISOString()), type: String(value.type ?? value.cashType ?? value.title ?? "—"), amount: Number(value.amount ?? value.totalAmount ?? value.total ?? 0), note: String(value.note ?? value.description ?? "—"), userId: row.createdBy || "", user: row.createdBy ? userById.get(row.createdBy) || "—" : "—" };
  }).filter(row => (!selectedType || row.type === selectedType) && (!search || `${row.type} ${row.note} ${row.user}`.toLowerCase().includes(search)));
  const types = typeRows.map(row => { const value = recordOf(row.record); return { id: row.id, name: String(value.name ?? value.type ?? value.title ?? "") }; }).filter(type => type.name);
  return NextResponse.json({ data, options: { types, users }, totals: { amount: data.reduce((sum, row) => sum + row.amount, 0) } });
}
export function POST(req: NextRequest) { return collectionPOST(req, "cash-in"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "cash-in"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "cash-in"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "cash-in"); }
