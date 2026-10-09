import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [rows, users] = await Promise.all([
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "cash-in/types", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "asc" }, take: 1000 }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId }, select: { id: true, fullName: true } }),
  ]);
  const userById = new Map(users.map(user => [user.id, user.fullName]));
  const data = rows.map(row => { const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {}; return { id: row.id, name: String(value.name ?? value.type ?? ""), createdAt: row.createdAt, createdBy: row.createdBy ? userById.get(row.createdBy) ?? "—" : "—" }; });
  return NextResponse.json({ data });
}
export function POST(req: NextRequest) { return collectionPOST(req, "cash-in/types"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "cash-in/types"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "cash-in/types"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "cash-in/types"); }
