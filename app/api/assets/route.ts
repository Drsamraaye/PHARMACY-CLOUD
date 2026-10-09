import { NextRequest, NextResponse } from "next/server";
import { collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim().toLocaleLowerCase();
  const records = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "assets", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 1000 });
  const userIds = [...new Set(records.map(row => row.createdBy).filter((id): id is string => Boolean(id)))];
  const branchIds = [...new Set(records.map(row => row.branchId).filter((id): id is string => Boolean(id)))];
  const [users, branches] = await Promise.all([
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } }),
    prisma.branch.findMany({ where: { tenantId: session.tenantId, id: { in: branchIds } }, select: { id: true, name: true } }),
  ]);
  const userNames = new Map(users.map(user => [user.id, user.fullName]));
  const branchNames = new Map(branches.map(branch => [branch.id, branch.name]));
  const data = records.filter(row => {
    if (!search) return true;
    const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {};
    return String(value.name ?? "").toLocaleLowerCase().includes(search);
  }).map(row => {
    const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {};
    const quantity = Number(value.quantity ?? value.qty ?? 0);
    const unitPrice = Number(value.unitPrice ?? value.price ?? 0);
    return { ...value, id: row.id, quantity, unitPrice, totalPrice: Number(value.totalPrice ?? quantity * unitPrice), regDate: row.createdAt, regUser: row.createdBy ? userNames.get(row.createdBy) ?? "—" : "—", branch: row.branchId ? branchNames.get(row.branchId) ?? "—" : "—", branchId: row.branchId };
  });
  return NextResponse.json({ data });
}
export function POST(req: NextRequest) { return collectionPOST(req, "assets"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "assets"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "assets"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "assets"); }
