import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Manager access is required" }, { status: 403 });
  const rows = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, collection: "manager-notifications", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 500 });
  const data = rows.filter((row) => {
    const value = row.record as Record<string, unknown>;
    return value.recipientId === session.userId && value.type === "CLOSEOUT_DISCREPANCY";
  }).map((row) => ({ id: row.id, ...(row.record as Record<string, unknown>), createdAt: row.createdAt }));
  return NextResponse.json({ data });
}
