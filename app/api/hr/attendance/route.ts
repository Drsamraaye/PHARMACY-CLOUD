import { NextRequest, NextResponse } from "next/server";
import { collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "hr/attendance", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 });
  const employeeIds = [...new Set(records.map(row => { const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {}; return typeof value.employeeId === "string" ? value.employeeId : ""; }).filter(Boolean))];
  const userIds = [...new Set(records.map(row => row.createdBy).filter((id): id is string => Boolean(id)))];
  const branchIds = [...new Set(records.map(row => row.branchId).filter((id): id is string => Boolean(id)))];
  const [employeeRows, users, branches] = await Promise.all([
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "hr/employees", id: { in: employeeIds }, deletedAt: null }, select: { id: true, record: true } }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } }),
    prisma.branch.findMany({ where: { tenantId: session.tenantId, id: { in: branchIds } }, select: { id: true, name: true } }),
  ]);
  const employeeMap = new Map(employeeRows.map(row => { const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {}; return [row.id, value] as const; }));
  const userMap = new Map(users.map(user => [user.id, user.fullName])); const branchMap = new Map(branches.map(branch => [branch.id, branch.name]));
  const data = records.map(row => { const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {}; const employee = typeof value.employeeId === "string" ? employeeMap.get(value.employeeId) : undefined; return { ...value, id: row.id, date: value.date ?? row.createdAt, employeeName: value.employeeName ?? employee?.fullname ?? employee?.fullName ?? "—", phone: employee?.phone ?? "—", branch: row.branchId ? branchMap.get(row.branchId) ?? "—" : "—", branchId: row.branchId, user: row.createdBy ? userMap.get(row.createdBy) ?? "—" : "—" }; });
  return NextResponse.json({ data });
}
export function POST(req: NextRequest) { return collectionPOST(req, "hr/attendance"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "hr/attendance"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "hr/attendance"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "hr/attendance"); }
