import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "private-expenses", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 1000 });
  const creatorIds = [...new Set(rows.map(row => row.createdBy).filter((id): id is string => Boolean(id)))];
  const users = creatorIds.length ? await prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: creatorIds } }, select: { id: true, fullName: true } }) : [];
  const names = new Map(users.map(user => [user.id, user.fullName]));
  return NextResponse.json({ data: rows.map(row => ({ id: row.id, ...(row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record : { value: row.record }), createdAt: row.createdAt, updatedAt: row.updatedAt, username: names.get(row.createdBy ?? "") ?? "—" })) });
}
export function POST(req: NextRequest) { return collectionPOST(req, "private-expenses"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "private-expenses"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "private-expenses"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "private-expenses"); }
