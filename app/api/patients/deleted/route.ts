import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists soft-deleted patients for the current tenant. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const patients = await prisma.patient.findMany({ where: { tenantId: session.tenantId, deletedAt: { not: null }, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { deletedAt: "desc" }, take: 500 });
  return NextResponse.json({ data: patients });
}
