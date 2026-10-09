import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "expenses", deletedAt: { not: null }, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { updatedAt: "desc" }, take: 1000 });
  return NextResponse.json({ data: rows.map(row => ({ id: row.id, ...(row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record : { value: row.record }), deletedAt: row.deletedAt })) });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({})); const id = typeof body?.id === "string" ? body.id : ""; if (!id) return NextResponse.json({ error: "Record id is required" }, { status: 400 });
  const result = await prisma.moduleRecord.updateMany({ where: { id, tenantId: session.tenantId, collection: "expenses", deletedAt: { not: null }, ...(session.branchId ? { branchId: session.branchId } : {}) }, data: { deletedAt: null } });
  return result.count ? NextResponse.json({ data: { id, restored: true } }) : NextResponse.json({ error: "Deleted expense not found" }, { status: 404 });
}
