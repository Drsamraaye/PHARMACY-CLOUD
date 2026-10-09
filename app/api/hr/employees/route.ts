import { NextRequest, NextResponse } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim().toLocaleLowerCase();
  const deletedOnly = req.nextUrl.searchParams.get("deleted") === "1";
  const where = { tenantId: session.tenantId, collection: "hr/employees", deletedAt: deletedOnly ? { not: null } : null, ...(session.branchId ? { branchId: session.branchId } : {}) };
  const records = await prisma.moduleRecord.findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 });
  const salaryRecords = deletedOnly ? [] : await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "hr/salary", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, take: 5000 });
  const salaryUploads = deletedOnly ? [] : await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "hr/salary-upload", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 });
  const paymentsByEmployee = new Map<string, number>();
  const paymentsByEmployeeMonth = new Map<string, number>();
  for (const payment of salaryRecords) {
    const value = payment.record && typeof payment.record === "object" && !Array.isArray(payment.record) ? payment.record as Record<string, unknown> : {};
    if (typeof value.employeeId === "string") {
      const amount = Number(value.paidAmount ?? 0);
      paymentsByEmployee.set(value.employeeId, (paymentsByEmployee.get(value.employeeId) ?? 0) + amount);
      if (typeof value.monthKey === "string") { const key = `${value.employeeId}|${value.monthKey}`; paymentsByEmployeeMonth.set(key, (paymentsByEmployeeMonth.get(key) ?? 0) + amount); }
    }
  }
  const latestUploadByEmployee = new Map<string, Record<string, unknown>>();
  for (const upload of salaryUploads) { const value = upload.record && typeof upload.record === "object" && !Array.isArray(upload.record) ? upload.record as Record<string, unknown> : {}; if (typeof value.employeeId === "string" && !latestUploadByEmployee.has(value.employeeId)) latestUploadByEmployee.set(value.employeeId, value); }
  const userIds = [...new Set(records.map(row => row.createdBy).filter((id): id is string => Boolean(id)))];
  const branchIds = [...new Set(records.map(row => row.branchId).filter((id): id is string => Boolean(id)))];
  const [users, branches] = await Promise.all([
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } }),
    prisma.branch.findMany({ where: { tenantId: session.tenantId, id: { in: branchIds } }, select: { id: true, name: true } }),
  ]);
  const userNames = new Map(users.map(user => [user.id, user.fullName]));
  const branchNames = new Map(branches.map(branch => [branch.id, branch.name]));
  const data = records.map(row => {
    const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {};
    const paid = Number(value.paid ?? paymentsByEmployee.get(row.id) ?? 0);
    const salary = Number(value.salary ?? 0);
    const upload = latestUploadByEmployee.get(row.id);
    const uploadedBalance = upload ? Math.max(0, Number(upload.previousBalance ?? 0) + Number(upload.netSalary ?? 0) - (typeof upload.monthKey === "string" ? paymentsByEmployeeMonth.get(`${row.id}|${upload.monthKey}`) ?? 0 : 0)) : undefined;
    const generalBalance = Number(uploadedBalance ?? value.generalBalance ?? Math.max(0, salary - paid));
    const taxRate = Number(value.taxRate ?? 0);
    return { ...value, id: row.id, date: row.createdAt, createdBy: row.createdBy ? userNames.get(row.createdBy) ?? "—" : "—", branch: row.branchId ? branchNames.get(row.branchId) ?? "—" : "—", paid, generalBalance, taxAmount: Number(value.taxAmount ?? salary * taxRate / 100) };
  }).filter(row => !search || JSON.stringify(row).toLocaleLowerCase().includes(search));
  return NextResponse.json({ data });
}
export function POST(req: NextRequest) { return collectionPOST(req, "hr/employees"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "hr/employees"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "hr/employees"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "hr/employees"); }
