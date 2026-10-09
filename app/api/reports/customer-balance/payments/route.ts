import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const patientId = req.nextUrl.searchParams.get("patientId") || "";
  if (!patientId) return NextResponse.json({ error: "Customer is required" }, { status: 400 });
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId: session.tenantId }, select: { id: true, fullName: true } });
  if (!patient) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  const rows = await prisma.moduleRecord.findMany({
    where: { tenantId: session.tenantId, collection: "customer-receipts", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const data = rows.flatMap(row => {
    const record = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {};
    if (String(record.patientId || "") !== patientId) return [];
    return [{ id: row.id, date: row.createdAt, amount: Number(record.amount || 0), method: String(record.paymentMethod || "—"), userId: row.createdBy || "—" }];
  });
  return NextResponse.json({ data, patient });
}
