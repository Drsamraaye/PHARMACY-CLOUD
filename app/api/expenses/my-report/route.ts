import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "expenses", deletedAt: null, createdBy: session.userId, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 1000 });
  const q = req.nextUrl.searchParams.get("search")?.trim().toLowerCase();
  const data = rows.map(row => ({ id: row.id, ...(row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record : { value: row.record }), createdAt: row.createdAt, updatedAt: row.updatedAt }));
  return NextResponse.json({ data: q ? data.filter(row => JSON.stringify(row).toLowerCase().includes(q)) : data });
}
export function POST(req: NextRequest) { return collectionPOST(req, "expenses"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "expenses"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "expenses"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "expenses"); }
