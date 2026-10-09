import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function objectRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : { value }; }

export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "laboratory/records", deletedAt: { not: null }, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { deletedAt: "desc" }, take: 1000 });
  const data = rows.map((row) => ({ id: row.id, ...objectRecord(row.record), createdAt: row.createdAt, deletedAt: row.deletedAt }));
  const search = req.nextUrl.searchParams.get("search")?.trim().toLowerCase();
  return NextResponse.json({ data: search ? data.filter((row) => JSON.stringify(row).toLowerCase().includes(search)) : data });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null); const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Record id is required" }, { status: 400 });
  const result = await prisma.moduleRecord.updateMany({ where: { id, tenantId: session.tenantId, collection: "laboratory/records", deletedAt: { not: null }, ...(session.branchId ? { branchId: session.branchId } : {}) }, data: { deletedAt: null } });
  return result.count ? NextResponse.json({ data: { id, restored: true } }) : NextResponse.json({ error: "Deleted record not found" }, { status: 404 });
}
