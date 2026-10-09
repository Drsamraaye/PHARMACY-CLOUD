import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
/** Lists the signed-in tenant's active service catalog. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await prisma.product.findMany({
    where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), type: "SERVICE", isActive: true },
    orderBy: { name: "asc" }, take: 500,
  });
  return NextResponse.json({ data });
}
