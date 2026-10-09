import { NextRequest, NextResponse } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = req.nextUrl.searchParams.get("search")?.trim().toLocaleLowerCase();
  const rows = await prisma.moduleRecord.findMany({
    where: { tenantId: session.tenantId, collection: "setup/category", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) },
    orderBy: { createdAt: "desc" }, take: 1000,
  });
  const userIds = [...new Set(rows.map(row => row.createdBy).filter((id): id is string => Boolean(id)))];
  const users = await prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } });
  const names = new Map(users.map(user => [user.id, user.fullName]));
  const data = rows.filter(row => {
    if (!query) return true;
    const record = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {};
    return String(record.name ?? "").toLocaleLowerCase().includes(query);
  }).map(row => {
    const record = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {};
    return { ...record, id: row.id, user: row.createdBy ? names.get(row.createdBy) ?? "—" : "—", date: row.createdAt, createdAt: row.createdAt };
  });
  return NextResponse.json({ data });
}
export function POST(req: NextRequest) { return collectionPOST(req, "setup/category"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "setup/category"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "setup/category"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "setup/category"); }
