import { NextRequest, NextResponse } from "next/server";
import { collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim().toLocaleLowerCase();
  const records = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "hr/leave", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 });
  const employeeIds = [...new Set(records.map(row => { const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {}; return typeof value.employeeId === "string" ? value.employeeId : ""; }).filter(Boolean))];
  const employees = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "hr/employees", id: { in: employeeIds }, deletedAt: null }, select: { id: true, record: true } });
  const byId = new Map(employees.map(row => { const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {}; return [row.id, value] as const; }));
  const data = records.map(row => {
    const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {};
    const employee = typeof value.employeeId === "string" ? byId.get(value.employeeId) : undefined;
    return { ...value, id: row.id, date: value.date ?? row.createdAt, employeeName: value.employeeName ?? employee?.fullname ?? employee?.fullName ?? "—", approvedBy: value.approvedBy ?? "Pending" };
  }).filter(row => !search || JSON.stringify(row).toLocaleLowerCase().includes(search));
  return NextResponse.json({ data });
}
export function POST(req: NextRequest) { return collectionPOST(req, "hr/leave"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "hr/leave"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "hr/leave"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "hr/leave"); }
