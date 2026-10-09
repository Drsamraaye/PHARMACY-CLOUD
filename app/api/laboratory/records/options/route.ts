import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [patients, doctors] = await Promise.all([
    prisma.patient.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), deletedAt: null }, select: { id: true, fullName: true, phone: true }, orderBy: { fullName: "asc" }, take: 500 }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), isActive: true, role: "DOCTOR" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 200 }),
  ]);
  return NextResponse.json({ data: { patients, doctors } });
}
